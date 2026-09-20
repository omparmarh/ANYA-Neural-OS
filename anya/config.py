import os
import time
from pathlib import Path
from dotenv import load_dotenv

# Load local environment
load_dotenv()

# System Directories
ANYA_DIR = Path.home() / ".anya"
ANYA_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR = ANYA_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
CHATS_FILE = ANYA_DIR / "chats.json"
SCREEN_CONTEXT_PATH = ANYA_DIR / "screen_context.png"

# Default Keys Pool (loaded from environment or user settings)
DEFAULT_GEMINI_KEYS = [k.strip() for k in os.getenv("GEMINI_KEYS", "").split(",") if k.strip()]
DEFAULT_GROQ_KEYS = [k.strip() for k in os.getenv("GROQ_KEYS", "").split(",") if k.strip()]
DEFAULT_OPENROUTER_KEYS = [k.strip() for k in os.getenv("OPENROUTER_KEYS", "").split(",") if k.strip()]

DEFAULT_ELEVENLABS_KEY = os.getenv("ELEVENLABS_API_KEY", "")
DEFAULT_ELEVENLABS_VOICE = os.getenv("ELEVENLABS_VOICE_ID", "pNInz6obpgDQGcFmaJgB")

class KeyManager:
    def __init__(self):
        self.cooldowns = {} # key -> timestamp

    def parse_keys(self, env_var, defaults):
        val = os.getenv(env_var, "")
        if val.strip():
            return [k.strip() for k in val.split(",") if k.strip()]
        return defaults

    def get_valid_key(self, provider):
        if provider == "gemini":
            keys = self.parse_keys("GEMINI_KEYS", DEFAULT_GEMINI_KEYS)
        elif provider == "groq":
            keys = self.parse_keys("GROQ_KEYS", DEFAULT_GROQ_KEYS)
        elif provider == "openrouter":
            keys = self.parse_keys("OPENROUTER_KEYS", DEFAULT_OPENROUTER_KEYS)
        elif provider == "elevenlabs":
            single = os.getenv("ELEVENLABS_API_KEY", DEFAULT_ELEVENLABS_KEY)
            keys = [single] if single else []
        else:
            keys = []

        now = time.time()
        for k in keys:
            if now > self.cooldowns.get(k, 0):
                return k

        # Return the one closest to expiry
        if keys:
            return min(keys, key=lambda k: self.cooldowns.get(k, 0))
        return None

    def mark_cooldown(self, key, minutes=10):
        if key:
            self.cooldowns[key] = time.time() + (minutes * 60)
            print(f"[ANYA Backend] Key marked for cooldown: {key[:8]}... for {minutes}m")

key_manager = KeyManager()
