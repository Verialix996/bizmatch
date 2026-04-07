# BizMatch

A matchmaking platform for entrepreneurs and investors.

---

## Requirements

- [Node.js](https://nodejs.org) v18 or higher
- [npm](https://www.npmjs.com)
- [Expo Go](https://expo.dev/go) app installed on your phone (Android or iOS)

---

## Windows Setup

> **Recommended:** Use [Git Bash](https://gitforwindows.org/) (installed with Git for Windows) — it lets you follow the exact same commands as below without any changes.
>
> If you prefer **PowerShell**, the only differences are noted inline.

### 1. Install prerequisites

- [Node.js](https://nodejs.org) v18 or higher (includes npm)
- [Git for Windows](https://gitforwindows.org/) — includes Git Bash

### 2. Clone the repository

Open **Git Bash** (or PowerShell) and run:

```bash
git clone https://github.com/Verialix996/bizmatch.git
cd bizmatch
```

### 3. Backend

```bash
cd backend
npm install
```

Copy the example environment file:

- **Git Bash:**
  ```bash
  cp .env.example .env
  ```
- **PowerShell / Command Prompt:**
  ```powershell
  copy .env.example .env
  ```

Open `.env` in Notepad or any text editor and fill in the required values (see table below).

Run migrations and start the backend:

```bash
npm run migrate
npm run dev
```

### 4. Frontend

Open a **second** Git Bash / PowerShell window:

```bash
cd frontend
npm install
npx expo start --clear
```

Scan the QR code with the Expo Go app. Your phone and PC must be on the **same WiFi network**.

### 5. Verify (Windows PowerShell)

The `curl` command in PowerShell works differently. Use this instead:

```powershell
Invoke-WebRequest http://localhost:3000/health | Select-Object -ExpandProperty Content
```

Or install [curl for Windows](https://curl.se/windows/) and use the standard curl commands as shown below.

---

## Setup (macOS / Linux)

### 1. Clone the repository

```bash
git clone https://github.com/Verialix996/bizmatch.git
cd bizmatch
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and fill in the required values:

| Variable | Description |
|---|---|
| `JWT_SECRET` | Any long random string |
| `GMAIL_USER` | Your Gmail address |
| `GMAIL_APP_PASSWORD` | Gmail app password (see below) |

**Getting a Gmail App Password:**
1. Go to [myaccount.google.com](https://myaccount.google.com) → Security
2. Enable 2-Step Verification
3. Search for "App Passwords" → create one → copy the 16-character code

Run the database migrations (creates the local SQLite database):

```bash
npm run migrate
```

Start the backend:

```bash
npm run dev
```

The server will run on `http://localhost:3000`.

---

### 3. Frontend

Open a second terminal:

```bash
cd frontend
npm install
npx expo start --clear
```

Scan the QR code with the Expo Go app on your phone.

> **Important:** Your phone and computer must be on the **same WiFi network**. The app automatically detects the correct IP — no manual configuration needed.

---

## Verify Everything is Working

With the backend running, test the API:

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{"status":"ok"}
```

Test registration:
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","name":"Test","password":"12345678","role":"entrepreneur"}'
```

Expected response:
```json
{"message":"Registered. Check your email for the verification code."}
```

---

## Project Structure

```
bizmatch/
├── backend/
│   ├── migrations/        # Database setup scripts
│   ├── src/
│   │   ├── config/        # Database and OAuth configuration
│   │   ├── controllers/   # Route logic
│   │   ├── middleware/     # Auth, rate limiting, error handling
│   │   ├── models/        # Database queries
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Email service
│   │   └── utils/         # Logger
│   ├── .env.example       # Environment variable template
│   └── server.js          # Entry point
└── frontend/
    ├── src/
    │   ├── navigation/    # App navigation
    │   ├── screens/       # App screens
    │   ├── services/      # API calls
    │   └── store/         # State management
    └── App.js             # Entry point
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/verify-email` | Verify OTP code |
| POST | `/api/auth/resend-otp` | Resend OTP |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password |
| POST | `/api/auth/2fa/setup` | Setup 2FA |
| POST | `/api/auth/2fa/verify` | Verify 2FA |
| GET | `/api/profile` | Get my profile |
| POST | `/api/profile` | Create profile |
| PUT | `/api/profile` | Update profile |
| DELETE | `/api/users/me` | Delete account |

---

## Notes

- The database is a local SQLite file stored at `backend/data/bizmatch.db` — it is not committed to the repository
- Never commit your `.env` file
- Google and LinkedIn OAuth credentials are optional for local development
