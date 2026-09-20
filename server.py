import os
import json
import uuid
import asyncio
from typing import Optional
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel

from anya.config import ANYA_DIR, UPLOADS_DIR, CHATS_FILE, SCREEN_CONTEXT_PATH
from anya.brain import think
from anya.voice import speak_text, stop_speech
from anya.actions import get_battery_status, stop_all_actions

app = FastAPI(
    title="ANYA Neural OS Daemon",
    version="2.0.0-universal",
    description="Cross-platform Autonomous AI Assistant Server"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    file_path: Optional[str] = None

@app.get("/status")
@app.get("/health")
def health_check():
    return {
        "status": "online",
        "system": "ANYA Neural OS",
        "version": "2.0.0-universal",
        "platform": "darwin" if os.name != "nt" else "windows"
    }

@app.post("/chat")
async def chat_endpoint(req: ChatRequest, background_tasks: BackgroundTasks):
    """Processes chat request with multi-cluster brain and background audio."""
    conv_id = req.conversation_id or str(uuid.uuid4())
    img_path = ""

    if req.file_path and os.path.exists(req.file_path):
        img_path = req.file_path

    # Generate response
    reply = think(req.message, img_path)

    # Trigger background speech synthesis
    background_tasks.add_task(speak_text, reply)

    return {
        "reply": reply,
        "conversation_id": conv_id,
        "status": "success"
    }

@app.post("/upload")
async def upload_endpoint(file: UploadFile = File(...)):
    """Receives file upload and stores in ~/.anya/uploads/."""
    try:
        suffix = Path(file.filename).suffix
        unique_name = f"{uuid.uuid4()}{suffix}"
        dest_path = UPLOADS_DIR / unique_name

        content = await file.read()
        with open(dest_path, "wb") as f:
            f.write(content)

        return {
            "status": "success",
            "file_path": str(dest_path),
            "original_name": file.filename
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/system/battery")
def get_battery():
    """Returns battery metrics."""
    return get_battery_status()

@app.post("/stop")
def stop_all():
    """Emergency kill switch for all actions and speech audio."""
    stop_speech()
    res = stop_all_actions()
    return {"status": "stopped", "message": res}

@app.get("/debug/screen")
def get_screen_capture():
    """Returns the latest screenshot context file."""
    if SCREEN_CONTEXT_PATH.exists():
        return FileResponse(str(SCREEN_CONTEXT_PATH))
    raise HTTPException(status_code=404, detail="No screen context found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
