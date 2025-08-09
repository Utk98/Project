# School Notice Board

Node.js (Express 4) + EJS + SQLite app for school announcements, contacts, and a buy/sell/rent marketplace with role-based access (admin, user).

## Features
- Public: latest notices, notices with category filter, notice details, contacts
- Admin: login, dashboard, CRUD for notices and contacts
- Users: register/login, create/edit/delete marketplace posts (buy/sell/rent/general)
- Attachments: image thumbnails and PDF support

## Getting Started
```bash
cp .env.example .env
npm install
npm run dev
# open http://localhost:3000
```
Default admin: `admin` / `admin123` (change in `.env`).

## Environment
- `PORT` (default 3000)
- `SESSION_SECRET` (random string)
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`

## Deploy
- Vercel: included `vercel.json` and serverless entry `api/index.js`
- Set env vars: `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`
- SQLite path on Vercel uses `/tmp/app.sqlite` (ephemeral; not persistent)
- For persistent DB/uploads, use a VM/VPS (Render/Railway) or external DB/storage

## Docs
- `docs/report.md` – 4-page report
- `docs/admin-guide.md` – admin usage
- `docs/daily-log.md` – daily work log
