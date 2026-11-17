import base64
import json
import os
import re
import urllib.request
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# Base directories
BASE_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"
UPLOADS_DIR = BASE_DIR / "uploads"
SUBMISSIONS_FILE = BASE_DIR / "submissions.json"

# Automatically load environment variables from .env if present
env_file = BASE_DIR / ".env"
if env_file.exists():
    try:
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))
    except Exception as env_err:
        print(f"Notice: Could not parse .env file: {env_err}")

# Google Apps Script Web App URL from .env or environment
GOOGLE_APPS_SCRIPT_URL = os.getenv("GOOGLE_APPS_SCRIPT_URL", "").strip()

# Ensure directories exist
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Trackbot 1.0 - EWURC Recruitment",
    description="East West University Robotics Club - Trackbot 1.0 Recruitment Form API",
)

# Mount static files & uploads
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# Configure Jinja2 templates
templates = Jinja2Templates(directory=TEMPLATES_DIR)


def save_submission(record: dict):
    """Save registration record to JSON file."""
    submissions = []
    if SUBMISSIONS_FILE.exists():
        try:
            with open(SUBMISSIONS_FILE, "r", encoding="utf-8") as f:
                submissions = json.load(f)
        except Exception:
            submissions = []

    submissions.append(record)

    with open(SUBMISSIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(submissions, f, indent=2, ensure_ascii=False)


def send_to_google_apps_script(
    data: dict, file_bytes: bytes, filename: str, mime_type: str
) -> Optional[dict]:
    """Forward applicant submission and screenshot to Google Apps Script Web App."""
    if not GOOGLE_APPS_SCRIPT_URL:
        return None

    payload = {
        "full_name": data["full_name"],
        "name": data["full_name"],
        "student_id": data["student_id"],
        "email": data["email"],
        "mail": data["email"],
        "contact_number": data["contact_number"],
        "phone": data["contact_number"],
        "experience": data["experience"],
        "transaction_id": data["transaction_id"],
        "trx": data["transaction_id"],
        "screenshot_filename": filename,
        "screenshot_mimetype": mime_type,
        "screenshot_base64": base64.b64encode(file_bytes).decode("utf-8"),
    }

    req_data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        GOOGLE_APPS_SCRIPT_URL,
        data=req_data,
        headers={"Content-Type": "application/json"},
    )

    try:
        with urllib.request.urlopen(request, timeout=35) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body)
    except Exception as exc:
        print(f"[Google Apps Script Sync Warning]: {exc}")
        return {"success": False, "error": str(exc)}


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Serve the Trackbot 1.0 recruitment form page."""
    return templates.TemplateResponse(request=request, name="index.html")


@app.get("/thank-you", response_class=HTMLResponse)
@app.get("/response", response_class=HTMLResponse)
async def response_page(request: Request):
    """Serve the thank-you confirmation page after submission."""
    return templates.TemplateResponse(request=request, name="response.html")


@app.get("/style.css", include_in_schema=False)
async def get_style():
    """Fallback route for relative style.css request."""
    return FileResponse(STATIC_DIR / "style.css", media_type="text/css")


@app.get("/script.js", include_in_schema=False)
async def get_script():
    """Fallback route for relative script.js request."""
    return FileResponse(STATIC_DIR / "script.js", media_type="application/javascript")


@app.get("/images/{image_name}", include_in_schema=False)
async def get_image(image_name: str):
    """Fallback route for relative images request."""
    img_path = STATIC_DIR / "images" / image_name
    if img_path.exists():
        return FileResponse(img_path)
    raise HTTPException(status_code=404, detail="Image not found")


@app.post("/api/register")
@app.post("/register")
async def register_applicant(
    full_name: str = Form(...),
    student_id: str = Form(...),
    email: str = Form(...),
    contact_number: str = Form(...),
    experience: str = Form(...),
    experience_other: Optional[str] = Form(None),
    transaction_id: str = Form(...),
    screenshot: UploadFile = File(...),
):
    """Handle recruitment form submission, store locally, and sync to Google Forms/Sheets."""
    full_name = full_name.strip()
    student_id = student_id.strip()
    email = email.strip()
    contact_number = contact_number.strip()
    experience = experience.strip()
    transaction_id = transaction_id.strip()

    # Determine final experience string
    final_experience = experience
    if experience == "Other" and experience_other:
        other_text = experience_other.strip()
        if other_text:
            final_experience = other_text

    # Field validations
    if not full_name:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Full Name is required."},
        )

    if not student_id:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Student Id is required."},
        )

    email_regex = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    if not re.match(email_regex, email):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "A valid personal mail address is required."},
        )

    if not contact_number or len(contact_number) < 8:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "A valid Contact Number is required."},
        )

    if not final_experience:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Previous Experience on Robotics is required."},
        )

    if not transaction_id:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Transaction ID is required."},
        )

    # Validate uploaded screenshot
    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp", ".jfif"}
    filename = screenshot.filename or "screenshot.png"
    ext = Path(filename).suffix.lower()

    if ext not in allowed_extensions:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "message": f"Unsupported file type ({ext}). Allowed: JPG, PNG, WEBP.",
            },
        )

    # Read screenshot content
    if hasattr(screenshot, "file") and hasattr(screenshot.file, "read"):
        content = screenshot.file.read()
    else:
        content = await screenshot.read()

    # Validate size (Max 5MB)
    if len(content) > 5 * 1024 * 1024:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Screenshot file size exceeds 5MB limit."},
        )

    # Sanitize and generate unique filename
    clean_id = re.sub(r"[^a-zA-Z0-9_-]", "_", student_id)
    unique_filename = f"{clean_id}_{uuid.uuid4().hex[:8]}{ext}"
    saved_file_path = UPLOADS_DIR / unique_filename

    # Save screenshot locally to disk
    with open(saved_file_path, "wb") as f:
        f.write(content)

    # Determine MIME type
    mime_type = "image/png"
    if ext in [".jpg", ".jpeg"]:
        mime_type = "image/jpeg"
    elif ext == ".webp":
        mime_type = "image/webp"

    # Forward to Google Apps Script (if configured)
    google_sync_result = None
    drive_file_url = None
    if GOOGLE_APPS_SCRIPT_URL:
        google_sync_result = send_to_google_apps_script(
            data={
                "full_name": full_name,
                "student_id": student_id,
                "email": email,
                "contact_number": contact_number,
                "experience": final_experience,
                "transaction_id": transaction_id,
            },
            file_bytes=content,
            filename=unique_filename,
            mime_type=mime_type,
        )
        if google_sync_result and google_sync_result.get("success"):
            drive_file_url = google_sync_result.get("drive_file_url")

    # Record submission details locally
    submission_record = {
        "id": str(uuid.uuid4()),
        "full_name": full_name,
        "student_id": student_id,
        "email": email,
        "contact_number": contact_number,
        "experience": final_experience,
        "transaction_id": transaction_id,
        "screenshot_local_url": f"/uploads/{unique_filename}",
        "screenshot_filename": unique_filename,
        "google_drive_url": drive_file_url,
        "google_sync": google_sync_result,
        "submitted_at": datetime.now().isoformat(),
    }

    try:
        save_submission(submission_record)
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"success": False, "message": f"Error saving application: {str(e)}"},
        )

    response_payload = {
        "success": True,
        "message": f"Application submitted successfully! Welcome, {full_name}.",
        "data": {
            "full_name": full_name,
            "student_id": student_id,
            "email": email,
            "contact_number": contact_number,
            "experience": final_experience,
            "transaction_id": transaction_id,
            "google_synced": bool(drive_file_url),
            "drive_file_url": drive_file_url,
        },
    }

    if not GOOGLE_APPS_SCRIPT_URL:
        response_payload["note"] = (
            "Recorded locally. Set GOOGLE_APPS_SCRIPT_URL in .env to sync with Google Forms & Drive."
        )

    return JSONResponse(status_code=status.HTTP_201_CREATED, content=response_payload)


@app.get("/api/submissions")
async def get_submissions():
    """Retrieve all submitted recruitment applications."""
    if not SUBMISSIONS_FILE.exists():
        return {"total": 0, "submissions": []}

    try:
        with open(SUBMISSIONS_FILE, "r", encoding="utf-8") as f:
            submissions = json.load(f)
        return {"total": len(submissions), "submissions": submissions}
    except Exception:
        return {"total": 0, "submissions": []}


@app.get("/api/google-status")
async def google_status():
    """Check connectivity with the configured Google Apps Script Web App."""
    if not GOOGLE_APPS_SCRIPT_URL:
        return {
            "configured": False,
            "message": "GOOGLE_APPS_SCRIPT_URL is not set. Check your .env file.",
        }

    try:
        with urllib.request.urlopen(GOOGLE_APPS_SCRIPT_URL, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
            return {"configured": True, "online": True, "response": data}
    except Exception as e:
        return {"configured": True, "online": False, "error": str(e)}


def main():
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)


if __name__ == "__main__":
    main()
