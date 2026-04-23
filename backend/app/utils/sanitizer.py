"""
XSS Prevention Utilities for Synapse.

Uses the bleach library to sanitize all user-provided text input before
storage or processing. This prevents Cross-Site Scripting (XSS) attacks
where malicious scripts are injected through user input fields.

All user-facing text fields are sanitized at the API entry point (route handler)
before the data reaches any agent or database operation.

Call sites:
    - app/main.py:               POST /api/chat, POST /api/chat/guest, PATCH /api/chats/{id}/context/goal
    - app/routes/ws_chat.py:     WebSocket message handler
    - app/routes/onboarding.py:  POST /api/onboarding/complete (why_here field)
    - app/routes/chat_history.py: PATCH /api/chats/{id} (title field)

OWASP Top 10 compliance: A03:2021 (Injection)
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
