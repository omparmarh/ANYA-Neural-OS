import os
import subprocess
import tempfile
import requests
import json
from anya.config import key_manager, DEFAULT_ELEVENLABS_VOICE

active_audio_process = None

def stop_speech():
    """Immediately terminates any running speech audio process."""
    global active_audio_process
    if active_audio_process:
        try:
            active_audio_process.terminate()
            active_audio_process = None
        except Exception:
            pass
    subprocess.run(["killall", "afplay", "say"], capture_output=True)

def speak_text(text: str, voice_id: str = None) -> bool:
    """Streams audio from ElevenLabs Turbo v2 or falls back to macOS say."""
    global active_audio_process
    stop_speech()

    # Clean text from JSON blocks and markdown
    import re
    clean_text = re.sub(r'```[\s\S]*?```', '', text)
    clean_text = re.sub(r'[*_#`~[\]()]', '', clean_text).strip()
    if not clean_text:
        return False

    key = key_manager.get_valid_key("elevenlabs")
    vid = voice_id or os.getenv("ELEVENLABS_VOICE_ID", DEFAULT_ELEVENLABS_VOICE)

    if key:
        try:
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{vid}/stream"
            headers = {
                "Accept": "audio/mpeg",
                "Content-Type": "application/json",
                "xi-api-key": key
            }
            data = {
                "text": clean_text[:1200],
                "model_id": "eleven_turbo_v2_5",
                "voice_settings": {
                    "stability": 0.50,
                    "similarity_boost": 0.85,
                    "style": 0.30
                }
            }

            resp = requests.post(url, json=data, headers=headers, stream=True, timeout=10)
            if resp.status_code == 200:
                with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
                    for chunk in resp.iter_content(chunk_size=1024):
                        if chunk:
                            f.write(chunk)
                    temp_path = f.name

                active_audio_process = subprocess.Popen(["afplay", temp_path])
                return True
            elif resp.status_code in (401, 429):
                key_manager.mark_cooldown(key, 10)
        except Exception as e:
            print(f"[ANYA Voice Error]: {e}")

    # Fallback to native macOS say
    try:
        active_audio_process = subprocess.Popen(["say", "-v", "Samantha", "-r", "185", clean_text])
        return True
    except Exception:
        return False
