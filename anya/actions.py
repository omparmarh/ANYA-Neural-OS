import os
import subprocess
import time
import urllib.parse
import json
import re
from pathlib import Path
from anya.config import SCREEN_CONTEXT_PATH

# Application Aliases Map
APP_ALIASES = {
    "vscode": "Visual Studio Code",
    "code": "Visual Studio Code",
    "chrome": "Google Chrome",
    "browser": "Google Chrome",
    "music": "Music",
    "spotify": "Spotify",
    "notes": "Notes",
    "facetime": "FaceTime",
    "word": "Microsoft Word",
    "excel": "Microsoft Excel",
    "powerpoint": "Microsoft PowerPoint",
    "crunchyroll": "Crunchyroll",
    "netflix": "Netflix",
    "terminal": "Terminal",
    "finder": "Finder",
    "messages": "Messages",
    "whatsapp": "WhatsApp",
    "mail": "Mail",
    "calculator": "Calculator",
    "calendar": "Calendar",
    "photos": "Photos",
}

def run_applescript(script: str) -> str:
    """Executes AppleScript via osascript and returns output."""
    try:
        res = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
            timeout=15
        )
        if res.returncode != 0:
            return f"FAIL: {res.stderr.strip()}"
        return res.stdout.strip()
    except Exception as e:
        return f"ERROR: {str(e)}"

def open_application(app_name: str) -> str:
    """Launches app by name with alias resolution and fallback."""
    resolved = APP_ALIASES.get(app_name.lower().strip(), app_name)
    try:
        # Step 1: Direct open
        res = subprocess.run(["open", "-a", resolved], capture_output=True, text=True)
        if res.returncode == 0:
            return f"Successfully opened {resolved}."
        
        # Step 2: Web redirects fallback
        web_services = {
            "youtube": "https://youtube.com",
            "netflix": "https://netflix.com",
            "crunchyroll": "https://crunchyroll.com",
            "chatgpt": "https://chatgpt.com",
            "gemini": "https://gemini.google.com",
        }
        if app_name.lower().strip() in web_services:
            subprocess.run(["open", web_services[app_name.lower().strip()]])
            return f"Opened web version of {app_name}."

        # Step 3: Spotlight fallback
        run_applescript(f'''
            tell application "System Events"
                key code 49 using command down
                delay 0.5
                keystroke "{resolved}"
                delay 0.5
                key code 36
            end tell
        ''')
        return f"Launched {resolved} via Spotlight."
    except Exception as e:
        return f"Failed to open {app_name}: {str(e)}"

def close_application(app_name: str) -> str:
    """Closes application via AppleScript."""
    resolved = APP_ALIASES.get(app_name.lower().strip(), app_name)
    return run_applescript(f'tell application "{resolved}" to quit')

def list_running_apps() -> str:
    """Returns comma-separated visible running applications."""
    return run_applescript('tell application "System Events" to get name of every application process whose background only is false')

def send_whatsapp_message(contact: str, message: str) -> str:
    """Sends WhatsApp message via URL scheme or UI automation."""
    clean_phone = re.sub(r'[^0-9+]', '', contact)
    encoded_msg = urllib.parse.quote(message)

    if len(clean_phone) >= 7:
        # Launch direct URL scheme
        url = f"whatsapp://send?phone={clean_phone}&text={encoded_msg}"
        subprocess.run(["open", url])
        time.sleep(2.0)
        run_applescript('''
            tell application "WhatsApp" to activate
            tell application "System Events" to key code 36
        ''')
        return f"Sent WhatsApp message to {clean_phone}."

    # UI Scripting Fallback
    script = f'''
        tell application "WhatsApp" to activate
        delay 1.0
        tell application "System Events"
            keystroke "n" using command down
            delay 1.0
            keystroke "{contact}"
            delay 1.5
            key code 36
            delay 0.5
            key code 48
            key code 36
            delay 0.5
            keystroke "{message}"
            delay 0.5
            key code 36
        end tell
    '''
    return run_applescript(script)

def send_email(recipient: str, subject: str, body: str, attachment_path: str = "") -> str:
    """Creates and sends email in Apple Mail with attachments."""
    attachment_script = ""
    if attachment_path and os.path.exists(attachment_path):
        abs_path = os.path.abspath(attachment_path)
        attachment_script = f'''
            set theAttachment to (POSIX file "{abs_path}") as alias
            make new attachment with properties {{file name:theAttachment}} at after the last paragraph
        '''

    script = f'''
        tell application "Mail"
            set newMessage to make new outgoing message with properties {{subject:"{subject}", content:"{body}\n\n", visible:true}}
            tell newMessage
                make new to recipient at end of to recipients with properties {{address:"{recipient}"}}
                {attachment_script}
            end tell
            delay 1.5
            send newMessage
        end tell
    '''
    return run_applescript(script)

def search_google(query: str) -> str:
    """Opens Google Chrome and searches Google."""
    q = urllib.parse.quote(query)
    url = f"https://www.google.com/search?q={q}"
    subprocess.run(["open", "-a", "Google Chrome", url])
    return f"Searched Google for '{query}'."

def search_youtube(query: str) -> str:
    """Searches YouTube in Chrome."""
    q = urllib.parse.quote(query)
    url = f"https://www.youtube.com/results?search_query={q}"
    subprocess.run(["open", "-a", "Google Chrome", url])
    return f"Searched YouTube for '{query}'."

def play_youtube_video(query: str) -> str:
    """Searches and autoplays top YouTube match in Chrome via DOM selector."""
    search_youtube(query)
    time.sleep(3.0)
    js = '''
        const selectors = ["ytd-video-renderer a#video-title", "a#video-title-link", "#video-title", "ytd-thumbnail a"];
        for (let s of selectors) {
            const el = document.querySelector(s);
            if (el) { el.click(); break; }
        }
    '''
    run_applescript(f'''
        tell application "Google Chrome"
            execute front window's active tab javascript "{js}"
        end tell
    ''')
    return f"Autoplaying YouTube video for '{query}'."

def manage_chrome_tab(action: str, value: str = "") -> str:
    """Navigates, refreshes, or controls frontmost Chrome tab."""
    if action == "refresh":
        return run_applescript('tell application "Google Chrome" to reload active tab of front window')
    elif action == "close":
        return run_applescript('tell application "Google Chrome" to close active tab of front window')
    elif action == "back":
        return run_applescript('tell application "Google Chrome" to go back active tab of front window')
    elif action == "forward":
        return run_applescript('tell application "Google Chrome" to go forward active tab of front window')
    elif action == "open_url" and value:
        return run_applescript(f'tell application "Google Chrome" to set URL of active tab of front window to "{value}"')
    return "Action executed."

def see_screen() -> str:
    """Captures silent screenshot to screen_context.png for vision feedback."""
    try:
        subprocess.run(["screencapture", "-x", str(SCREEN_CONTEXT_PATH)])
        return str(SCREEN_CONTEXT_PATH)
    except Exception as e:
        return f"Error capturing screen: {str(e)}"

def get_battery_status() -> dict:
    """Reads battery percentage and charging state via pmset."""
    try:
        res = subprocess.run(["pmset", "-g", "batt"], capture_output=True, text=True)
        out = res.stdout
        pct_match = re.search(r'(\d+)%', out)
        charging = "charging" in out.lower() or "ac attached" in out.lower()
        pct = int(pct_match.group(1)) if pct_match else 100
        return {"percentage": pct, "charging": charging, "raw": out}
    except Exception:
        return {"percentage": 100, "charging": False, "raw": "Unavailable"}

def get_volume() -> int:
    """Returns current system volume 0-100."""
    res = run_applescript("output volume of (get volume settings)")
    try:
        return int(res)
    except Exception:
        return 50

def set_volume(level: int) -> str:
    """Sets system output volume (0-100)."""
    clamped = max(0, min(100, int(level)))
    return run_applescript(f"set volume output volume {clamped}")

def take_screenshot(name: str = "") -> str:
    """Takes full screen snapshot and saves to Desktop."""
    clean_name = name.strip() if name.strip() else f"screenshot_{int(time.time())}"
    desktop_path = Path.home() / "Desktop" / f"{clean_name}.png"
    subprocess.run(["screencapture", "-x", str(desktop_path)])
    return f"Screenshot saved to Desktop as {clean_name}.png"

def get_wifi_name() -> str:
    """Detects current Wi-Fi network SSID."""
    try:
        res = subprocess.run(["networksetup", "-getairportnetwork", "en0"], capture_output=True, text=True)
        if "Current Wi-Fi Network:" in res.stdout:
            return res.stdout.replace("Current Wi-Fi Network:", "").strip()
        # Fallback
        res2 = subprocess.run(["ipconfig", "getsummary", "en0"], capture_output=True, text=True)
        m = re.search(r'SSID\s*:\s*(.+)', res2.stdout)
        if m:
            return m.group(1).strip()
    except Exception:
        pass
    return "Connected"

def reveal_in_finder(path: str) -> str:
    """Reveals file or directory in macOS Finder."""
    abs_path = os.path.abspath(os.path.expanduser(path))
    subprocess.run(["open", "-R", abs_path])
    return f"Revealed {abs_path} in Finder."

def stop_all_actions() -> str:
    """Panic button: Kills running automation processes."""
    subprocess.run(["killall", "osascript", "afplay", "say"], capture_output=True)
    return "Terminated all active scripts and audio playback."
