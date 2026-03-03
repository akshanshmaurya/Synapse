"""
Structured Logging System
Replaces all print-based debugging with Python's logging module.
Container-friendly: outputs to stdout with structured format.
"""
import logging
import sys


def setup_logging(level: str = "INFO") -> logging.Logger:
    """Configure the application-wide logger."""
    logger = logging.getLogger("synapse")

    if logger.handlers:
        return logger

    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.DEBUG)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-7s | %(name)s.%(module)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    # Prevent propagation to root logger (avoids duplicate logs)
    logger.propagate = False

    return logger


# Initialize on import
logger = setup_logging()
