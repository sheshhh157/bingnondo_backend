# Bingnondo Cafe — Backend

Node.js + Express REST API covering **§ 1.1 Sign Up / OTP** and **§ 1.2 Sign In / Forgot Password / Reset Password** from the flow document.

---

## Quick Start

### 1. Install dependencies

```bash
cd bingnondo-backend
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable | What to put |
|---|---|
| `DATABASE_URL` | Optional PostgreSQL connection string. For Supabase, copy it from **Project Settings → Database → Connection string**; when set, it takes precedence over the fields below. |
| `DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD` | PostgreSQL credentials used when `DATABASE_URL` is blank |
| `JWT_ACCESS_SECRET` | Random 64-char hex string (see below) |
| `JWT_REFRESH_SECRET` | Another random 64-char hex string |
| `SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS` | Your email credentials (see below) |
| `EMAIL_FROM` | Display name + address, e.g. `"Bingnondo Cafe <no-reply@yourdomain.com>"` |

**Generate JWT secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Run twice — one for ACCESS_SECRET, one for REFRESH_SECRET.

### 3. Set up the database

Run `bingnondo_database.sql` against your PostgreSQL instance:

```bash
psql -U postgres -d bingnondo -f bingnondo_database.sql
```

After loading the base schema or a database dump that includes mobile OTP
authentication, apply `migrations/2026-11-10_remove_mobile_auth.sql` once. It
removes pending mobile-only registrations and outstanding SMS OTPs, but
preserves customer accounts and `customers.mobile_number` profile/contact data.
Existing mobile-only customer rows are preserved, but cannot sign in until an
email address is associated with the account.

### 4. Run the server

```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

Server starts on `http://localhost:3000` (or `PORT` from `.env`).

---

## Email Setup (OTP sending)

The backend uses **Nodemailer** — works with any SMTP provider.

### Option A — Gmail (easiest)
1. Enable 2-Step Verification on your Google Account
2. Go to **Security → App Passwords** → generate one for "Mail"
3. Use that 16-char App Password as `SMTP_PASS` (NOT your real Gmail password)

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=youremail@gmail.com
SMTP_PASS=abcd efgh ijkl mnop    ← the 16-char app password (spaces ok)
EMAIL_FROM="Bingnondo Cafe <youremail@gmail.com>"
```

### Option B — Brevo (free tier: 300 emails/day)
Sign up at brevo.com → SMTP & API → SMTP Keys

```
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_brevo_login_email
SMTP_PASS=your_brevo_smtp_key
```

---

## API Endpoints (§ 1.1 + § 1.2)

All endpoints are under `/api/auth`.

### Sign Up

```
POST /api/auth/customer/register
Body: { "email": "...", "password": "..." }

→ 201  { message }                         ← OTP sent to email
→ 409  Already registered. Sign in instead.
→ 422  Validation error
```

### Verify OTP (after sign-up)

```
POST /api/auth/customer/verify-otp
Body: { "email": "...", "otp": "123456", "purpose": "email_verification" }

→ 200  { message, accessToken, refreshToken, user }
→ 400  OTP expired / Incorrect OTP
→ 404  Account not found
```

### Resend OTP

```
POST /api/auth/customer/resend-otp
Body: { "email": "...", "purpose": "email_verification" }

→ 200  { message }
```

### Sign In

```
POST /api/auth/customer/login
Body: { "email": "customer@example.com", "password": "..." }

→ 200  { message, accessToken, refreshToken, user }
→ 401  Incorrect email or password
→ 403  awaiting_verification  →  "Please verify your account first."
→ 403  suspended              →  "Account suspended. Contact support."
```

#### User object returned on login / verify-otp:
```json
{
  "id": 1,
  "email": "customer@example.com",
  "email_verified": true,
  "profile_completed": false,
  "status": "active",
  "first_name": null,
  "last_name": null,
  "mobile_number": null
}
```

### Forgot Password

```
POST /api/auth/forgot-password
Body: { "email": "..." }

→ 200  { message }
→ 404  No account found with that email address.
```

### Verify Password Reset OTP

```
POST /api/auth/customer/verify-otp
Body: { "email": "...", "otp": "123456", "purpose": "password_reset" }

→ 200  { message }    ← proceed to reset-password
→ 400  OTP expired / Incorrect OTP
```

### Reset Password

```
POST /api/auth/reset-password
Body: { "email": "...", "otp": "123456", "new_password": "..." }

→ 200  { message }
→ 400  OTP expired / Incorrect OTP
→ 422  Password too short
```

---

## Rate Limiting

| Route | Limit |
|---|---|
| `/customer/login` | 5 requests / 15 min / IP (skips successful logins) |
| `/customer/register`, `/customer/resend-otp`, `/forgot-password` | 3 requests / 10 min / IP |
| `/customer/verify-otp`, `/reset-password` | 20 requests / 15 min / IP |

---

## Project Structure

```
bingnondo-backend/
├── src/
│   ├── app.js                        ← Express entry point
│   ├── config/
│   │   └── db.js                     ← PostgreSQL pool
│   ├── middleware/
│   │   ├── auth.js                   ← JWT guard (requireCustomer)
│   │   └── errorHandler.js           ← Global error handler
│   ├── modules/
│   │   └── auth/
│   │       ├── auth.controller.js    ← All auth logic
│   │       └── auth.routes.js        ← Routes + rate limiters
│   └── utils/
│       ├── jwt.js                    ← Sign / verify tokens
│       ├── mailer.js                 ← Nodemailer / OTP email
│       └── otp.js                    ← Generate + verify OTP codes
├── .env.example
├── package.json
└── README.md
```

---

## Flutter Integration

The Flutter `api_service.dart` already matches these endpoints exactly. Once the backend is running:

1. For Android emulator: `API_BASE_URL` defaults to `http://10.0.2.2:3000` ✅
2. For a real device / staging: pass `--dart-define=API_BASE_URL=https://your-backend-url.com`
3. Set `kUseMock = false` in `mock/mock_data.dart` to switch from mock to real API

---

## Next Modules (§ 1.1b + beyond)

- `modules/customer/` — `PUT /api/customer/profile` (Complete Profile, § 1.1b)
- `modules/menu/` — `GET /api/menu` (§ 1.3)
- `modules/orders/` — order creation, status flow (§ 1.5–1.6)
- `modules/payments/` — PayMongo integration (§ 2.3)
- `sockets/` — Socket.io setup for real-time updates
