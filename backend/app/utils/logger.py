import logging
import os

log_file = os.path.join(os.path.dirname(__file__), "debug.log")
logging.basicConfig(
    filename=log_file,
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def log_debug(message):
    print(f"DEBUG: {message}")
    logging.debug(message)

def log_error(message, error=None):
    print(f"ERROR: {message}")
    if error:
        print(f"Traceback: {error}")
    logging.error(f"{message} - {error}")
