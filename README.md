# Proctored Assessment Platform

Full-stack assessment platform where admins create and assign assessments, and candidates attempt them with basic browser-level proctoring.

## Stack

- **Frontend:** React (Vite) + React Router
- **Backend:** Node.js + Express
- **Database:** MongoDB
- **Auth:** JWT + role-based access (`admin` / `candidate`)

## Features (core)

- JWT login with Admin / Candidate roles
- Assessment & question management (single choice, multiple choice, short answer)
- Assign assessments to candidates
- Server-driven timer
- Autosave answers + resume after refresh
- Prevent duplicate submissions
- Objective question scoring (short answers stored, not auto-scored)
- Proctoring events: tab switch, window blur, fullscreen exit, copy, paste, right-click
- Admin submission view with score and proctoring timeline
- Ownership checks so candidates cannot access another candidate’s attempt

## Project structure

```
proctored-assessment-platform/
  backend/     Express API
  frontend/    React app
```

## Prerequisites

- Node.js 18+
- MongoDB running locally (default `mongodb://127.0.0.1:27017`)

## Local setup

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run seed
npm run dev
```

API runs at `http://localhost:5000`.

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

App runs at `http://localhost:5173`.

## Environment variables

### Backend (`backend/.env`)

| Variable | Description | Example |
|---|---|---|
| `PORT` | API port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/proctored_assessment` |
| `JWT_SECRET` | Secret for signing tokens | long random string |
| `JWT_EXPIRES_IN` | Token lifetime | `8h` |
| `CLIENT_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |

### Frontend (`frontend/.env`)

| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Backend API base URL | `http://localhost:5000/api` |

## Database setup & seed

1. Start MongoDB locally.
2. From `backend/`, run `npm run seed`.

This clears previous seed data and creates sample users, one published assessment with 3 questions, and assignments for both candidates.

## Sample login credentials

Password for all accounts: `Password123!`

| Role | Email |
|---|---|
| Admin | `admin@example.com` |
| Candidate | `alice@example.com` |
| Candidate | `bob@example.com` |

## Main flows to demo

### Admin

1. Login as `admin@example.com`
2. Create / open an assessment
3. Add questions, configure proctoring toggles, publish
4. Assign to candidates
5. After a candidate submits, open **Submissions → View** for score + proctoring timeline

### Candidate

1. Login as `alice@example.com`
2. Start assigned assessment
3. Answer questions (autosave runs every 15s; use **Save now** anytime)
4. Refresh the page — attempt resumes with saved answers and remaining time from server
5. Trigger proctoring events (switch tab, blur window, copy/paste/right-click)
6. Submit once — second submit is rejected

## API overview

| Method | Path | Access |
|---|---|---|
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Auth |
| GET/POST | `/api/assessments` | Admin |
| PATCH | `/api/assessments/:id` | Admin |
| POST/PATCH/DELETE | `/api/assessments/:id/questions...` | Admin |
| POST | `/api/assessments/:id/assign` | Admin |
| GET | `/api/assessments/:id/submissions` | Admin |
| GET | `/api/attempts/mine` | Candidate |
| POST | `/api/attempts/start` | Candidate |
| GET | `/api/attempts/:id` | Owner or Admin |
| PUT | `/api/attempts/:id/answers` | Candidate owner |
| GET | `/api/attempts/:id/timer` | Owner or Admin |
| POST | `/api/attempts/:id/submit` | Candidate owner |
| POST | `/api/attempts/:id/proctoring-events` | Candidate owner |

## Assumptions / known limitations

- Short-answer questions are **not** auto-scored.
- Auto-submit on timer expiry, violation limits, negative marking, unit tests, and Docker are **not** included in the core build (good-to-have).
- Proctoring is browser-event based (not webcam / AI monitoring).
- Deployment is not required; run locally via README instructions.

## Architecture (brief)

- **Users** with role (`admin` / `candidate`)
- **Assessments** embed questions + proctoring rule flags
- **Assignments** link assessment ↔ candidate (unique pair)
- **Attempts** store answers, server `endsAt` timer, status, score — unique per assignment
- **ProctoringEvents** append-only timeline per attempt
- JWT middleware + role checks; candidate routes also verify attempt ownership
