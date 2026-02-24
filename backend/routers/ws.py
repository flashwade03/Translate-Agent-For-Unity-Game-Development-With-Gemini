import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
logger = logging.getLogger("ws")

_connections: dict[str, set[WebSocket]] = {}


async def broadcast_job_update(job_id: str, data: dict):
    """Broadcast job progress to all connected WebSocket clients."""
    connections = _connections.get(job_id, set()).copy()
    for ws in connections:
        try:
            await ws.send_json(data)
        except Exception:
            _connections.get(job_id, set()).discard(ws)


@router.websocket("/ws/jobs/{job_id}")
async def job_progress_ws(websocket: WebSocket, job_id: str):
    await websocket.accept()
    if job_id not in _connections:
        _connections[job_id] = set()
    _connections[job_id].add(websocket)
    logger.info("WebSocket connected for job %s", job_id)
    try:
        # Send current state immediately
        job_svc = websocket.app.state.job_service
        job = job_svc.get_job(job_id)
        if job:
            await websocket.send_json({
                "jobId": job.job_id,
                "status": job.status.value,
                "progress": job.progress,
                "processedKeys": job.processed_keys,
                "totalKeys": job.total_keys,
                "error": job.error,
            })
        # Keep alive until disconnect
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        _connections.get(job_id, set()).discard(websocket)
        if not _connections.get(job_id):
            _connections.pop(job_id, None)
        logger.info("WebSocket disconnected for job %s", job_id)
