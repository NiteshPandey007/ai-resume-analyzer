# 📄 AI Resume Analyzer

AI-powered resume tool with **Analyzer**, **ATS Download**, **Resume Builder**, and **Admin Panel**.

## Features
- Upload PDF/DOCX → Get AI score, ATS check, skill gaps
- Download ATS-optimized PDF + DOCX from your existing resume
- Build a new resume from scratch → AI enhances it → ATS-safe download
- History saved in localStorage (browser)
- Admin panel: view all uploaded resumes, stats, delete

## Stack
- Frontend: React + Vite (Vercel)
- Backend: Node.js + Express (Render)
- AI: Anthropic Claude
- PDF: pdfkit | DOCX: docx npm package

## Local Setup

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Fill ANTHROPIC_API_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Deploy: Vercel + Render

### Backend (Render)
- Root: `backend`
- Build: `npm install`
- Start: `npm start`
- Env vars:
  ```
  ANTHROPIC_API_KEY=sk-ant-...
  JWT_SECRET=random_string
  ADMIN_EMAIL=admin@resumeai.com
  ADMIN_PASSWORD=Admin@123
  FRONTEND_URL=https://your-app.vercel.app
  ```

### Frontend (Vercel)
- Root: `frontend`
- Framework: Vite
- Env vars:
  ```
  VITE_API_URL=https://your-backend.onrender.com
  ```

## Admin Panel
Go to the app → click ⚙ Admin → login with ADMIN_EMAIL + ADMIN_PASSWORD

**Note:** Resume store is in-memory. Restarting backend clears stored resumes (but localStorage history on browser stays).
