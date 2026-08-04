from collections import defaultdict
from typing import Dict, List

from fastapi import WebSocket


class ConnectionManager:
    """In-memory per-request WebSocket registry.

    Single-process only (no Redis pub/sub) — fine for this app's single
    uvicorn worker. Would need a shared broker if ever run with multiple
    worker processes.
    """

    def __init__(self) -> None:
        self._connections: Dict[str, List[WebSocket]] = defaultdict(list)

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
        dead: List[WebSocket] = []
        for ws in self._connections.get(request_id, []):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(request_id, ws)


manager = ConnectionManager()
