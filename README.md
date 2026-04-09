# BizMatch

A matchmaking platform for entrepreneurs and investors.

**Backend:** Live on Railway → `https://zooming-surprise-production.up.railway.app`
**Frontend:** Expo (React Native) — run locally, connects to Railway from any network

---

## Features

### Authentication
- Email & password registration with OTP email verification
- Login with JWT session management
- Forgot password / reset password via email link
- Google OAuth sign-in
- Two-factor authentication (2FA) setup and verification

### Profiles
- Role selection: Entrepreneur or Investor
- Entrepreneur profile: bio, skills (bubble tags), venture stage, funding needs
- Investor profile: bio, skills (bubble tags), investment domain, preferred stage, max investment
- Change role at any time from Account Settings (profile resets to new role)
- Edit profile at any time

### Swipe & Matching
- Tinder-style swipe deck — swipe right to like, left to pass
- Entrepreneurs can toggle between "Find Investors" and "Find Partners" modes
- Investors see entrepreneur project cards
- Scored feed: matches ranked by stage alignment, budget fit, and domain overlap
- Passed profiles recycle back when all fresh profiles are exhausted
- Match celebration modal on mutual like with option to message immediately
- Profile updates re-enter the user into the match pool

### Projects
- Entrepreneurs can create and manage projects
- Project cards include title, description, industry, stage, funding needed
- Optional pitch deck and demo video links
- Investors swipe on project cards

### Messaging
- Chat screen for every mutual match
- Real-time message updates via polling
- Date dividers and message timestamps
- Auto-scrolls to latest message

### Design & Navigation
- Custom Ionicons tab bar (compass, chat bubbles, folder, person circle)
- Active/inactive icon states
- BizMatch logo header consistent across all tabs
- Notification badge on Matches tab showing new matches + unread messages
- Unread blue dot per conversation, clears automatically after opening the chat
- Responsive layout for iPhone 15 (393pt) and other screen sizes

### Account
- Change role from Account Settings
- Change account details
- Delete account
- Privacy settings

---

## Upcoming Features

### Profile Photo Upload
Cloud storage integration (S3 or Cloudinary) is needed before photos can be persisted — Railway's ephemeral filesystem loses uploaded files on every redeploy. The backend endpoint is already built; the frontend shows a "Coming Soon" placeholder.

---

## Testing the App

### What you need
- [Node.js](https://nodejs.org) v18 or higher
- [Expo Go](https://expo.dev/go) installed on your phone (Android or iOS)
- Any WiFi or mobile data — **no need to be on the same network as the backend**

### Steps

1. **Clone the repo**
   ```bash
   git clone https://github.com/Verialix996/bizmatch.git
   cd bizmatch
   ```

2. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Start the frontend**
   ```bash
   npx expo start --clear
   ```

4. **Open in Expo Go**
   - Scan the QR code shown in the terminal with the Expo Go app
   - The app will load and connect to the live Railway backend automatically

That's it — no backend setup needed for testing. The backend is already deployed.

### Verify the backend is live

```bash
curl https://zooming-surprise-production.up.railway.app/health
```

Expected response:
```json
{"status":"ok"}
```

### Test registration via API

```bash
curl -X POST https://zooming-surprise-production.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User","password":"12345678"}'
```

Expected response:
```json
{"message":"Registered. Check your email for the verification code."}
```

---

## Running the Backend Locally (optional)

Only needed if you want to develop or test backend changes locally.

### Prerequisites
- [MySQL](https://dev.mysql.com/downloads/installer/) installed and running locally
- A MySQL database named `bizmatch` (the migration runner creates it automatically)

### Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Description |
|---|---|
| `DATABASE_URL` | `mysql://root:<password>@localhost:3306/bizmatch` |
| `JWT_SECRET` | Any long random string |
| `GMAIL_USER` | Your Gmail address |
| `GMAIL_APP_PASSWORD` | Gmail app password (see below) |

**Getting a Gmail App Password:**
1. Go to [myaccount.google.com](https://myaccount.google.com) → Security
2. Enable 2-Step Verification
3. Search for "App Passwords" → create one → copy the 16-character code

Start the backend (migrations run automatically on startup):

```bash
npm run dev
```

The server will run on `http://localhost:3000`.

To point the frontend at your local backend instead of Railway, edit `frontend/src/services/api.js`:
```js
const API_URL = 'http://localhost:3000/api'; // or your local IP
```

---

## Project Structure

```
bizmatch/
├── backend/
│   ├── migrations/        # MySQL schema files (run automatically on startup)
│   ├── scripts/           # One-time utility scripts
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
| POST | `/api/auth/reset-password` | Reset password with token |
| POST | `/api/auth/2fa/setup` | Setup 2FA |
| POST | `/api/auth/2fa/verify` | Verify 2FA |
| GET | `/api/profile` | Get my profile |
| POST | `/api/profile` | Create profile (upserts if exists) |
| PUT | `/api/profile` | Update profile |
| PATCH | `/api/users/me/role` | Change role |
| POST | `/api/users/me/photo` | Upload profile photo (coming soon) |
| DELETE | `/api/users/me` | Delete account |
| GET | `/api/match/feed` | Get swipe feed |
| POST | `/api/match/swipe` | Record a swipe |
| GET | `/api/messages/conversations` | Get all match conversations |
| GET | `/api/messages/:matchId` | Get messages for a match |
| POST | `/api/messages/:matchId` | Send a message |
| GET | `/api/projects` | Get my projects |
| POST | `/api/projects` | Create a project |
| PUT | `/api/projects/:id` | Update a project |
| DELETE | `/api/projects/:id` | Delete a project |

---

## Deployment

The backend is deployed on [Railway](https://railway.app) and auto-deploys on every push to `master`.

- **Database:** MySQL on Railway
- **Node.js service:** root directory `backend/`, start command `node server.js`
- **Schema migrations** run automatically on every startup (idempotent)

## Notes

- Never commit your `.env` file
- Google OAuth credentials are optional — the app works without them
- Uploaded files are not persisted across Railway redeploys (ephemeral filesystem)
