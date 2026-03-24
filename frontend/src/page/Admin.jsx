import { useState, useEffect } from "react";

const API = "https://ai-resume-analyzer-46lk.onrender.com/api";

export default function Admin() {
  const [token, setToken] = useState(localStorage.getItem("admin_token"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stats, setStats] = useState(null);
  const [resumes, setResumes] = useState([]);

  const login = async () => {
    try {
      const res = await fetch(`${API}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.setItem("admin_token", data.token);
      setToken(data.token);
    } catch (err) {
      alert(err.message);
    }
  };

  const loadData = async () => {
    const headers = { Authorization: `Bearer ${token}` };

    const statsRes = await fetch(`${API}/admin/stats`, { headers });
    const statsData = await statsRes.json();

    const resumeRes = await fetch(`${API}/admin/resumes`, { headers });
    const resumeData = await resumeRes.json();

    setStats(statsData.stats);
    setResumes(resumeData.resumes);
  };

  const logout = () => {
    localStorage.removeItem("admin_token");
    setToken(null);
  };

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  if (!token) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Admin Login</h2>
        <input placeholder="Email" onChange={(e) => setEmail(e.target.value)} /><br/><br/>
        <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} /><br/><br/>
        <button onClick={login}>Login</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <h2>Admin Dashboard</h2>
      <button onClick={logout}>Logout</button>

      {stats && (
        <div>
          <p>Total: {stats.totalResumes}</p>
          <p>Avg Score: {stats.avgScore}</p>
          <p>Avg ATS: {stats.avgAts}</p>
        </div>
      )}

      <h3>Resumes</h3>
      {resumes.map((r) => (
        <div key={r.id}>
          <p>{r.fileName} - Score: {r.overallScore}</p>
        </div>
      ))}
    </div>
  );
}
