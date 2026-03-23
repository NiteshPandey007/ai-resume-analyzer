require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const PDFDocument = require('pdfkit');
const jwt = require('jsonwebtoken');
const { Document, Packer, Paragraph, TextRun, AlignmentType, LevelFormat, BorderStyle } = require('docx');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'resumeai_secret_change_this';

// ── CORS ──────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://ai-resume-analyzer-psi-rouge.vercel.app/',
  'https://ai-resume-analyzer-psi-rouge.vercel.app/',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json({ limit: '10mb' }));

// ── In-Memory Resume Store ────────────────────────────────────
const resumeStore = [];
let idCounter = 1;

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@resumeai.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';

// ── Multer ────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    ok.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only PDF and DOCX allowed'));
  }
});

// ── Auth Middleware ───────────────────────────────────────────
function adminAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const d = jwt.verify(token, JWT_SECRET);
    if (!d.isAdmin) return res.status(403).json({ error: 'Admins only' });
    req.admin = d;
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

// ── Groq API helper ──────────────────────────────────────────
async function callClaude(userPrompt) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set');

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are an expert resume analyst and ATS optimization specialist. Always respond in valid JSON only, no markdown fences, no extra text.'
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: 'json_object' }
    })
  });

  if (!r.ok) throw new Error(`Groq error: ${await r.text()}`);
  const data = await r.json();

  if (data.error) throw new Error(`Groq error: ${data.error.message}`);

  const txt = data.choices?.[0]?.message?.content || '';
  if (!txt) throw new Error('Empty response from Groq');

  const clean = txt.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean);
}

// ── Text extractor ────────────────────────────────────────────
async function extractText(file) {
  if (file.mimetype === 'application/pdf') {
    const d = await pdfParse(file.buffer);
    return d.text;
  }
  const r = await mammoth.extractRawText({ buffer: file.buffer });
  return r.value;
}

// ── ATS-Safe PDF ──────────────────────────────────────────────
function buildAtsPdf(rd) {
  return new Promise(resolve => {
    const doc = new PDFDocument({ margin: 54, size: 'LETTER', info: { Title: `${rd.name} - Resume` } });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    const W = doc.page.width - 108;

    // Name
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#000').text(rd.name || '', { align: 'center' });
    doc.moveDown(0.25);

    // Contact
    const contact = [rd.email, rd.phone, rd.location, rd.linkedin].filter(Boolean).join('  |  ');
    doc.font('Helvetica').fontSize(10).fillColor('#333').text(contact, { align: 'center' });
    doc.moveDown(0.7);

    const rule = () => {
      doc.moveTo(54, doc.y).lineTo(54 + W, doc.y).lineWidth(0.75).strokeColor('#000').stroke();
      doc.moveDown(0.25);
    };

    const sec = t => {
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text(t.toUpperCase());
      rule();
    };

    const bul = t => doc.font('Helvetica').fontSize(10).fillColor('#000')
      .text(`\u2022 ${t}`, { indent: 12, lineGap: 2 });

    if (rd.summary) {
      sec('Professional Summary');
      doc.font('Helvetica').fontSize(10).fillColor('#000').text(rd.summary, { lineGap: 3 });
      doc.moveDown(0.7);
    }

    if (rd.experience?.length) {
      sec('Work Experience');
      rd.experience.forEach(e => {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text(e.title || '');
        const meta = [e.company, e.location].filter(Boolean).join(', ');
        const dates = [e.startDate, e.endDate || 'Present'].filter(Boolean).join(' \u2013 ');
        doc.font('Helvetica').fontSize(10).fillColor('#444').text(`${meta}  |  ${dates}`);
        doc.moveDown(0.15);
        (e.bullets || []).forEach(bul);
        doc.moveDown(0.4);
      });
    }

    if (rd.education?.length) {
      sec('Education');
      rd.education.forEach(e => {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text(e.degree || '');
        const meta = [e.institution, e.location].filter(Boolean).join(', ');
        const dates = [e.startDate, e.endDate].filter(Boolean).join(' \u2013 ');
        doc.font('Helvetica').fontSize(10).fillColor('#444').text(`${meta}  |  ${dates}`);
        if (e.gpa) doc.font('Helvetica').fontSize(10).fillColor('#000').text(`GPA: ${e.gpa}`);
        doc.moveDown(0.4);
      });
    }

    if (rd.skills?.length) {
      sec('Skills');
      doc.font('Helvetica').fontSize(10).fillColor('#000').text(rd.skills.join(', '), { lineGap: 3 });
      doc.moveDown(0.6);
    }

    if (rd.certifications?.length) {
      sec('Certifications');
      rd.certifications.forEach(bul);
      doc.moveDown(0.6);
    }

    if (rd.projects?.length) {
      sec('Projects');
      rd.projects.forEach(p => {
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000').text(p.name || '');
        if (p.description) doc.font('Helvetica').fontSize(10).fillColor('#333').text(p.description);
        (p.bullets || []).forEach(bul);
        doc.moveDown(0.3);
      });
    }

    doc.end();
  });
}

// ── ATS-Safe DOCX ─────────────────────────────────────────────
async function buildAtsDocx(rd) {
  const kids = [];

  const rule = () => new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 } },
    spacing: { after: 80 }
  });

  const sec = t => [
    new Paragraph({
      children: [new TextRun({ text: t.toUpperCase(), bold: true, size: 24, font: 'Arial' })],
      spacing: { before: 200, after: 40 }
    }),
    rule()
  ];

  // Name
  kids.push(new Paragraph({
    children: [new TextRun({ text: rd.name || '', bold: true, size: 40, font: 'Arial' })],
    alignment: AlignmentType.CENTER, spacing: { after: 60 }
  }));

  // Contact
  const contact = [rd.email, rd.phone, rd.location, rd.linkedin].filter(Boolean).join('  |  ');
  kids.push(new Paragraph({
    children: [new TextRun({ text: contact, size: 20, font: 'Arial', color: '333333' })],
    alignment: AlignmentType.CENTER, spacing: { after: 160 }
  }));

  // Summary
  if (rd.summary) {
    kids.push(...sec('Professional Summary'));
    kids.push(new Paragraph({ children: [new TextRun({ text: rd.summary, size: 20, font: 'Arial' })], spacing: { after: 120 } }));
  }

  // Experience
  if (rd.experience?.length) {
    kids.push(...sec('Work Experience'));
    rd.experience.forEach(e => {
      kids.push(new Paragraph({ children: [new TextRun({ text: e.title || '', bold: true, size: 22, font: 'Arial' })], spacing: { after: 40 } }));
      const meta = [e.company, e.location].filter(Boolean).join(', ');
      const dates = [e.startDate, e.endDate || 'Present'].filter(Boolean).join(' \u2013 ');
      kids.push(new Paragraph({ children: [new TextRun({ text: `${meta}  |  ${dates}`, size: 20, font: 'Arial', color: '444444' })], spacing: { after: 60 } }));
      (e.bullets || []).forEach(b => kids.push(new Paragraph({ children: [new TextRun({ text: b, size: 20, font: 'Arial' })], numbering: { reference: 'bullets', level: 0 }, spacing: { after: 40 } })));
      kids.push(new Paragraph({ spacing: { after: 80 } }));
    });
  }

  // Education
  if (rd.education?.length) {
    kids.push(...sec('Education'));
    rd.education.forEach(e => {
      kids.push(new Paragraph({ children: [new TextRun({ text: e.degree || '', bold: true, size: 22, font: 'Arial' })], spacing: { after: 40 } }));
      const meta = [e.institution, e.location].filter(Boolean).join(', ');
      const dates = [e.startDate, e.endDate].filter(Boolean).join(' \u2013 ');
      kids.push(new Paragraph({ children: [new TextRun({ text: `${meta}  |  ${dates}`, size: 20, font: 'Arial', color: '444444' })], spacing: { after: e.gpa ? 40 : 100 } }));
      if (e.gpa) kids.push(new Paragraph({ children: [new TextRun({ text: `GPA: ${e.gpa}`, size: 20, font: 'Arial' })], spacing: { after: 100 } }));
    });
  }

  // Skills
  if (rd.skills?.length) {
    kids.push(...sec('Skills'));
    kids.push(new Paragraph({ children: [new TextRun({ text: rd.skills.join(', '), size: 20, font: 'Arial' })], spacing: { after: 120 } }));
  }

  // Certifications
  if (rd.certifications?.length) {
    kids.push(...sec('Certifications'));
    rd.certifications.forEach(c => kids.push(new Paragraph({ children: [new TextRun({ text: c, size: 20, font: 'Arial' })], numbering: { reference: 'bullets', level: 0 }, spacing: { after: 40 } })));
    kids.push(new Paragraph({ spacing: { after: 80 } }));
  }

  // Projects
  if (rd.projects?.length) {
    kids.push(...sec('Projects'));
    rd.projects.forEach(p => {
      kids.push(new Paragraph({ children: [new TextRun({ text: p.name || '', bold: true, size: 20, font: 'Arial' })], spacing: { after: 40 } }));
      if (p.description) kids.push(new Paragraph({ children: [new TextRun({ text: p.description, size: 20, font: 'Arial' })], spacing: { after: 40 } }));
      (p.bullets || []).forEach(b => kids.push(new Paragraph({ children: [new TextRun({ text: b, size: 20, font: 'Arial' })], numbering: { reference: 'bullets', level: 0 }, spacing: { after: 40 } })));
      kids.push(new Paragraph({ spacing: { after: 80 } }));
    });
  }

  const doc = new Document({
    numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 360 } } } }] }] },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } }, children: kids }]
  });
  return Packer.toBuffer(doc);
}

// ═══════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════

app.get('/health', (req, res) => res.json({ status: 'ok', stored: resumeStore.length }));

// Admin login
app.post('/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD)
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ email, isAdmin: true }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ success: true, token });
});

// Admin stats
app.get('/admin/stats', adminAuth, (req, res) => {
  const scores = resumeStore.map(r => r.analysis?.overallScore).filter(Boolean);
  const ats    = resumeStore.map(r => r.analysis?.atsCompatibility).filter(Boolean);
  const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0;
  const dist = { '0-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 };
  scores.forEach(s => { if (s <= 40) dist['0-40']++; else if (s <= 60) dist['41-60']++; else if (s <= 80) dist['61-80']++; else dist['81-100']++; });
  const byDay = {};
  const cut = Date.now() - 7 * 86400000;
  resumeStore.filter(r => new Date(r.uploadedAt) >= cut).forEach(r => { const d = r.uploadedAt.slice(0, 10); byDay[d] = (byDay[d] || 0) + 1; });
  res.json({ success: true, stats: { totalResumes: resumeStore.length, avgScore: avg(scores), avgAts: avg(ats), distribution: dist, byDay } });
});

// Admin list resumes
app.get('/admin/resumes', adminAuth, (req, res) => {
  res.json({ success: true, total: resumeStore.length, resumes: resumeStore.map(r => ({ id: r.id, fileName: r.fileName, fileSize: r.fileSize, uploadedAt: r.uploadedAt, sessionId: r.sessionId, overallScore: r.analysis?.overallScore, atsCompatibility: r.analysis?.atsCompatibility })) });
});

// Admin get one resume
app.get('/admin/resumes/:id', adminAuth, (req, res) => {
  const r = resumeStore.find(x => x.id === +req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true, resume: { ...r, resumeText: r.resumeText?.slice(0, 500) + '...' } });
});

// Admin delete resume
app.delete('/admin/resumes/:id', adminAuth, (req, res) => {
  const i = resumeStore.findIndex(x => x.id === +req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Not found' });
  resumeStore.splice(i, 1);
  res.json({ success: true });
});

// Analyze resume — saves to store
app.post('/analyze', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const jobDescription = req.body.jobDescription || '';
    const sessionId = req.body.sessionId || 'anon';
    const resumeText = await extractText(req.file);
    if (!resumeText || resumeText.trim().length < 50)
      return res.status(400).json({ error: 'Could not extract text. Check the file.' });

    const analysis = await callClaude(
      `Analyze this resume${jobDescription ? ' against the job description' : ''} and return JSON exactly:
{
  "overallScore": <0-100>,
  "summary": "<2-3 sentence assessment>",
  "strengths": ["..."],
  "improvements": ["..."],
  "skills": { "found": ["..."], "missing": ["..."] },
  "sections": {
    "contact":    { "score": <0-100>, "feedback": "..." },
    "experience": { "score": <0-100>, "feedback": "..." },
    "education":  { "score": <0-100>, "feedback": "..." },
    "skills":     { "score": <0-100>, "feedback": "..." }
  },
  "keywords": ["..."],
  "atsCompatibility": <0-100>,
  "suggestions": ["..."]
}
RESUME:
${resumeText}
${jobDescription ? `\nJOB DESCRIPTION:\n${jobDescription}` : ''}`
    );

    const record = { id: idCounter++, fileName: req.file.originalname, fileSize: req.file.size, uploadedAt: new Date().toISOString(), resumeText, analysis, sessionId };
    resumeStore.push(record);
    res.json({ success: true, id: record.id, analysis, fileName: req.file.originalname, resumeText });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

// Generate ATS resume from existing analysis
app.post('/generate-ats', async (req, res) => {
  try {
    const { resumeText, analysis, format = 'pdf' } = req.body;
    if (!resumeText) return res.status(400).json({ error: 'resumeText required' });

    const structured = await callClaude(
      `Extract and ATS-optimize this resume. Return ONLY this JSON structure:
{
  "name": "Full Name",
  "email": "email",
  "phone": "phone",
  "location": "City, State",
  "linkedin": "url or empty string",
  "summary": "2-3 sentence ATS-optimized professional summary with keywords",
  "experience": [{ "title": "", "company": "", "location": "", "startDate": "Mon YYYY", "endDate": "Mon YYYY or Present", "bullets": ["Action verb + achievement + metric"] }],
  "education": [{ "degree": "Degree, Field", "institution": "", "location": "", "startDate": "YYYY", "endDate": "YYYY", "gpa": "" }],
  "skills": ["skill1", "skill2"],
  "certifications": ["Cert Name, Issuer, Year"],
  "projects": [{ "name": "", "description": "", "bullets": [] }]
}
ATS RULES: bullets start with action verbs, include metrics, plain text only, no tables or columns.
${analysis?.suggestions?.length ? `APPLY THESE IMPROVEMENTS:\n${analysis.suggestions.join('\n')}` : ''}
RESUME:
${resumeText}`
    );

    let buf, mime, ext;
    if (format === 'docx') {
      buf = await buildAtsDocx(structured);
      mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      ext = 'docx';
    } else {
      buf = await buildAtsPdf(structured);
      mime = 'application/pdf';
      ext = 'pdf';
    }
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="ats-resume.${ext}"`);
    res.send(buf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Generation failed' });
  }
});

// Create brand new resume from form data
app.post('/create-resume', async (req, res) => {
  try {
    const { resumeData, format = 'pdf' } = req.body;
    if (!resumeData?.name) return res.status(400).json({ error: 'resumeData.name required' });

    const enhanced = await callClaude(
      `You are an ATS expert. Enhance this resume JSON for maximum ATS impact and return the SAME JSON structure with improved content.
RULES:
- Rewrite every bullet starting with a STRONG action verb (Led, Built, Increased, Reduced, Designed...)
- Add metrics/numbers wherever logical
- Write a keyword-rich professional summary
- Keep ALL factual info (names, dates, companies) EXACTLY as given
- Do NOT invent facts
INPUT:
${JSON.stringify(resumeData, null, 2)}`
    );

    let buf, mime, ext;
    if (format === 'docx') {
      buf = await buildAtsDocx(enhanced);
      mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      ext = 'docx';
    } else {
      buf = await buildAtsPdf(enhanced);
      mime = 'application/pdf';
      ext = 'pdf';
    }
    const safeName = (enhanced.name || 'resume').replace(/\s+/g, '-');
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-resume.${ext}"`);
    res.send(buf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Resume creation failed' });
  }
});

app.listen(PORT, () => console.log(`Server on :${PORT}`));
