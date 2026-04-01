from fastapi import WebSocket
from typing import Dict, List


class ConnectionManager:
    def __init__(self):
        # user_id -> list of websockets (unified: chat + notifications)
        self.connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.connections:
            self.connections[user_id] = []
        self.connections[user_id].append(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.connections:
            self.connections[user_id] = [
                ws for ws in self.connections[user_id] if ws != websocket
            ]
            if not self.connections[user_id]:
                del self.connections[user_id]

    async def send_to_user(self, user_id: str, message: dict):
        if user_id not in self.connections:
            return
        dead = []
        for ws in self.connections[user_id]:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.connections[user_id].remove(ws)

    def get_connected_user_ids(self) -> List[str]:
        return list(self.connections.keys())

    async def broadcast_to_users(self, user_ids: List[str], message: dict):
        for user_id in user_ids:
            await self.send_to_user(user_id, message)


manager = ConnectionManager()
