"""
WebSocket Chat Tests — Phase 4
Tests for /ws/chat/{session_id} WebSocket authentication logic.
"""
import pytest
from unittest.mock import patch, MagicMock


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
