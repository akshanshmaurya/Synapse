"""
WebSocket Chat Endpoint — Phase 4
Provides real-time streaming chat via WebSocket with HTTP fallback.
Authentication via cookie-based JWT tokens.
"""
import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from app.auth.jwt_handler import verify_token
from app.services.agent_orchestrator import AgentOrchestrator
from app.services.chat_service import chat_service
from app.utils.logger import logger

router = APIRouter()
orchestrator = AgentOrchestrator()


async def _authenticate_ws(websocket: WebSocket) -> str | None:
    """Extract and verify JWT from WebSocket cookies."""
    cookies = websocket.cookies
    token = cookies.get("access_token")
    if not token:
        return None
    payload = verify_token(token)
    if not payload:
        return None
    return payload.get("sub")


@router.websocket("/ws/chat/{session_id}")
async def websocket_chat(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time mentor chat.

    Protocol:
      1. Client connects with cookies (access_token)
      2. Server authenticates and accepts
      3. Client sends JSON: {"message": "..."}
      4. Server streams response as JSON chunks:
         {"type": "token", "content": "..."} — partial text
         {"type": "done", "content": "...", "chat_id": "..."} — final
         {"type": "error", "content": "..."} — error
    """
    # Authenticate before accepting
    user_id = await _authenticate_ws(websocket)
    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    logger.info("WebSocket connected: user=%s session=%s", user_id, session_id)

    try:
        while True:
            # Receive message from client
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                message = data.get("message", "").strip()
            except (json.JSONDecodeError, AttributeError):
                await websocket.send_json({"type": "error", "content": "Invalid message format"})
                continue

            if not message:
                await websocket.send_json({"type": "error", "content": "Empty message"})
                continue

            # Send typing indicator
            await websocket.send_json({"type": "typing", "content": ""})

            try:
                # Process through the agent pipeline
                chat_id = session_id if session_id != "new" else None
                result = await orchestrator.process_message_async(
                    user_id=user_id,
                    message=message,
                    chat_id=chat_id,
                )

                response_text = result.get("response", "")
                final_chat_id = result.get("chat_id", session_id)

                # Stream response in chunks for real-time feel
                words = response_text.split(" ")
                chunk_size = 3  # Send 3 words at a time
                streamed = []
                for i in range(0, len(words), chunk_size):
                    chunk = " ".join(words[i:i + chunk_size])
                    streamed.append(chunk)
                    await websocket.send_json({
                        "type": "token",
                        "content": chunk,
                    })
                    await asyncio.sleep(0.05)  # 50ms between chunks

                # Send final complete message
                await websocket.send_json({
                    "type": "done",
                    "content": response_text,
                    "chat_id": final_chat_id,
                })

            except Exception as e:
                logger.error("WebSocket processing error: %s", e)
                await websocket.send_json({
                    "type": "error",
                    "content": "I'm having trouble processing that. Please try again.",
                })

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: user=%s", user_id)
    except Exception as e:
        logger.error("WebSocket unexpected error: %s", e)
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except Exception:
            pass
