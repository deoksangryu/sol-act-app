import { useEffect, useRef, useCallback } from 'react';
import { getToken } from './api';
import type { ChatMessage, Notification } from '../types';

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function convertKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(convertKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [snakeToCamel(k), convertKeys(v)])
    );
  }
  return obj;
}

function getWsBaseUrl(): string {
  const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';
  return apiUrl.replace(/^http/, 'ws');
}

// --- Shared WebSocket Client (singleton) ---

type MessageHandler = (parsed: any) => void;

class WsClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<MessageHandler>> = new Map();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
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

    this.ws = new WebSocket(`${getWsBaseUrl()}/ws/stream?token=${token}`);

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        const type = parsed.type as string;
        const handlers = this.listeners.get(type);
        if (handlers) {
          handlers.forEach(fn => fn(parsed));
        }
      } catch (e) {
        console.error('WS parse error:', e);
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (!this.closed) this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
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
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}

const wsClient = new WsClient();

// --- Connection lifecycle hook (call once in App.tsx) ---

export function useWebSocketConnection(userId: string | null) {
  useEffect(() => {
    if (!userId) return;
    wsClient.connect(userId);
    return () => { wsClient.disconnect(); };
  }, [userId]);
}

// --- Chat hook ---

export function useChatWebSocket(
  selectedClassId: string | null,
  onMessage: (msg: ChatMessage) => void,
  onPreviewUpdate: (classId: string, msg: ChatMessage) => void
) {
  const onMessageRef = useRef(onMessage);
  const onPreviewRef = useRef(onPreviewUpdate);
  const selectedRef = useRef(selectedClassId);

  onMessageRef.current = onMessage;
  onPreviewRef.current = onPreviewUpdate;
  selectedRef.current = selectedClassId;

  useEffect(() => {
    return wsClient.on('new_message', (parsed) => {
      const msg = convertKeys(parsed.data) as ChatMessage;
      onPreviewRef.current(msg.classId, msg);
      if (msg.classId === selectedRef.current) {
        onMessageRef.current(msg);
      }
    });
  }, []);

  const sendMessage = useCallback((classId: string, content: string) => {
    wsClient.send({ type: 'chat_send', class_id: classId, content });
  }, []);

  return { sendMessage };
}

// --- Notification hook ---

export function useNotificationWebSocket(
  onNotification: (notif: Notification) => void
) {
  const onNotifRef = useRef(onNotification);
  onNotifRef.current = onNotification;

  useEffect(() => {
    return wsClient.on('new_notification', (parsed) => {
      const notif = convertKeys(parsed.data) as Notification;
      onNotifRef.current(notif);
    });
  }, []);
}

// --- Data refresh hook ---

export function useDataRefresh(
  entities: string | string[],
  onRefresh: () => void
) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const entityList = Array.isArray(entities) ? entities : [entities];
  const key = entityList.join(',');

  useEffect(() => {
    return wsClient.on('data_changed', (parsed) => {
      if (entityList.includes(parsed.entity)) {
        onRefreshRef.current();
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
