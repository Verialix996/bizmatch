# BizMatch

A matchmaking platform for entrepreneurs and investors.

---

## Requirements

- [Node.js](https://nodejs.org) v18 or higher
- [npm](https://www.npmjs.com)
- [Expo Go](https://expo.dev/go) app installed on your phone (Android or iOS)

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/Verialix996/bizmatch.git
cd bizmatch/app
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

```bash
cd ../frontend
npm install
```

Open `src/services/api.js` and set `API_URL` to your machine's local IP address:

```js
const API_URL = 'http://YOUR_LOCAL_IP:3000/api';
```

To find your local IP:
- **Windows:** run `ipconfig` in terminal → look for IPv4 Address
- **Mac/Linux:** run `ifconfig` or `ip a` → look for inet address

Start the frontend:

```bash
npx expo start --clear
```

Scan the QR code with the Expo Go app on your phone. Make sure your phone and computer are on the **same WiFi network**.

---

## Project Structure

```
app/
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
