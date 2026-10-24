# Campus Lost & Found Portal

A responsive college Lost & Found web app built with HTML, CSS, vanilla JavaScript, Node.js, Express, Multer and MySQL.

## Features in this starter project

- Browse Lost and Found reports
- Search item name, description, category and location
- Filter by report type, category and status
- Submit reports with an optional image upload
- Store report details in MySQL
- Display contact details for follow-up
- Update an item's status through the API
- Basic request validation, parameterized SQL queries, upload size/type limits and Helmet headers

## Requirements

- Node.js LTS and npm
- MySQL Server
- VS Code

## 1. Create the database

Open MySQL Workbench or the MySQL command-line client and run all SQL in `database/campus_lost_found.sql`.

Command-line alternative (Windows, if `mysql` is on PATH):

```bash
mysql -u root -p < database/campus_lost_found.sql
```

Enter your MySQL password when prompted.

## 2. Configure environment

Copy `.env.example` to `.env`. On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and enter the MySQL password you use locally. Keep `.env` private; do not commit it to Git.

## 3. Install packages

Open the project folder in VS Code, open Terminal → New Terminal, then run:

```bash
npm install
```

## 4. Start the server

```bash
npm start
```

Open <http://localhost:3000> in your browser. Check <http://localhost:3000/api/health> to confirm the server can connect to MySQL.

For development with automatic restarts on supported Node versions:

```bash
npm run dev
```

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check server and database |
| GET | `/api/items` | List reports |
| GET | `/api/items?type=LOST` | Filter Lost reports |
| GET | `/api/items?category=Books` | Filter category |
| GET | `/api/items?search=library` | Search reports |
| GET | `/api/items/:id` | Get one report |
| POST | `/api/items` | Submit report (`multipart/form-data`) |
| PATCH | `/api/items/:id/status` | Change status |

Example status update body:

```json
{ "status": "RESOLVED" }
```

## Important limitations / before real deployment

This is a local college-project starter, not a production-ready public service. The status-update endpoint is intentionally simple for local demonstration and has **no authentication or authorization**; do not expose it to the public internet. Add login, roles, ownership checks, CSRF protection and moderation before deployment. Contact information is currently visible on the listing page, so use demo data during testing and protect personal contact details in a real deployment. Uploaded images are checked by declared MIME type and size; production deployments should also inspect file contents, re-encode images, rate-limit uploads and scan files. Back up the database and uploads directory.
