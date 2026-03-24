import { useState, useCallback, useEffect } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || ''

// ─── localStorage helpers ─────────────────────────────────────

// ─── Shared UI ────────────────────────────────────────────────
const C = {
  bg: '#0d0f14', bg2: '#13161d', bg3: '#1a1e28',
  border: '#252a38', accent: '#6c63ff', teal: '#22d3a5',
  warn: '#f59e0b', danger: '#f87171', text: '#e8eaf0', muted: '#7a7f92'
}

const inp = (extra = {}) => ({
  width: '100%', padding: '10px 14px', background: C.bg3,
  border: `1px solid ${C.border}`, borderRadius: 10, color: C.text,
  fontSize: 14, outline: 'none', boxSizing: 'border-box', ...extra
})

function Btn({ children, onClick, disabled, variant = 'primary', style = {} }) {
  const bg = variant === 'primary' ? C.accent : variant === 'danger' ? '#7f1d1d' : C.bg3
  const col = variant === 'ghost' ? C.muted : '#fff'
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '9px 18px', background: disabled ? C.border : bg, color: disabled ? C.muted : col,
      border: `1px solid ${variant === 'ghost' ? C.border : 'transparent'}`,
      borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all .2s', ...style
    }}>{children}</button>
  )
}

function Card({ title, children, style = {} }) {
  return (
    <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px', ...style }}>
      {title && <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{title}</div>}
      {children}
    </div>
  )
}

function Tag({ text, color = C.accent }) {
  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, background: color + '22', color, border: `1px solid ${color}44`, fontSize: 12, margin: '3px 4px 3px 0', fontWeight: 500 }}>{text}</span>
}

function ScoreRing({ score, size = 110, label }) {
  const r = 42, cx = 55, cy = 55, circ = 2 * Math.PI * r
  const color = score >= 75 ? C.teal : score >= 50 ? C.warn : C.danger
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size} viewBox="0 0 110 110">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth="8" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${(score / 100) * circ} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 55 55)" style={{ transition: 'stroke-dasharray 1s ease' }} />
        <text x={cx} y={cy - 5} textAnchor="middle" fill={color} style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Syne,sans-serif' }}>{score}</text>
        <text x={cx} y={cy + 13} textAnchor="middle" fill={C.muted} style={{ fontSize: 11 }}>/100</text>
      </svg>
      {label && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{label}</div>}
    </div>
  )
}

function Bar({ label, score }) {
  const color = score >= 75 ? C.teal : score >= 50 ? C.warn : C.danger
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
        <span style={{ textTransform: 'capitalize' }}>{label}</span>
        <span style={{ color, fontWeight: 600 }}>{score}/100</span>
      </div>
      <div style={{ height: 5, background: C.bg3, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 3, transition: 'width .8s ease' }} />
      </div>
    </div>
  )
}

// ─── Upload Zone ──────────────────────────────────────────────
function UploadZone({ onFile, file }) {
  const [drag, setDrag] = useState(false)
  const drop = useCallback(e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f) }, [onFile])
  return (
    <div onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={drop}
      onClick={() => document.getElementById('ri').click()}
      style={{ border: `2px dashed ${drag ? C.accent : file ? C.teal : C.border}`, borderRadius: 14, padding: '36px 24px', textAlign: 'center', cursor: 'pointer', background: drag ? C.accent + '11' : file ? C.teal + '11' : 'transparent', transition: 'all .2s' }}>
      <input id="ri" type="file" accept=".pdf,.docx" hidden onChange={e => e.target.files[0] && onFile(e.target.files[0])} />
      <div style={{ fontSize: 36, marginBottom: 10 }}>{file ? '✅' : '📄'}</div>
      {file ? <><div style={{ fontWeight: 600, color: C.teal }}>{file.name}</div><div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{(file.size / 1024).toFixed(0)} KB · click to change</div></>
        : <><div style={{ fontWeight: 600 }}>Drop resume here</div><div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>PDF or DOCX · Max 5MB</div></>}
    </div>
  )
}

// ─── Analysis Results ─────────────────────────────────────────
// ─── ATS Template Filler ─────────────────────────────────────
function AtsTemplateFiller({ analysis, resumeText, onBack }) {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', location: '', linkedin: '',
    summary: '',
    experience: [{ title: '', company: '', location: '', startDate: '', endDate: '', bullets: [''] }],
    education: [{ degree: '', institution: '', location: '', startDate: '', endDate: '', gpa: '' }],
    skills: (analysis?.skills?.found || []).concat(analysis?.skills?.missing || []).join(', '),
    certifications: '',
    projects: []
  })
  const [loading, setLoading] = useState(false)
  const [activeSection, setActiveSection] = useState('contact')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setArr = (k, i, field, val) => setForm(f => { const a = [...f[k]]; a[i] = { ...a[i], [field]: val }; return { ...f, [k]: a } })
  const setBullet = (k, i, bi, val) => setForm(f => { const a = [...f[k]]; const b = [...a[i].bullets]; b[bi] = val; a[i] = { ...a[i], bullets: b }; return { ...f, [k]: a } })
  const addBullet = (k, i) => setForm(f => { const a = [...f[k]]; a[i] = { ...a[i], bullets: [...a[i].bullets, ''] }; return { ...f, [k]: a } })
  const remBullet = (k, i, bi) => setForm(f => { const a = [...f[k]]; a[i] = { ...a[i], bullets: a[i].bullets.filter((_, j) => j !== bi) }; return { ...f, [k]: a } })
  const addExp = () => setForm(f => ({ ...f, experience: [...f.experience, { title: '', company: '', location: '', startDate: '', endDate: '', bullets: [''] }] }))
  const addEdu = () => setForm(f => ({ ...f, education: [...f.education, { degree: '', institution: '', location: '', startDate: '', endDate: '', gpa: '' }] }))
  const remExp = (i) => setForm(f => ({ ...f, experience: f.experience.filter((_, j) => j !== i) }))
  const remEdu = (i) => setForm(f => ({ ...f, education: f.education.filter((_, j) => j !== i) }))

  const download = async (fmt) => {
    if (!form.name.trim()) return alert('Name required!')
    setLoading(true)
    try {
      const resumeData = { ...form, skills: form.skills.split(',').map(s => s.trim()).filter(Boolean), certifications: form.certifications.split('\n').map(s => s.trim()).filter(Boolean) }
      const res = await axios.post(`${API}/create-resume`, { resumeData, format: fmt }, { responseType: 'blob', timeout: 90000 })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url; a.download = `${form.name.replace(/\s+/g, '-')}-ats-resume.${fmt}`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert('Failed: ' + (e.response?.data?.error || e.message)) }
    finally { setLoading(false) }
  }

  const inpStyle = { width: '100%', padding: '9px 12px', background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }
  const label = (t) => <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t}</div>
  const field = (lbl, val, onChange, opts = {}) => (
    <div style={{ marginBottom: 12 }}>
      {label(lbl)}
      {opts.textarea
        ? <textarea value={val} onChange={e => onChange(e.target.value)} rows={opts.rows || 3} style={{ ...inpStyle, resize: 'vertical', lineHeight: 1.5 }} placeholder={opts.ph || ''} />
        : <input value={val} onChange={e => onChange(e.target.value)} style={inpStyle} placeholder={opts.ph || ''} />}
    </div>
  )

  const sections = ['contact', 'experience', 'education', 'skills', 'download']
  const sectionLabels = { contact: '👤 Contact', experience: '💼 Experience', education: '🎓 Education', skills: '🛠 Skills', download: '⬇ Download' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Btn onClick={onBack} variant="ghost">← Back</Btn>
        <h2 style={{ fontFamily: 'Syne,sans-serif', fontSize: 20 }}>Fill ATS Template</h2>
      </div>

      {/* Issues to fix banner */}
      {(analysis?.improvements || []).length > 0 && (
        <div style={{ background: '#422006', border: '1px solid #92400e', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.warn, marginBottom: 8 }}>⚠ Fix these issues in your new resume:</div>
          {analysis.improvements.slice(0, 4).map((imp, i) => (
            <div key={i} style={{ fontSize: 12, color: '#fcd34d', marginBottom: 4, display: 'flex', gap: 8 }}>
              <span>›</span><span>{imp}</span>
            </div>
          ))}
        </div>
      )}

      {/* Missing skills banner */}
      {(analysis?.skills?.missing || []).length > 0 && (
        <div style={{ background: '#1c1917', border: '1px solid #44403c', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', marginBottom: 8 }}>💡 Add these missing skills:</div>
          <div>{analysis.skills.missing.map((s, i) => <Tag key={i} text={s} color={C.warn} />)}</div>
        </div>
      )}

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {sections.map(s => (
          <button key={s} onClick={() => setActiveSection(s)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${activeSection === s ? C.accent : C.border}`, background: activeSection === s ? C.accent : C.bg3, color: activeSection === s ? '#fff' : C.muted, fontSize: 13, fontWeight: activeSection === s ? 600 : 400, cursor: 'pointer' }}>{sectionLabels[s]}</button>
        ))}
      </div>

      <Card>
        {/* Contact */}
        {activeSection === 'contact' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            {field('Full Name *', form.name, v => set('name', v), { ph: 'John Doe' })}
            {field('Email *', form.email, v => set('email', v), { ph: 'john@example.com' })}
            {field('Phone', form.phone, v => set('phone', v), { ph: '+91-9876543210' })}
            {field('Location', form.location, v => set('location', v), { ph: 'Mumbai, India' })}
            <div style={{ gridColumn: '1/-1' }}>
              {field('LinkedIn', form.linkedin, v => set('linkedin', v), { ph: 'linkedin.com/in/johndoe' })}
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              {field('Professional Summary', form.summary, v => set('summary', v), { textarea: true, rows: 4, ph: 'Leave blank — AI will write ATS-optimized summary' })}
            </div>
          </div>
        )}

        {/* Experience */}
        {activeSection === 'experience' && (
          <>
            {form.experience.map((e, i) => (
              <div key={i} style={{ marginBottom: 20, padding: 14, background: C.bg3, borderRadius: 10, border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Experience {i + 1}</div>
                  {form.experience.length > 1 && <button onClick={() => remExp(i)} style={{ background: 'transparent', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 13 }}>Remove</button>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                  {field('Job Title *', e.title, v => setArr('experience', i, 'title', v), { ph: 'Software Engineer' })}
                  {field('Company *', e.company, v => setArr('experience', i, 'company', v), { ph: 'Google' })}
                  {field('Location', e.location, v => setArr('experience', i, 'location', v), { ph: 'Bangalore' })}
                  {field('Start Date', e.startDate, v => setArr('experience', i, 'startDate', v), { ph: 'Jun 2022' })}
                  {field('End Date', e.endDate, v => setArr('experience', i, 'endDate', v), { ph: 'Present' })}
                </div>
                {label('Bullets (action verb se shuru karo)')}
                {e.bullets.map((b, bi) => (
                  <div key={bi} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input value={b} onChange={ev => setBullet('experience', i, bi, ev.target.value)} style={{ ...inpStyle, flex: 1 }} placeholder="Built X that improved Y by Z%" />
                    {e.bullets.length > 1 && <button onClick={() => remBullet('experience', i, bi)} style={{ background: 'transparent', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>}
                  </div>
                ))}
                <button onClick={() => addBullet('experience', i)} style={{ background: 'transparent', border: `1px dashed ${C.border}`, color: C.muted, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>+ Add bullet</button>
              </div>
            ))}
            <Btn onClick={addExp} variant="ghost" style={{ width: '100%' }}>+ Add Experience</Btn>
          </>
        )}

        {/* Education */}
        {activeSection === 'education' && (
          <>
            {form.education.map((e, i) => (
              <div key={i} style={{ marginBottom: 20, padding: 14, background: C.bg3, borderRadius: 10, border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Education {i + 1}</div>
                  {form.education.length > 1 && <button onClick={() => remEdu(i)} style={{ background: 'transparent', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 13 }}>Remove</button>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                  {field('Degree & Field *', e.degree, v => setArr('education', i, 'degree', v), { ph: 'B.Tech, Computer Science' })}
                  {field('Institution *', e.institution, v => setArr('education', i, 'institution', v), { ph: 'IIT Delhi' })}
                  {field('Location', e.location, v => setArr('education', i, 'location', v), { ph: 'New Delhi' })}
                  {field('Start Year', e.startDate, v => setArr('education', i, 'startDate', v), { ph: '2018' })}
                  {field('End Year', e.endDate, v => setArr('education', i, 'endDate', v), { ph: '2022' })}
                  {field('GPA (optional)', e.gpa, v => setArr('education', i, 'gpa', v), { ph: '8.5/10' })}
                </div>
              </div>
            ))}
            <Btn onClick={addEdu} variant="ghost" style={{ width: '100%' }}>+ Add Education</Btn>
          </>
        )}

        {/* Skills */}
        {activeSection === 'skills' && (
          <>
            <div style={{ background: '#14532d22', border: '1px solid #14532d', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#86efac' }}>
              ✅ Analysis se found skills already add kar diye hain. Missing skills bhi included hain — hata sakte ho jo relevant nahi.
            </div>
            {field('Skills (comma separated)', form.skills, v => set('skills', v), { textarea: true, rows: 4, ph: 'React, Node.js, Python, AWS...' })}
            {field('Certifications (ek per line)', form.certifications, v => set('certifications', v), { textarea: true, rows: 3, ph: 'AWS Solutions Architect, Amazon, 2023' })}
          </>
        )}

        {/* Download */}
        {activeSection === 'download' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>🚀</div>
            <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Ready to Download!</div>
            <div style={{ color: C.muted, fontSize: 14, maxWidth: 400, margin: '0 auto 28px' }}>
              AI tumhare data ko ATS-optimize karega — bullets strong action verbs se shuru honge, summary keyword-rich hogi.
            </div>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => download('pdf')} disabled={loading} style={{ padding: '13px 26px', background: '#14532d', color: '#86efac', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Generating...' : '⬇ Download PDF'}
              </button>
              <button onClick={() => download('docx')} disabled={loading} style={{ padding: '13px 26px', background: '#1e3a5f', color: '#93c5fd', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Generating...' : '⬇ Download DOCX'}
              </button>
            </div>
            {loading && <div style={{ color: C.muted, fontSize: 12, marginTop: 14 }}>AI optimize kar raha hai... ~30 seconds</div>}
          </div>
        )}
      </Card>

      {activeSection !== 'download' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <Btn onClick={() => { const i = sections.indexOf(activeSection); setActiveSection(sections[Math.min(i + 1, sections.length - 1)]) }}>Next →</Btn>
        </div>
      )}
    </div>
  )
}

// ─── Results Component ────────────────────────────────────────
function Results({ data, onBack }) {
  const { analysis, fileName, resumeText } = data
  const [dlLoading, setDlLoading] = useState('')
  const [showTemplate, setShowTemplate] = useState(false)

  if (showTemplate) {
    return <AtsTemplateFiller analysis={analysis} resumeText={resumeText} onBack={() => setShowTemplate(false)} />
  }

  const downloadAts = async (fmt) => {
    setDlLoading(fmt)
    try {
      const res = await axios.post(`${API}/generate-ats`, { resumeText, analysis, format: fmt }, { responseType: 'blob', timeout: 60000 })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url; a.download = `ats-resume.${fmt}`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert('Download failed: ' + (e.message || 'unknown error')) }
    finally { setDlLoading('') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Btn onClick={onBack} variant="ghost">← Back</Btn>
        <h2 style={{ fontFamily: 'Syne,sans-serif', fontSize: 20, flex: 1 }}>Analysis Results</h2>
        <Btn onClick={() => downloadAts('pdf')} disabled={!!dlLoading} style={{ background: '#14532d', color: '#86efac' }}>
          {dlLoading === 'pdf' ? 'Generating...' : '⬇ ATS PDF'}
        </Btn>
        <Btn onClick={() => downloadAts('docx')} disabled={!!dlLoading} style={{ background: '#1e3a5f', color: '#93c5fd' }}>
          {dlLoading === 'docx' ? 'Generating...' : '⬇ ATS DOCX'}
        </Btn>
      </div>

      {/* Score header */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <ScoreRing score={analysis.overallScore} label="Overall" />
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>RESUME</div>
            <div style={{ fontWeight: 700, fontSize: 16, fontFamily: 'Syne,sans-serif', marginBottom: 8 }}>{fileName}</div>
            <div style={{ fontSize: 14, color: '#a0a5b8', lineHeight: 1.6 }}>{analysis.summary}</div>
          </div>
          <ScoreRing score={analysis.atsCompatibility} size={90} label="ATS" />
        </div>
      </Card>

      {/* ATS Fix & Download CTA */}
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)', border: '1px solid #4338ca', borderRadius: 14, padding: '20px 24px' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>✨ Resume Fix Karke Download Karo</div>
        <div style={{ fontSize: 13, color: '#a5b4fc', marginBottom: 16 }}>
          AI tumhare uploaded resume ko read karega, suggestions apply karega, aur ek improved ATS-safe version download karega
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => downloadAts('pdf')} disabled={!!dlLoading || !resumeText} style={{ padding: '10px 20px', background: '#14532d', color: '#86efac', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: !resumeText || dlLoading ? 'not-allowed' : 'pointer', opacity: !resumeText ? 0.5 : 1 }}>
            {dlLoading === 'pdf' ? '⏳ Generating...' : '⬇ Fixed Resume — PDF'}
          </button>
          <button onClick={() => downloadAts('docx')} disabled={!!dlLoading || !resumeText} style={{ padding: '10px 20px', background: '#1e3a5f', color: '#93c5fd', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: !resumeText || dlLoading ? 'not-allowed' : 'pointer', opacity: !resumeText ? 0.5 : 1 }}>
            {dlLoading === 'docx' ? '⏳ Generating...' : '⬇ Fixed Resume — DOCX'}
          </button>
          <button onClick={() => setShowTemplate(true)} style={{ padding: '10px 20px', background: 'transparent', color: '#a5b4fc', border: '1px solid #4338ca', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            📝 Manually Fill Template →
          </button>
        </div>
        {dlLoading && <div style={{ fontSize: 12, color: '#a5b4fc', marginTop: 10 }}>⏳ AI resume fix kar raha hai... ~30 seconds</div>}
      </div>

      {/* Sections */}
      <Card title="Section Breakdown">
        {Object.entries(analysis.sections || {}).map(([k, v]) => (
          <div key={k} style={{ marginBottom: 16 }}>
            <Bar label={k} score={v.score} />
            <div style={{ fontSize: 12, color: C.muted, marginTop: -4 }}>{v.feedback}</div>
          </div>
        ))}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="✅ Strengths">
          {(analysis.strengths || []).map((s, i) => <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 13, color: '#b8bdd0' }}><span style={{ color: C.teal }}>›</span>{s}</div>)}
        </Card>
        <Card title="⚡ Improvements">
          {(analysis.improvements || []).map((s, i) => <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 13, color: '#b8bdd0' }}><span style={{ color: C.warn }}>›</span>{s}</div>)}
        </Card>
      </div>

      <Card title="🛠 Skills">
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>FOUND</div>
          {(analysis.skills?.found || []).map((s, i) => <Tag key={i} text={s} color={C.accent} />)}
        </div>
        {(analysis.skills?.missing || []).length > 0 && <>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>MISSING / ADD THESE</div>
          {analysis.skills.missing.map((s, i) => <Tag key={i} text={s} color={C.warn} />)}
        </>}
      </Card>

      <Card title="🔑 Keywords">
        {(analysis.keywords || []).map((k, i) => <Tag key={i} text={k} color={C.teal} />)}
      </Card>

      <Card title="💡 Suggestions">
        {(analysis.suggestions || []).map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 10, padding: '10px 12px', background: C.bg3, borderRadius: 8, fontSize: 13, border: `1px solid ${C.border}` }}>
            <span style={{ background: C.accent + '22', color: C.accent, borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
            <span style={{ color: '#b8bdd0' }}>{s}</span>
          </div>
        ))}
      </Card>
    </div>
  )
}

// ─── Resume Builder ───────────────────────────────────────────
// ─── Resume Builder ───────────────────────────────────────────
const emptyExp = () => ({ title: '', company: '', location: '', startDate: '', endDate: '', bullets: [''] })
const emptyEdu = () => ({ degree: '', institution: '', location: '', startDate: '', endDate: '', gpa: '' })
const emptyProj = () => ({ name: '', description: '', bullets: [''] })

function ResumeBuilder({ onBack }) {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', email: '', phone: '', location: '', linkedin: '', summary: '',
    experience: [emptyExp()], education: [emptyEdu()],
    skills: '', certifications: '', projects: []
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setArr = (k, i, field, val) => setForm(f => {
    const arr = [...f[k]]; arr[i] = { ...arr[i], [field]: val }; return { ...f, [k]: arr }
  })
  const addArr = (k, empty) => setForm(f => ({ ...f, [k]: [...f[k], empty] }))
  const remArr = (k, i) => setForm(f => ({ ...f, [k]: f[k].filter((_, j) => j !== i) }))
  const setBullet = (k, i, bi, val) => setForm(f => {
    const arr = [...f[k]]; const bullets = [...arr[i].bullets]; bullets[bi] = val; arr[i] = { ...arr[i], bullets }; return { ...f, [k]: arr }
  })
  const addBullet = (k, i) => setForm(f => { const arr = [...f[k]]; arr[i] = { ...arr[i], bullets: [...arr[i].bullets, ''] }; return { ...f, [k]: arr } })
  const remBullet = (k, i, bi) => setForm(f => { const arr = [...f[k]]; arr[i] = { ...arr[i], bullets: arr[i].bullets.filter((_, j) => j !== bi) }; return { ...f, [k]: arr } })

  const download = async (fmt) => {
    if (!form.name.trim()) return alert('Name is required')
    setLoading(true)
    try {
      const resumeData = {
        ...form,
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
        certifications: form.certifications.split('\n').map(s => s.trim()).filter(Boolean),
      }
      const res = await axios.post(`${API}/create-resume`, { resumeData, format: fmt }, { responseType: 'blob', timeout: 90000 })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url; a.download = `${form.name.replace(/\s+/g, '-')}-resume.${fmt}`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert('Failed: ' + (e.response?.data?.error || e.message)) }
    finally { setLoading(false) }
  }

  const fieldBox = (label, value, onChange, opts = {}) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
      {opts.textarea
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={opts.rows || 3} style={{ ...inp(), resize: 'vertical', lineHeight: 1.6 }} placeholder={opts.placeholder || ''} />
        : <input type={opts.type || 'text'} value={value} onChange={e => onChange(e.target.value)} style={inp()} placeholder={opts.placeholder || ''} />}
    </div>
  )

  const steps = ['Contact', 'Summary', 'Experience', 'Education', 'Skills', 'Projects', 'Download']

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Btn onClick={onBack} variant="ghost">← Back</Btn>
        <h2 style={{ fontFamily: 'Syne,sans-serif', fontSize: 20 }}>ATS Resume Builder</h2>
      </div>

      {/* Step tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 28, flexWrap: 'wrap' }}>
        {steps.map((s, i) => (
          <button key={i} onClick={() => setStep(i)} style={{
            padding: '7px 14px', borderRadius: 8, border: `1px solid ${step === i ? C.accent : C.border}`,
            background: step === i ? C.accent : C.bg3, color: step === i ? '#fff' : C.muted,
            fontSize: 13, fontWeight: step === i ? 600 : 400, cursor: 'pointer'
          }}>{i + 1}. {s}</button>
        ))}
      </div>

      <Card>
        {/* Step 0: Contact */}
        {step === 0 && <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            {fieldBox('Full Name *', form.name, v => set('name', v), { placeholder: 'John Doe' })}
            {fieldBox('Email *', form.email, v => set('email', v), { type: 'email', placeholder: 'john@example.com' })}
            {fieldBox('Phone', form.phone, v => set('phone', v), { placeholder: '+91-9876543210' })}
            {fieldBox('Location', form.location, v => set('location', v), { placeholder: 'Mumbai, India' })}
          </div>
          {fieldBox('LinkedIn URL', form.linkedin, v => set('linkedin', v), { placeholder: 'linkedin.com/in/johndoe' })}
        </>}

        {/* Step 1: Summary */}
        {step === 1 && fieldBox('Professional Summary', form.summary, v => set('summary', v), { textarea: true, rows: 5, placeholder: 'Leave blank — AI will generate an ATS-optimized summary based on your experience.' })}

        {/* Step 2: Experience */}
        {step === 2 && <>
          {form.experience.map((e, i) => (
            <div key={i} style={{ marginBottom: 24, padding: 16, background: C.bg3, borderRadius: 12, border: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Experience {i + 1}</div>
                {form.experience.length > 1 && <Btn onClick={() => remArr('experience', i)} variant="danger" style={{ padding: '4px 10px', fontSize: 12 }}>Remove</Btn>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                {fieldBox('Job Title *', e.title, v => setArr('experience', i, 'title', v), { placeholder: 'Software Engineer' })}
                {fieldBox('Company *', e.company, v => setArr('experience', i, 'company', v), { placeholder: 'Google' })}
                {fieldBox('Location', e.location, v => setArr('experience', i, 'location', v), { placeholder: 'Bangalore, India' })}
                {fieldBox('Start Date', e.startDate, v => setArr('experience', i, 'startDate', v), { placeholder: 'Jun 2022' })}
                {fieldBox('End Date', e.endDate, v => setArr('experience', i, 'endDate', v), { placeholder: 'Present' })}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>BULLET POINTS (start with action verbs)</div>
              {e.bullets.map((b, bi) => (
                <div key={bi} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input value={b} onChange={ev => setBullet('experience', i, bi, ev.target.value)} style={{ ...inp(), flex: 1 }} placeholder="Developed X that improved Y by Z%" />
                  {e.bullets.length > 1 && <button onClick={() => remBullet('experience', i, bi)} style={{ background: 'transparent', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 18 }}>×</button>}
                </div>
              ))}
              <button onClick={() => addBullet('experience', i)} style={{ background: 'transparent', border: `1px dashed ${C.border}`, color: C.muted, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, marginTop: 4 }}>+ Add bullet</button>
            </div>
          ))}
          <Btn onClick={() => addArr('experience', emptyExp())} variant="ghost" style={{ width: '100%' }}>+ Add Experience</Btn>
        </>}

        {/* Step 3: Education */}
        {step === 3 && <>
          {form.education.map((e, i) => (
            <div key={i} style={{ marginBottom: 20, padding: 16, background: C.bg3, borderRadius: 12, border: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Education {i + 1}</div>
                {form.education.length > 1 && <Btn onClick={() => remArr('education', i)} variant="danger" style={{ padding: '4px 10px', fontSize: 12 }}>Remove</Btn>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                {fieldBox('Degree & Field *', e.degree, v => setArr('education', i, 'degree', v), { placeholder: 'B.Tech, Computer Science' })}
                {fieldBox('Institution *', e.institution, v => setArr('education', i, 'institution', v), { placeholder: 'IIT Delhi' })}
                {fieldBox('Location', e.location, v => setArr('education', i, 'location', v), { placeholder: 'New Delhi, India' })}
                {fieldBox('Start Year', e.startDate, v => setArr('education', i, 'startDate', v), { placeholder: '2018' })}
                {fieldBox('End Year', e.endDate, v => setArr('education', i, 'endDate', v), { placeholder: '2022' })}
                {fieldBox('GPA (optional)', e.gpa, v => setArr('education', i, 'gpa', v), { placeholder: '8.5/10' })}
              </div>
            </div>
          ))}
          <Btn onClick={() => addArr('education', emptyEdu())} variant="ghost" style={{ width: '100%' }}>+ Add Education</Btn>
        </>}

        {/* Step 4: Skills & Certs */}
        {step === 4 && <>
          {fieldBox('Skills (comma separated) *', form.skills, v => set('skills', v), { placeholder: 'React, Node.js, Python, AWS, MongoDB, Git' })}
          {fieldBox('Certifications (one per line)', form.certifications, v => set('certifications', v), { textarea: true, rows: 4, placeholder: 'AWS Solutions Architect, Amazon, 2023\nGoogle Analytics Certified, Google, 2024' })}
        </>}

        {/* Step 5: Projects */}
        {step === 5 && <>
          {form.projects.map((p, i) => (
            <div key={i} style={{ marginBottom: 20, padding: 16, background: C.bg3, borderRadius: 12, border: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Project {i + 1}</div>
                <Btn onClick={() => remArr('projects', i)} variant="danger" style={{ padding: '4px 10px', fontSize: 12 }}>Remove</Btn>
              </div>
              {fieldBox('Project Name', p.name, v => setArr('projects', i, 'name', v), { placeholder: 'E-commerce Platform' })}
              {fieldBox('Description', p.description, v => setArr('projects', i, 'description', v), { placeholder: 'One line description' })}
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>KEY POINTS</div>
              {p.bullets.map((b, bi) => (
                <div key={bi} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input value={b} onChange={ev => setBullet('projects', i, bi, ev.target.value)} style={{ ...inp(), flex: 1 }} placeholder="Built using React + Node.js, serving 10k+ users" />
                  {p.bullets.length > 1 && <button onClick={() => remBullet('projects', i, bi)} style={{ background: 'transparent', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 18 }}>×</button>}
                </div>
              ))}
              <button onClick={() => addBullet('projects', i)} style={{ background: 'transparent', border: `1px dashed ${C.border}`, color: C.muted, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, marginTop: 4 }}>+ Add point</button>
            </div>
          ))}
          <Btn onClick={() => addArr('projects', emptyProj())} variant="ghost" style={{ width: '100%' }}>+ Add Project</Btn>
          {form.projects.length === 0 && <div style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: 20 }}>Projects are optional. Click above to add.</div>}
        </>}

        {/* Step 6: Download */}
        {step === 6 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
            <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Ready to Generate!</div>
            <div style={{ color: C.muted, fontSize: 14, marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>
              Claude will enhance your bullets with action verbs and metrics, write an ATS-optimized summary, and generate a clean, ATS-safe document.
            </div>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => download('pdf')} disabled={loading} style={{ padding: '14px 28px', background: '#14532d', color: '#86efac', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Generating...' : '⬇ Download PDF'}
              </button>
              <button onClick={() => download('docx')} disabled={loading} style={{ padding: '14px 28px', background: '#1e3a5f', color: '#93c5fd', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Generating...' : '⬇ Download DOCX'}
              </button>
            </div>
            {loading && <div style={{ color: C.muted, fontSize: 13, marginTop: 16 }}>Claude is optimizing your resume... ~30 seconds</div>}
          </div>
        )}
      </Card>

      {/* Prev / Next */}
      {step < 6 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
          <Btn onClick={() => setStep(s => Math.max(0, s - 1))} variant="ghost" disabled={step === 0}>← Previous</Btn>
          <Btn onClick={() => setStep(s => Math.min(6, s + 1))}>Next →</Btn>
        </div>
      )}
    </div>
  )
}

// ─── Admin Panel ──────────────────────────────────────────────
// ─── Main App ─────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState('home') // home | result | builder | admin | adminDash
  const [file, setFile] = useState(null)
  const [jobDesc, setJobDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [sessionId] = useState(() => Math.random().toString(36).slice(2))

  const analyze = async () => {
    if (!file) return
    setLoading(true); setError(''); setResult(null)
    try {
      const fd = new FormData()
      fd.append('resume', file)
      fd.append('sessionId', sessionId)
      if (jobDesc.trim()) fd.append('jobDescription', jobDesc.trim())
      const { data } = await axios.post(`${API}/analyze`, fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 })
      // Save to localStorage
      setResult({ ...data, resumeText: data.resumeText || '' })
      setPage('result')
    } catch (e) { setError(e.response?.data?.error || e.message || 'Something went wrong') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'DM Sans, sans-serif' }}>
      {/* Nav */}
      <nav style={{ borderBottom: `1px solid #1e2232`, padding: '0 24px', height: 62, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.bg, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setPage('home')}>
          <div style={{ width: 34, height: 34, background: C.accent, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📄</div>
          <div>
            <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 15 }}>ResumeAI</div>

          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Btn onClick={() => setPage('builder')} variant="ghost" style={{ fontSize: 13 }}>✏ Create Resume</Btn>
        </div>
      </nav>

      <div style={{ maxWidth: 880, margin: '0 auto', padding: '36px 24px' }}>

        {/* Home */}
        {page === 'home' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 44 }}>
              <h1 style={{ fontSize: 'clamp(26px,5vw,46px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 14, fontFamily: 'Syne,sans-serif' }}>
                Analyze Your Resume<br /><span style={{ color: C.accent }}>With AI Precision</span>
              </h1>
              <p style={{ color: C.muted, fontSize: 15, maxWidth: 460, margin: '0 auto' }}>Score, ATS check, skill gaps, and download an ATS-optimized version — all powered by Claude.</p>
            </div>

            <Card style={{ maxWidth: 580, margin: '0 auto' }}>
              <UploadZone onFile={setFile} file={file} />
              <div style={{ marginTop: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: '#a0a5b8' }}>Job Description <span style={{ color: C.muted, fontWeight: 400 }}>(optional)</span></label>
                <textarea value={jobDesc} onChange={e => setJobDesc(e.target.value)} placeholder="Paste job description for targeted analysis..." style={{ ...inp(), minHeight: 100, resize: 'vertical', lineHeight: 1.6 }} />
              </div>
              {error && <div style={{ marginTop: 14, padding: '10px 14px', background: '#f8717122', border: '1px solid #f8717144', borderRadius: 8, color: C.danger, fontSize: 13 }}>⚠ {error}</div>}
              <Btn onClick={analyze} disabled={!file || loading} style={{ marginTop: 20, width: '100%', padding: 14, fontSize: 15 }}>
                {loading ? '🔍 Analyzing...' : '✨ Analyze Resume'}
              </Btn>
              {loading && <div style={{ textAlign: 'center', color: C.muted, fontSize: 12, marginTop: 12 }}>Claude is reading your resume — 15–30 seconds...</div>}
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14, marginTop: 40 }}>
              {[
                { icon: '🎯', t: 'AI Score', d: '0–100 score with section breakdown' },
                { icon: '🤖', t: 'ATS Check', d: 'See how ATS systems read your resume' },
                { icon: '⬇', t: 'ATS Download', d: 'Get ATS-optimized PDF & DOCX instantly' },
                { icon: '✏', t: 'Resume Builder', d: 'Create a new ATS-safe resume from scratch' },
              ].map((f, i) => (
                <Card key={i}>
                  <div style={{ fontSize: 26, marginBottom: 8 }}>{f.icon}</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{f.t}</div>
                  <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{f.d}</div>
                </Card>
              ))}
            </div>
          </>
        )}

        {page === 'result' && result && <Results data={result} onBack={() => { setPage('home'); setResult(null); setFile(null) }} />}
        {page === 'builder' && <ResumeBuilder onBack={() => setPage('home')} />}
      </div>

    </div>
  )
}
