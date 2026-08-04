import { useEffect, useRef, useCallback } from 'react';
import { API_URL } from '../config';
import { getToken, getTokenPayload } from './storage';

// 서버 payload는 snake → camel 변환.
function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
}
function convertKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(convertKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [snakeToCamel(k), convertKeys(v)]));
  }
  return obj;
}

function getWsBaseUrl(): string {
  return API_URL.replace(/^http/, 'ws');
}

type MessageHandler = (parsed: any) => void;

// --- 공유 WebSocket 클라이언트 (싱글턴) ---
class WsClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<MessageHandler>> = new Map();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastPong = 0;
  private userId: string | null = null;
  private closed = false;

  connect(userId: string) {
    this.userId = userId;
    this.closed = false;
    this.doConnect();
  }

  private doConnect() {
    const token = getToken();
    if (!token || !this.userId || this.closed) return;

    // 토큰이 이미 만료면 재연결 중단(서버가 4001로 끊기 전에 스킵)
    const payload = getTokenPayload();
    if (payload?.exp && payload.exp * 1000 < Date.now()) {
      this.closed = true;
      return;
    }

    this.ws = new WebSocket(`${getWsBaseUrl()}/ws/stream?token=${token}`);

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.lastPong = Date.now();
      this.startHeartbeat();
    };

    this.ws.onmessage = (event: WebSocketMessageEvent) => {
      try {
        const parsed = JSON.parse(event.data as string);
        const type = parsed.type as string;
        if (type === 'pong') {
          this.lastPong = Date.now();
          return;
        }
        this.listeners.get(type)?.forEach((fn) => fn(parsed));
      } catch (e) {
        console.error('WS parse error:', e);
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      this.stopHeartbeat();
      if (!this.closed) {
        if (this.reconnectAttempt >= 10) {
          this.closed = true;
          return;
        }
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        if (Date.now() - this.lastPong > 45000) {
          this.ws?.close();
          return;
        }
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.closed) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), 30000);
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
    return () => { this.listeners.get(type)?.delete(handler); };
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(data));
  }

  disconnect() {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
  }
}

const wsClient = new WsClient();

// --- 연결 라이프사이클 훅 (App에서 1회) ---
export function useWebSocketConnection(userId: string | null) {
  useEffect(() => {
    if (!userId) return;
    wsClient.connect(userId);
    return () => { wsClient.disconnect(); };
  }, [userId]);
}

// --- 데이터 리프레시 훅 (WS로 서버 변경 → 재조회 트리거) ---
export function useDataRefresh(entities: string | string[], onRefresh: () => void) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const entityList = Array.isArray(entities) ? entities : [entities];
  const key = entityList.join(',');

  useEffect(() => {
    const unsub1 = wsClient.on('data_changed', (parsed) => {
      if (entityList.includes(parsed.entity)) onRefreshRef.current();
    });
    const unsub2 = wsClient.on('file_ready', () => {
      if (entityList.includes('portfolios')) onRefreshRef.current();
    });
    return () => { unsub1(); unsub2(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

// --- 채팅 훅 ---
export function useChatWebSocket(
  selectedClassId: string | null,
  onMessage: (msg: any) => void,
  onPreviewUpdate: (classId: string, msg: any) => void,
) {
  const onMessageRef = useRef(onMessage);
  const onPreviewRef = useRef(onPreviewUpdate);
  const selectedRef = useRef(selectedClassId);
  onMessageRef.current = onMessage;
  onPreviewRef.current = onPreviewUpdate;
  selectedRef.current = selectedClassId;

  useEffect(() => {
    return wsClient.on('new_message', (parsed) => {
      const msg = convertKeys(parsed.data);
      onPreviewRef.current(msg.classId, msg);
      if (msg.classId === selectedRef.current) onMessageRef.current(msg);
    });
  }, []);

  const sendMessage = useCallback((classId: string, content: string) => {
    wsClient.send({ type: 'chat_send', class_id: classId, content });
  }, []);

  return { sendMessage };
}

// --- 알림 훅 ---
export function useNotificationWebSocket(onNotification: (notif: any) => void) {
  const ref = useRef(onNotification);
  ref.current = onNotification;
  useEffect(() => {
    return wsClient.on('new_notification', (parsed) => {
      const raw = convertKeys(parsed.data);
      if (raw.createdAt && !raw.date) raw.date = raw.createdAt;
      ref.current(raw);
    });
  }, []);
}

// --- 압축 진행률 훅 ---
export function useCompressionProgress(onProgress: (pct: number) => void) {
  const ref = useRef(onProgress);
  ref.current = onProgress;
  useEffect(() => {
    return wsClient.on('compression_progress', (parsed) => {
      const pct = parsed?.data?.progress;
      if (typeof pct === 'number') ref.current(pct);
    });
  }, []);
}
