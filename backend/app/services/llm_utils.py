import time
import random
from google import genai
from google.genai import types

def generate_with_retry(client, model, contents, config=None, retries=3, initial_delay=2):
    """
    Wraps client.models.generate_content with exponential backoff retry logic.
    Ref: https://ai.google.dev/gemini-api/docs/rate-limits
    """
    delay = initial_delay
    for attempt in range(retries):
        try:
            response = client.models.generate_content(
                model=model,
                contents=contents,
                config=config
            )
            return response
        except Exception as e:
            # Check for Resource Exhausted (429) details in the error string
            error_str = str(e)
            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                if attempt == retries - 1:
                    print(f"FAILED after {retries} attempts. Max quota reached.")
                    raise e
                
                print(f"Rate limited (429). Retrying in {delay}s...")
                time.sleep(delay + random.uniform(0, 1)) # Add jitter
                delay *= 2 # Exponential backoff
            else:
                # For other errors, maybe retry or raise immediately.
                # Let's retry on 500s too, but raise on 400s (bad request)
                if "500" in error_str or "503" in error_str:
                     time.sleep(delay)
                     delay *= 2
                     continue
                raise e # Raise non-transient errors
    return None
