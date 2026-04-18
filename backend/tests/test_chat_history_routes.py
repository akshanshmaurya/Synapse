import pytest
from fastapi import HTTPException
from unittest.mock import AsyncMock, patch


pytestmark = pytest.mark.asyncio


class TestChatDeletionRoute:
    @patch("app.routes.chat_history.chat_service.delete_chat_session", new_callable=AsyncMock)
    async def test_owner_can_delete_chat(self, mock_delete):
        from app.routes.chat_history import delete_chat_session

        mock_delete.return_value = True
        result = await delete_chat_session("chat-123", user={"_id": "user-1"})

        assert result == {"success": True}
        mock_delete.assert_awaited_once_with(chat_id="chat-123", user_id="user-1")

    @patch("app.routes.chat_history.chat_service.delete_chat_session", new_callable=AsyncMock)
    async def test_delete_returns_404_for_missing_or_unowned_chat(self, mock_delete):
        from app.routes.chat_history import delete_chat_session

        mock_delete.return_value = False

        with pytest.raises(HTTPException) as exc:
            await delete_chat_session("chat-404", user={"_id": "user-1"})

        assert exc.value.status_code == 404
