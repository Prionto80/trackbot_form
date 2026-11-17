# Trackbot 1.0 — EWURC Recruitment Portal

A modern recruitment registration portal for **Trackbot 1.0**, organized by the **East West University Robotics Club (EWURC)**. Built with **FastAPI**, featuring a responsive dark glassmorphic UI, real-time image preview, local storage, and automated two-way synchronization to **Google Drive** and **Google Sheets** via **Google Apps Script**.

---

## ✨ Features

- **Cyberpunk Dark Theme**: Glassmorphism cards with glowing animated background blobs, responsive layout across desktop and mobile.
- **Brand Identity**: Integrated official East West University (`ewu.png`) and EWURC (`ewurc.png`) logos.
- **Complete Questionnaire**:
  - Full Name
  - Student Id
  - Mail Address (Personal)
  - Contact Number
  - Previous Experience on Robotics (Yes / No / Other with dynamic text specification)
  - bKash Payment Instructions (`01847128593`) with **1-click Copy** and reference tag instructions (`YourName_Trackbot`)
  - bKash / Payment Transaction ID
  - Payment Proof Screenshot upload with client-side thumbnail preview & validation (Max 5MB)
- **Automated Google Ecosystem Sync**:
  - Automatically base64-encodes and uploads payment screenshots directly into a Google Drive folder (`EWURC_Trackbot_Payment_Proofs`).
  - Automatically records responses into the connected Google Sheet (`Untitled form (Responses)`), mapping all columns dynamically.
- **Dedicated Response Page**: Smoothly redirects applicants to a `/thank-you` confirmation page summarizing their submission.
- **Redundant Local Storage**: Local copies of transaction receipts and JSON records are maintained in `uploads/` and `submissions.json`.

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.10+ (or [uv](https://github.com/astral-sh/uv))

### 2. Installation & Setup

Clone the repository:
```bash
git clone https://github.com/Prionto80/trackbot_form.git
cd trackbot_form
```

Install dependencies:
```bash
uv sync
```
*(Or install via pip: `pip install fastapi uvicorn jinja2 python-multipart`)*

### 3. Environment Configuration

Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

Add your Google Apps Script Web App URL:
```ini
GOOGLE_APPS_SCRIPT_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
```

### 4. Running the Server

Start the application with auto-reload:
```bash
uv run python main.py
```
Or directly with uvicorn:
```bash
uv run uvicorn main:app --reload
```

Open your browser at **http://127.0.0.1:8000** to view the registration form.

---

## ☁️ Google Apps Script Setup

1. Open your Google Form or Google Sheet.
2. Go to **Extensions** $\rightarrow$ **Apps Script** (or click the three dots $\rightarrow$ **Script editor**).
3. Copy the contents of [`Code.gs`](./Code.gs) and paste it into the editor.
4. Click **Deploy** $\rightarrow$ **New deployment**:
   - Select type: **Web app**
   - Description: `Trackbot 1.0 Webhook`
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Deploy and copy the Web App URL into your `.env` file.

---

## 📁 Project Structure

```
trackbot_form/
├── Code.gs             # Google Apps Script webhook for Google Drive & Sheets
├── main.py             # FastAPI backend server
├── pyproject.toml      # Project dependencies and metadata
├── .env.example        # Environment configuration template
├── templates/
│   ├── index.html      # Main registration form
│   └── response.html   # Post-submission confirmation page
└── static/
    ├── style.css       # Custom glassmorphic styles & animations
    ├── script.js       # Client-side validation, previews, and AJAX submission
    └── images/         # Club & university brand logos
```

---

## 📜 License

Created for **East West University Robotics Club (EWURC)**.
