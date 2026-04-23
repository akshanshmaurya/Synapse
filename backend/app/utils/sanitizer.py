"""
Input Sanitization Utilities for XSS Prevention.

Provides functions to strip potentially dangerous HTML and script tags
from user inputs before they are stored or processed. Used across
multiple entry points (REST API, WebSocket, goal updates) to ensure
defense-in-depth against cross-site scripting attacks.

All user-provided text MUST pass through one of these functions before
being stored in MongoDB or passed to the LLM pipeline.

Call sites:
    - app/main.py:             chat_endpoint(), chat_guest_endpoint(), update_session_goal()
    - app/routes/ws_chat.py:   WebSocket message handler
    - app/routes/onboarding.py: onboarding text fields
"""
import bleach
import re


def sanitize_text(text: str) -> str:
    """Strip all HTML tags from the input string to prevent XSS.

    Uses bleach to remove all HTML tags and attributes. Safe for
    storing in MongoDB and rendering in the frontend.

    Args:
        text: The raw user input string.

    Returns:
        A sanitized string with all HTML tags removed and special characters escaped.
    """
    if not text:
        return text
    # Strip all tags and attributes. Newer bleach versions removed the
    # dedicated `styles` kwarg, so keeping the allowlists empty is enough.
    return bleach.clean(text, tags=[], attributes={}, strip=True)


def sanitize_html_content(html: str, allowed_tags: list[str] | None = None) -> str:
    """Sanitize HTML content, optionally preserving safe formatting tags.

    Unlike sanitize_text() which strips ALL tags, this function allows
    a controlled set of formatting tags for contexts where limited HTML
    is acceptable (e.g., rich text fields, admin notes).

    Args:
        html: The raw HTML string to sanitize.
        allowed_tags: Optional list of permitted HTML tags.
                      Defaults to a safe set of formatting tags.

    Returns:
        Sanitized HTML with only allowed tags preserved.
    """
    if not html:
        return html

    safe_tags = allowed_tags or [
        "b", "i", "em", "strong", "p", "br", "ul", "ol", "li", "code", "pre",
    ]
    return bleach.clean(html, tags=safe_tags, attributes={}, strip=True)


def sanitize_field(text: str, max_length: int = 5000) -> str:
    """Sanitize and truncate a text field.

    Combines XSS sanitization with length enforcement. Use for all
    user-provided fields that have length constraints.

    Args:
        text: The raw user input string.
        max_length: Maximum allowed length after sanitization.

    Returns:
        A sanitized and truncated string.
    """
    if not text:
        return text
    cleaned = sanitize_text(text)
    return cleaned[:max_length]
