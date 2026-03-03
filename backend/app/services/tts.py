import requests
from app.core.config import settings
from app.utils.logger import logger

ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech"
# Use a default voice ID (e.g., "Rachel" or a calm mentor voice)
# "21m00Tcm4TlvDq8ikWAM" is Rachel (standard sample).
# You can change this to a specific "Gentle Guide" voice ID.
VOICE_ID = "21m00Tcm4TlvDq8ikWAM" 

def generate_audio(text: str) -> bytes:
    api_key = settings.ELEVENLABS_API_KEY
    if not api_key:
        logger.warning("ELEVENLABS_API_KEY not set")
        return None

    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": api_key
    }

    data = {
        "text": text,
        "model_id": "eleven_flash_v2_5",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.5
        }
    }

    url = f"{ELEVENLABS_API_URL}/{VOICE_ID}"
    
    try:
        response = requests.post(url, json=data, headers=headers)
        if response.status_code == 200:
            return response.content
        else:
            logger.error("ElevenLabs error: %s - %s", response.status_code, response.text)
            return None
    except Exception as e:
        logger.error("TTS exception: %s", e)
        return None
