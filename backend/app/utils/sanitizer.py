"""Input sanitation utilities for XSS prevention.

Provides functions to strip potentially dangerous HTML and script tags
from user inputs before they are stored or processed.
"""
import bleach

def sanitize_text(text: str) -> str:
    """Strip all HTML tags from the input string to prevent XSS.

    Args:
        text: The raw user input string.

    Returns:
        A sanitized string with all HTML tags removed and special characters escaped.
    """
    if not text:
        return text
    # Strip all tags, attributes, and styles
    return bleach.clean(text, tags=[], attributes={}, styles=[], strip=True)
