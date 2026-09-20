import os
import json
import re
import requests
from PIL import Image
from anya.config import key_manager
from anya.actions import (
    open_application, close_application, list_running_apps,
    send_whatsapp_message, send_email, search_google, search_youtube,
    play_youtube_video, manage_chrome_tab, see_screen, get_battery_status,
    get_volume, set_volume, take_screenshot, get_wifi_name, reveal_in_finder
)

SYSTEM_PROMPT = """You are ANYA (Bio-Artificial Intelligence Terminal), an ultra-competent, authoritative, loyal AI operating agent and executive assistant.
You address the user as "Boss".

You have direct access to macOS automation tools. When the user commands you to perform an OS action, emit a structured JSON tool block inside your response:
```json
{
  "tool": "tool_name",
  "args": { "param": "val" }
}
```

AVAILABLE BACKEND TOOLS:
1. "open_app": {"app_name": "chrome" | "vscode" | "whatsapp" | "music" | ...}
2. "close_app": {"app_name": "..."}
3. "list_apps": {}
4. "send_whatsapp": {"contact": "...", "message": "..."}
5. "send_email": {"recipient": "...", "subject": "...", "body": "...", "attachment_path": "..."}
6. "google_search": {"query": "..."}
7. "youtube_search": {"query": "..."}
8. "youtube_play": {"query": "..."}
9. "manage_chrome": {"action": "refresh" | "close" | "back" | "forward" | "open_url", "value": "..."}
10. "battery_status": {}
11. "volume_control": {"level": 70}
12. "screenshot": {"name": "..."}
13. "wifi_name": {}
14. "reveal_finder": {"path": "..."}

Be crisp, accurate, zero-fluff, and execute the commands immediately."""

def execute_action(tool_name: str, args: dict) -> str:
    """Dispatches tool call to anya/actions.py function."""
    try:
        if tool_name == "open_app":
            return open_application(args.get("app_name", ""))
        elif tool_name == "close_app":
            return close_application(args.get("app_name", ""))
        elif tool_name == "list_apps":
            return list_running_apps()
        elif tool_name == "send_whatsapp":
            return send_whatsapp_message(args.get("contact", ""), args.get("message", ""))
        elif tool_name == "send_email":
            return send_email(args.get("recipient", ""), args.get("subject", ""), args.get("body", ""), args.get("attachment_path", ""))
        elif tool_name == "google_search":
            return search_google(args.get("query", ""))
        elif tool_name == "youtube_search":
            return search_youtube(args.get("query", ""))
        elif tool_name == "youtube_play":
            return play_youtube_video(args.get("query", ""))
        elif tool_name == "manage_chrome":
            return manage_chrome_tab(args.get("action", ""), args.get("value", ""))
        elif tool_name == "battery_status":
            return str(get_battery_status())
        elif tool_name == "volume_control":
            return set_volume(args.get("level", 50))
        elif tool_name == "screenshot":
            return take_screenshot(args.get("name", ""))
        elif tool_name == "wifi_name":
            return get_wifi_name()
        elif tool_name == "reveal_finder":
            return reveal_in_finder(args.get("path", ""))
        else:
            return f"Unknown tool: {tool_name}"
    except Exception as e:
        return f"Tool execution failed: {str(e)}"

def call_gemini_backend(prompt: str, image_path: str = "") -> str:
    """Calls Gemini 2.0 Flash REST endpoint."""
    key = key_manager.get_valid_key("gemini")
    if not key:
        raise Exception("No Gemini API key available")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={key}"
    
    parts = [{"text": prompt}]
    if image_path and os.path.exists(image_path):
        import base64
        with open(image_path, "rb") as img_f:
            b64 = base64.b64encode(img_f.read()).decode("utf-8")
        parts.insert(0, {
            "inline_data": {
                "mime_type": "image/png" if image_path.endswith(".png") else "image/jpeg",
                "data": b64
            }
        })

    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 2048}
    }

    resp = requests.post(url, json=payload, timeout=20)
    if resp.status_code == 200:
        data = resp.json()
        return data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    elif resp.status_code in (429, 401):
        key_manager.mark_cooldown(key, 10)
        raise Exception(f"Gemini error {resp.status_code}")
    else:
        raise Exception(f"Gemini API returned status {resp.status_code}: {resp.text}")

def call_groq_backend(prompt: str) -> str:
    """Calls Groq Llama 3.3 REST endpoint."""
    key = key_manager.get_valid_key("groq")
    if not key:
        raise Exception("No Groq API key available")

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {key}"
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.6,
        "max_tokens": 2048
    }

    resp = requests.post(url, json=payload, headers=headers, timeout=15)
    if resp.status_code == 200:
        data = resp.json()
        return data.get("choices", [{}])[0].get("message", {}).get("content", "")
    elif resp.status_code in (429, 401):
        key_manager.mark_cooldown(key, 10)
        raise Exception(f"Groq error {resp.status_code}")
    else:
        raise Exception(f"Groq API returned status {resp.status_code}")

def think(prompt: str, image_path: str = "") -> str:
    """Executes multi-tier LLM reasoning with automated tool execution."""
    raw_response = ""
    try:
        raw_response = call_gemini_backend(prompt, image_path)
    except Exception as e:
        print(f"[ANYA Fallback to Groq]: {e}")
        try:
            raw_response = call_groq_backend(prompt)
        except Exception as e2:
            return f"Both Gemini and Groq clusters were unavailable: {str(e2)}"

    # Parse tool call if present
    tool_regex = r'```(?:json)?\s*(\{\s*"tool"[\s\S]*?\})\s*```'
    match = re.search(tool_regex, raw_response)
    if match:
        try:
            tool_data = json.loads(match.group(1))
            tool_name = tool_data.get("tool")
            args = tool_data.get("args", {})
            action_result = execute_action(tool_name, args)
            clean_reply = re.sub(tool_regex, '', raw_response).strip()
            return f"{clean_reply}\n\n[Action Completed: {action_result}]" if clean_reply else f"[Action Completed: {action_result}]"
        except Exception as e:
            print(f"Tool parse error: {e}")

    return raw_response
