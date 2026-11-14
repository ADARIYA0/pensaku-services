# ETHOL Synchronization & Authentication — Implementation Guide

## Context & Architecture

This document outlines the technical architecture and synchronization flow between the **PENSaku** backend (Express.js + TypeScript) and the **ETHOL PENS** academic system (`https://ethol.pens.ac.id`).

> **Read `AGENTS.md` first** — Strictly follow all rules defined there: ESM Imports (`.js` extension), Layered Architecture, `authRateLimiter` protection, Type-Safety, Pino logging (no `console.log`), and consistent `{ status, message, data }` response format.

---

## How ETHOL CAS SSO Works (Verified via HAR Capture)

ETHOL uses **EEPIS CAS (Central Authentication Service)** SSO hosted at `https://login.pens.ac.id`. 

> **Important:** CAS SSO credentials require the student's **Campus NetID / Email** (e.g., `adrian@it.student.pens.ac.id`), NOT the numeric NRP. When CAS login succeeds, ETHOL's `/api/auth/validasi-token` returns the student's numeric NRP (`nipnrp`), full name (`nama`), and student ID (`nomor`).

The complete login flow:

```
Step 1 — GET CAS Login Page
  GET https://login.pens.ac.id/cas/login?service=https%3A%2F%2Fethol.pens.ac.id%2Fapi%2Fauth%2Fcas-callback
  Response: HTML form + Set-Cookie: JSESSIONID
            Hidden inputs: "lt" (login ticket), "_eventId" = "submit"

Step 2 — POST CAS Login (Submit Credentials)
  POST https://login.pens.ac.id/cas/login?service=https%3A%2F%2Fethol.pens.ac.id%2Fapi%2Fauth%2Fcas-callback
  Content-Type: application/x-www-form-urlencoded
  Cookie: JSESSIONID=<from step 1>
  Body: username=<campus_email_or_netid>&password=<pens_password>&lt=<login_ticket>&_eventId=submit&submit=LOGIN
  Response: 302 Redirect → https://ethol.pens.ac.id/api/auth/cas-callback?ticket=ST-xxxxxx-cas
            Set-Cookie: CASTGC (CAS Ticket Granting Cookie)

Step 3 — GET CAS Callback (Exchange Ticket for Tokens)
  GET https://ethol.pens.ac.id/api/auth/cas-callback?ticket=ST-xxxxxx-cas
  Response: 302 Redirect → /auth/cas
            Set-Cookie: token=<JWT_access_token>; Max-Age=900; HttpOnly; SameSite=Lax
            Set-Cookie: refresh_token=<opaque_token>; Max-Age=604800; Path=/api/auth; HttpOnly; SameSite=Lax

Step 4 — GET Token Validation (Verify and Extract Student Info)
  GET https://ethol.pens.ac.id/api/auth/validasi-token
  Cookie: token=<JWT_access_token>
  Response: { nomor, nipnrp, nama, hakAkses, iat, exp }
```

### Token Details

| Token | Type | Expiry | Purpose |
|-------|------|--------|---------|
| `token` | JWT (HS256) | 15 minutes (Max-Age=900) | Access token for ETHOL API calls |
| `refresh_token` | Opaque hex string | 7 days (Max-Age=604800) | Obtain new access tokens via `/api/auth/refresh` |
| `CASTGC` | CAS TGT | CAS session | CAS SSO session (not needed after token capture) |

### Token Refresh Mechanism
```
POST https://ethol.pens.ac.id/api/auth/refresh
Cookie: refresh_token=<stored_refresh_token>
Body: {} (empty JSON)
Response: Set-Cookie: token=<new_JWT_access_token>
```

---

## ETHOL API Endpoints (Configured in `.env`)

All remote calls use endpoint paths loaded from environment variables (see `src/config/ethol.ts`):

| Method | Endpoint | Query / Body | Description |
|--------|----------|--------------|-------------|
| GET | `/api/auth/validasi-token` | - | Validates access token and returns student profile (`nipnrp`, `nama`, `nomor`). |
| GET | `/api/auth/config` | - | Returns active academic period (`tahun_aktif`, `semester_aktif`, `tahun_ajaran_aktif`). |
| POST | `/api/auth/refresh` | `{}` | Refresh access token using refresh_token cookie. |
| GET | `/api/kuliah` | Query: `?tahun={tahun}&semester={semester}` | Automatically gets all courses taken by the student. |
| POST | `/api/kuliah/hari-kuliah-in` | `{ kuliahs: [{ nomor, jenisSchema: 4 }], tahun, semester }` | Get class schedules for student courses. |
| POST | `/api/tugas/tugas-terakhir-mahasiswa` | `{ kuliahs: [{ nomor }] }` | Get recent assignments for student courses. |
| GET | `/api/presensi/aktif-kuliah` | Query: `?kuliah={id}&jenis_schema=4` | Check active attendance session for a course. |

---

## End-to-End Synchronization Architecture

```
┌─────────────────┐       ┌─────────────────┐       ┌──────────────────────┐       ┌─────────────────┐
│  React Native   │       │ PENSaku Backend  │       │    CAS / ETHOL       │       │    Supabase     │
│  (Android App)  │       │  (Express.js)    │       │ (login.pens.ac.id)   │       │  (PostgreSQL)   │
└────────┬────────┘       └────────┬─────────┘       └──────────┬───────────┘       └────────┬────────┘
         │                         │                            │                            │
         │ 1. POST /api/ethol/link │                            │                            │
         │    { email, password }  │                            │                            │
         │────────────────────────>│                            │                            │
         │                         │ 2. Scrape CAS Login Flow   │                            │
         │                         │    & validate token        │                            │
         │                         │───────────────────────────>│                            │
         │                         │<───────────────────────────│                            │
         │                         │                            │                            │
         │                         │ 3. Encrypt & store refresh_token + email                │
         │                         │────────────────────────────────────────────────────────>│
         │                         │                                                         │
         │ 4. { status: "success" }│                                                         │
         │<────────────────────────│                                                         │
         │                         │                                                         │
         │ 5. POST /api/ethol/sync │                                                         │
         │    { email }            │                                                         │
         │────────────────────────>│ 6. Decrypt refresh_token & refresh access token        │
         │                         │                            │                            │
         │                         │ 7. GET /api/auth/config    │                            │
         │                         │   (auto tahun & semester)  │                            │
         │                         │───────────────────────────>│                            │
         │                         │<───────────────────────────│                            │
         │                         │                            │                            │
         │                         │ 8. GET /api/kuliah         │                            │
         │                         │   (auto list course IDs)   │                            │
         │                         │───────────────────────────>│                            │
         │                         │<───────────────────────────│                            │
         │                         │                            │                            │
         │                         │ 9. Fetch schedules & tasks │                            │
         │                         │───────────────────────────>│                            │
         │                         │<───────────────────────────│                            │
         │                         │                            │                            │
         │                         │ 10. Upsert courses, schedules, assignments              │
         │                         │────────────────────────────────────────────────────────>│
         │                         │                                                         │
         │ 11. Clean JSON for UI   │                                                         │
         │<────────────────────────│                                                         │
```

---

## Backend Endpoints Summary

| Method | Endpoint | Request Body / Query | Description |
|--------|----------|----------------------|-------------|
| `POST` | `/api/ethol/link` | Body: `{ email, password }` | Links student ETHOL account via CAS SSO, validates token, and stores encrypted refresh token. |
| `DELETE` | `/api/ethol/link` | Body: `{ email }` or `{ nrp }` | Unlinks student ETHOL account and invalidates session cache. |
| `POST` | `/api/ethol/sync` | Body: `{ email }` or `{ nrp }` | **100% Automatic**: Fetches active config, retrieves all course IDs automatically, syncs schedules & tasks, and stores them in Supabase. |
| `GET` | `/api/ethol/courses` | Query: `?email={email}` or `?nrp={nrp}` | Retrieves student's enrolled courses from ETHOL. |
| `GET` | `/api/ethol/config` | Query: `?email={email}` or `?nrp={nrp}` | Retrieves active academic year and semester configuration from ETHOL. |
| `GET` | `/api/ethol/validate-token`| Query: `?email={email}` or `?nrp={nrp}` | Validates if student's ETHOL session token is active. |
| `GET` | `/api/ethol/attendance` | Query: `?email={email}` or `?nrp={nrp}` | Checks active attendance session automatically across all enrolled courses. |
