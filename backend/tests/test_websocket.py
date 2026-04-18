"""
WebSocket Chat Tests — Phase 4
Tests for /ws/chat/{session_id} WebSocket authentication logic.
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi import WebSocketDisconnect


pytestmark = pytest.mark.asyncio


class TestWebSocketAuth:
    """Test WebSocket authentication helper function."""

    @patch("app.routes.ws_chat.verify_token")
    async def test_ws_auth_no_cookies(self, mock_verify):
        """WebSocket with no cookies returns None."""
        from app.routes.ws_chat import _authenticate_ws

        mock_ws = MagicMock()
        mock_ws.cookies = {}
        result = await _authenticate_ws(mock_ws)
        assert result is None
        mock_verify.assert_not_called()

    @patch("app.routes.ws_chat.verify_token")
    async def test_ws_auth_valid_token(self, mock_verify):
        """WebSocket with valid token returns user_id."""
        mock_verify.return_value = {"sub": "user123"}

        from app.routes.ws_chat import _authenticate_ws

        mock_ws = MagicMock()
        mock_ws.cookies = {"access_token": "valid_token"}
        result = await _authenticate_ws(mock_ws)
        assert result == "user123"
        mock_verify.assert_called_once_with("valid_token")

    @patch("app.routes.ws_chat.verify_token")
    async def test_ws_auth_invalid_token(self, mock_verify):
        """WebSocket with invalid/expired token returns None."""
        mock_verify.return_value = None

        from app.routes.ws_chat import _authenticate_ws

        mock_ws = MagicMock()
        mock_ws.cookies = {"access_token": "expired_token"}
        result = await _authenticate_ws(mock_ws)
        assert result is None

    @patch("app.routes.ws_chat.verify_token")
    async def test_ws_auth_token_missing_sub(self, mock_verify):
        """Token without sub claim returns None."""
        mock_verify.return_value = {}

        from app.routes.ws_chat import _authenticate_ws

        mock_ws = MagicMock()
        mock_ws.cookies = {"access_token": "token_no_sub"}
        result = await _authenticate_ws(mock_ws)
        assert result is None

    @patch("app.routes.ws_chat.verify_token")
    async def test_ws_auth_token_with_extra_claims(self, mock_verify):
        """Token with extra claims still extracts sub correctly."""
        mock_verify.return_value = {"sub": "user456", "role": "admin", "exp": 9999}

        from app.routes.ws_chat import _authenticate_ws

        mock_ws = MagicMock()
        mock_ws.cookies = {"access_token": "admin_token"}
        result = await _authenticate_ws(mock_ws)
        assert result == "user456"


class TestWebSocketStreaming:
    """Verify the socket route emits real incremental tokens before done."""

    @patch("app.routes.ws_chat.orchestrator")
    @patch("app.routes.ws_chat._authenticate_ws", new_callable=AsyncMock)
    async def test_websocket_streams_tokens_before_done(self, mock_auth, mock_orchestrator):
        from app.routes.ws_chat import websocket_chat

        mock_auth.return_value = "user-1"

        async def _stream(**kwargs):
            await kwargs["on_token"]("Hello")
            await kwargs["on_token"](" world")
            return {"response": "Hello world", "chat_id": "chat-123"}

        mock_orchestrator.process_message_stream_async = AsyncMock(side_effect=_stream)

        mock_ws = MagicMock()
        mock_ws.cookies = {"access_token": "valid_token"}
        mock_ws.accept = AsyncMock()
        mock_ws.close = AsyncMock()
        mock_ws.send_json = AsyncMock()
        mock_ws.receive_text = AsyncMock(
            side_effect=['{"message":"Explain recursion"}', WebSocketDisconnect()]
        )

        await websocket_chat(mock_ws, "new")

        sent_payloads = [call.args[0] for call in mock_ws.send_json.await_args_list]
        assert sent_payloads[0] == {"type": "typing", "content": ""}
        assert sent_payloads[1] == {"type": "token", "content": "Hello"}
        assert sent_payloads[2] == {"type": "token", "content": " world"}
        assert sent_payloads[3] == {
            "type": "done",
            "content": "Hello world",
            "chat_id": "chat-123",
        }

        call_kwargs = mock_orchestrator.process_message_stream_async.await_args.kwargs
        assert call_kwargs["user_id"] == "user-1"
        assert call_kwargs["chat_id"] is None
        assert call_kwargs["message"] == "Explain recursion"
