## School Notice Board Website/App – Report

### 1) Requirements Gathering
- Audience: School students, parents, teachers, admin staff
- Goals: Publish time-bound notices (events, exams, holidays), provide important contacts (principal, office), keep UI simple and mobile-friendly
- Constraints: Low maintenance, no paid services, offline-friendly (single file DB), basic admin auth
- Non-features: No comments, no heavy media galleries, no complex roles beyond admin

### 2) Design Choices
- Information Architecture: Home (latest notices), All Notices (filter by category), Notice Detail, Contacts, Admin (login, dashboard)
- Usability: Clear list layouts, categories as badges, minimal fields, attachment download
- Security: Session-based auth, bcrypt hashes, `helmet` middleware; default credentials overridden via `.env`

### 3) Platform/Technology Used
- Backend: Node.js (Express 4)
- Views: EJS templates
- Data Store: SQLite (file-based), via `sqlite3`
- Sessions: `express-session` with `connect-sqlite3`
- Uploads: `multer` (images/PDF up to 5 MB)
- Utilities: `dayjs`, `morgan`, `helmet`

### 4) Development Process
- Initialize Node app and dependencies
- Model schema: `users`, `notices`, `contacts`
- Implement routes: public (home, notices, detail, contacts), admin (login/logout, dashboard, CRUD notices/contacts)
- Create EJS views and a simple CSS theme
- Seed default admin from `.env` at first run

### 5) Features Implemented
- Public: latest notices, category filter, notice details with optional attachment, contacts
- Admin: login/logout, dashboard counters, create/edit/delete notices (publish toggle), manage contacts

### 6) Promotion Plan
- Share link via school WhatsApp groups and SMS; print QR on notice board
- Announce URL at assembly and parent-teacher meetings
- Add link on school website and email footers

### 7) Maintenance
- Weekly: review notices, unpublish outdated items
- Monthly: export DB file backup from `db/app.sqlite`
- Credentials rotation each term; keep `.env` secure

### 8) Live Link
- Add deployment URL here: <your-hosted-url>


