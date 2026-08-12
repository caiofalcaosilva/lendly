from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    """In-memory WebSocket registry, keyed by an arbitrary room id — a
    loan request id for chat, a user id for notifications (see the two
    instances below). The key is just a string, so the same class serves
    both without modification.

    Single-process only (no Redis pub/sub) — fine for this app's single
    uvicorn worker. Would need a shared broker if ever run with multiple
    worker processes.
    """

    def __init__(self) -> None:
        self._connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, request_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[request_id].append(websocket)

    def disconnect(self, request_id: str, websocket: WebSocket) -> None:
        conns = self._connections.get(request_id)
        if conns and websocket in conns:
            conns.remove(websocket)
        if conns is not None and not conns:
            self._connections.pop(request_id, None)

    async def broadcast(self, request_id: str, payload: dict) -> None:
        dead: list[WebSocket] = []
        for ws in self._connections.get(request_id, []):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(request_id, ws)


# Chat (/requests/{id}/ws) — keyed by request_id.
manager = ConnectionManager()
# Notification bell (/notifications/ws) — keyed by user_id.
notification_manager = ConnectionManager()
# Group mural (/groups/{id}/posts/ws) — keyed by group_id.
group_post_manager = ConnectionManager()
