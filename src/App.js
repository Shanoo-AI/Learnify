import React, { useEffect, useState, useRef } from "react";
import "./App.css";
import "./Home.css";
import Learnify from "./Learnify";
import MentorBot from "./components/MentorBot";
import QuizModule from "./components/QuizModule";
import { OverviewPage, UserAnalyticsPage } from "./components/dashboard/App";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";
const AUTH_TOKEN_KEY = "learnify_auth_token";

const getAuthHeaders = () => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const installAuthFetch = () => {
  if (window.__learnifyAuthFetchInstalled) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url;
    if (!url || !url.startsWith(API_BASE)) return originalFetch(input, init);

    const headers = new Headers(init.headers || {});
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    return originalFetch(input, { ...init, headers });
  };

  window.__learnifyAuthFetchInstalled = true;
};

const NAV_ITEMS = [
  { id: "home", label: "Home" },
  { id: "user-analytics", label: "User Analytics" },
  { id: "audio", label: "Audio Overview" },
  { id: "youtube", label: "YouTube Learning" },
  { id: "past-papers", label: "Past Papers" },
  { id: "mentor", label: "MentorBot" },
  { id: "quiz", label: "Quiz" },
  { id: "support", label: "Support" },
];

export default function App() {
  installAuthFetch();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activePage, setActivePage] = useState("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [formData, setFormData] = useState({ name: "", email: "", password: "", otp: "" });
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [authMsg, setAuthMsg] = useState({ text: "", ok: true });
  const [userName, setUserName] = useState("");
  const [papers, setPapers] = useState([]);
  const [papersLoading, setPapersLoading] = useState(false);
  const [papersError, setPapersError] = useState("");
  const [previewPaper, setPreviewPaper] = useState(null);
  const [paperSearch, setPaperSearch] = useState("");

  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [language, setLanguage] = useState("en");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioError, setAudioError] = useState("");
  const [audioLoading, setAudioLoading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authToken = params.get("auth_token");
    const googleUser = params.get("user");

    if (authToken) {
      localStorage.setItem(AUTH_TOKEN_KEY, authToken);
      setIsLoggedIn(true);
      setUserName(googleUser || "");
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    fetch(`${API_BASE}/check-session`, {
      credentials: "include",
      headers: getAuthHeaders(),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.logged_in) {
          setIsLoggedIn(true);
          setUserName(d.user || "");
        }
      })
      .catch(() => {});

    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const handleChange = (e) =>
    setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));

  const loginVerify = () =>
    fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => {
        setAuthMsg({ text: d.reply, ok: !!d.success });
        if (d.success) {
          if (d.auth_token) localStorage.setItem(AUTH_TOKEN_KEY, d.auth_token);
          setIsLoggedIn(true);
          setUserName(d.user || formData.name);
        }
      });

  const registerUser = () =>
    fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => {
        setAuthMsg({ text: d.reply, ok: !!d.success });
        if (d.success && d.requires_otp) setAwaitingOtp(true);
      });

  const verifyRegistration = () =>
    fetch(`${API_BASE}/verify-registration`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: formData.email, otp: formData.otp }),
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => {
        setAuthMsg({ text: d.reply, ok: !!d.success });
        if (d.success) {
          setAwaitingOtp(false);
          setAuthMode("login");
          setFormData((prev) => ({ ...prev, password: "", otp: "" }));
        }
      });

  const handleLogout = async () => {
    await fetch(`${API_BASE}/logout`, {
      credentials: "include",
      headers: getAuthHeaders(),
    });
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setIsLoggedIn(false);
    setUserName("");
    setFormData({ name: "", email: "", password: "", otp: "" });
    setAwaitingOtp(false);
    setFile(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl("");
    setAudioError("");
    setPapers([]);
    setPapersError("");
    setPreviewPaper(null);
    setPaperSearch("");
    setActivePage("home");
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE}/google-start`;
  };

  const pickFile = (f) => {
    if (!f) return;
    setFile(f);
    setAudioError("");
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl("");
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files?.[0]);
  };

  const fetchPastPapers = async () => {
    setPapersLoading(true);
    setPapersError("");

    try {
      const res = await fetch(`${API_BASE}/api/past-papers`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.reply || "Failed to load past papers");
      }

      setPapers(Array.isArray(data.papers) ? data.papers : []);
    } catch (err) {
      setPapersError(err.message || "Unable to load papers");
    } finally {
      setPapersLoading(false);
    }
  };

  const generateAudio = async () => {
    if (!file) {
      setAudioError("Please select a PPT, PPTX, or PDF file first.");
      return;
    }

    setAudioLoading(true);
    setAudioError("");

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl("");
    }

    const form = new FormData();
    form.append("file", file);
    form.append("language", language);

    try {
      const res = await fetch(`${API_BASE}/api/generate-audio`, {
        method: "POST",
        body: form,
        credentials: "include",
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Generation failed");
      }

      setAudioUrl(URL.createObjectURL(await res.blob()));
    } catch (err) {
      setAudioError(err.message);
    } finally {
      setAudioLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn && activePage === "past-papers") {
      fetchPastPapers();
    }
  }, [isLoggedIn, activePage]);

  const searchTerm = paperSearch.trim().toLowerCase();
  const filteredPapers = papers.filter((paper) =>
    [
      paper.subject,
      paper.course_code,
      paper.course,
      paper.year,
      paper.paper_type,
      paper.type,
      paper.file_name,
      paper.filename,
      paper.semester,
      paper.title,
      paper.name,
      paper.paper_name,
    ].some((value) => String(value || "").toLowerCase().includes(searchTerm))
  );

  if (!isLoggedIn)
    return (
      <div className="root">
        <aside className="auth-left">
          <div className="auth-left-inner">
            <span className="wordmark">LEARNIFY</span>
            <h1 className="hero-heading">
              Learn
              <br />
              <em>smarter.</em>
            </h1>
            <p className="hero-sub">
              AI-powered education that adapts to the way you think.
            </p>
            <div className="stat-row">
              {[
                ["12k+", "Learners"],
                ["98%", "Satisfaction"],
                ["40+", "Courses"],
              ].map(([n, l]) => (
                <div key={l} className="stat">
                  <span className="stat-num">{n}</span>
                  <span className="stat-lbl">{l}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="deco-rings" aria-hidden="true">
            <div className="ring r1" />
            <div className="ring r2" />
            <div className="ring r3" />
          </div>
        </aside>

        <main className="auth-right">
          <div className="auth-box">
            <div className="tab-toggle">
              <button
                className={authMode === "login" ? "tog active" : "tog"}
                onClick={() => {
                  setAuthMode("login");
                  setAwaitingOtp(false);
                  setAuthMsg({ text: "", ok: true });
                }}
              >
                Sign in
              </button>
              <button
                className={authMode === "register" ? "tog active" : "tog"}
                onClick={() => {
                  setAuthMode("register");
                  setAwaitingOtp(false);
                  setAuthMsg({ text: "", ok: true });
                }}
              >
                Register
              </button>
            </div>

            <label className="lbl">Username</label>
            <input
              className="inp"
              type="text"
              name="name"
              placeholder="username"
              value={formData.name}
              onChange={handleChange}
              disabled={awaitingOtp}
            />
            {authMode === "register" && (
              <>
                <label className="lbl">Email</label>
                <input
                  className="inp"
                  type="email"
                  name="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={awaitingOtp}
                />
              </>
            )}
            <label className="lbl">Password</label>
            <input
              className="inp"
              type="password"
              name="password"
              placeholder="••••••••••"
              value={formData.password}
              onChange={handleChange}
              disabled={awaitingOtp}
            />
            {authMode === "register" && awaitingOtp && (
              <>
                <label className="lbl">Email OTP</label>
                <input
                  className="inp"
                  type="text"
                  name="otp"
                  placeholder="6-digit code"
                  value={formData.otp}
                  onChange={handleChange}
                  maxLength={6}
                />
              </>
            )}

            {authMode === "login" ? (
              <button className="cta" onClick={loginVerify}>
                Sign in
              </button>
            ) : awaitingOtp ? (
              <button className="cta" onClick={verifyRegistration}>
                Verify OTP
              </button>
            ) : (
              <button className="cta" onClick={registerUser}>
                Send OTP
              </button>
            )}

            <div className="divider">
              <span>or</span>
            </div>
            <button className="google-btn" onClick={handleGoogleLogin}>
              <GoogleIcon />
              Continue with Google
            </button>

            {authMsg.text && (
              <p className={authMsg.ok ? "msg ok" : "msg err"}>{authMsg.text}</p>
            )}
          </div>
        </main>
      </div>
    );

  return (
    <div className="root app">
      <aside className={`sidebar${sidebarCollapsed ? " collapsed" : ""}`}>
        <div className="sidebar-head">
          <span className="wordmark small">{sidebarCollapsed ? "L" : "Learnify"}</span>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? ">" : "<"}
          </button>
        </div>
        <nav className="sidenav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`slink${activePage === item.id ? " active" : ""}`}
              onClick={() => setActivePage(item.id)}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <span className="slink-pip" />
              <span className="slink-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <button
          className="logout-btn"
          onClick={handleLogout}
          title={sidebarCollapsed ? "Sign out" : undefined}
        >
          <span className="logout-label">Sign out</span>
        </button>
      </aside>

      <div className="content">
        <header className="topbar">
          <div>
            <p className="page-label">
              {NAV_ITEMS.find((i) => i.id === activePage)?.label}
            </p>
            <h2 className="greeting">
              Hello, <span className="gold">{userName || "Learner"}</span>
            </h2>
          </div>
          <span className="platform-tag">Learnify Learning Hub</span>
        </header>

        <div className="page-area">
          {activePage === "home" && (
  <div className="home-actions">

    <div className="card welcome-card">
      <p className="card-eyebrow">Welcome</p>
      <h3 className="card-title">Start learning with Learnify</h3>
      <p className="card-body">
        Use the quick cards below to jump directly into each learning module.
      </p>
    </div>

    <div className="home-grid cards-5">

      <div className="card action-card" onClick={() => setActivePage("audio")}>
        <div className="action-card-icon i-audio">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
        </div>
        <p className="card-eyebrow">Audio</p>
        <h3 className="card-title">Audio Overview</h3>
        <p className="card-body">
          Convert your PPT or PDF files into AI-generated narration.
        </p>
        <div className="wave-wrap">
          {[...Array(9)].map((_, i) => <div key={i} className="wave-bar"></div>)}
        </div>
        <button className="cta small" onClick={(e) => { e.stopPropagation(); setActivePage("audio"); }}>
          Open Audio Overview
        </button>
      </div>

      <div className="card action-card" onClick={() => setActivePage("youtube")}>
        <div className="action-card-icon i-video">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
        </div>
        <p className="card-eyebrow">Video</p>
        <h3 className="card-title">YouTube Learning</h3>
        <p className="card-body">
          Upload study files and get a curated video playlist by topic.
        </p>
        <button className="cta small" onClick={(e) => { e.stopPropagation(); setActivePage("youtube"); }}>
          Open YouTube Learning
        </button>
      </div>

      <div className="card action-card" onClick={() => setActivePage("past-papers")}>
        <div className="action-card-icon i-lib">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
        </div>
        <p className="card-eyebrow">Library</p>
        <h3 className="card-title">Past Papers</h3>
        <p className="card-body">
          Browse and open uploaded past papers from your collection.
        </p>
        <button className="cta small" onClick={(e) => { e.stopPropagation(); setActivePage("past-papers"); }}>
          Open Past Papers
        </button>
      </div>

      <div className="card action-card" onClick={() => setActivePage("mentor")}>

        <div className="action-card-icon i-bot">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2"/>
            <circle cx="12" cy="5" r="2"/>
            <path d="M12 7v4"/>
            <line x1="8" y1="16" x2="8" y2="16"/>
            <line x1="16" y1="16" x2="16" y2="16"/>
          </svg>
        </div>
        <p className="card-eyebrow">Assistant</p>
        <h3 className="card-title">MentorBot</h3>
        <p className="card-body">
          An interactive teacher assistant experience is on the way.
        </p>
        <div className="orb-wrap">
          <div className="orb">
            <div className="orb-inner">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" stroke="#378add">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
          </div>
        </div>
        <button className="cta small" onClick={(e) => { e.stopPropagation(); setActivePage("mentor"); }}>
          View MentorBot
        </button>
      </div>

      <div className="card action-card" onClick={() => setActivePage("quiz")}>
        <div className="action-card-icon i-quiz">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l2 2 4-4"/>
            <path d="M20 6v14H4V4h10"/>
            <path d="M14 4h6v6"/>
          </svg>
        </div>
        <p className="card-eyebrow">Practice</p>
        <h3 className="card-title">Quiz Studio</h3>
        <p className="card-body">
          Generate subject quizzes, answer questions, and review your score.
        </p>
        <div className="quiz-mini">
          <span>MCQ</span>
          <span>Short</span>
          <span>Mixed</span>
        </div>
        <button className="cta small" onClick={(e) => { e.stopPropagation(); setActivePage("quiz"); }}>
          Open Quiz Studio
        </button>
      </div>

    </div>
    <OverviewPage apiBase={`${API_BASE}/api/dashboard`} />
  </div>
)}

          {activePage === "user-analytics" && (
            <UserAnalyticsPage userName={userName} apiBase={`${API_BASE}/api/dashboard`} />
          )}

          {activePage === "audio" && (
            <div className="card audio-card">
              <p className="card-eyebrow">AI Tool</p>
              <h3 className="card-title">
                Slide <span className="gold">to</span> Audio
              </h3>
              <p className="card-body">
                Upload a presentation or PDF and get a professional AI-narrated
                audio file.
              </p>

              <div
                className={`dropzone${dragging ? " over" : ""}${file ? " filled" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".ppt,.pptx,.pdf"
                  style={{ display: "none" }}
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
                {file ? (
                  <div className="file-chip">
                    <span className="file-ico">
                      {file.name.endsWith(".pdf") ? "PDF" : "PPT"}
                    </span>
                    <div>
                      <p className="file-name">{file.name}</p>
                      <p className="file-meta">
                        {(file.size / 1024).toFixed(1)} KB | click to replace
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="drop-hint">
                    <span className="drop-arrow">Upload</span>
                    <p>
                      Drop file here or <u>browse</u>
                    </p>
                    <p className="drop-types">PPT | PPTX | PDF</p>
                  </div>
                )}
              </div>

              <div className="controls-row">
                <select
                  className="lang-select"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="ur">Urdu</option>
                </select>
                <button
                  className="cta small grow"
                  onClick={generateAudio}
                  disabled={audioLoading}
                >
                  {audioLoading ? (
                    <>
                      <span className="spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Audio"
                  )}
                </button>
              </div>

              {audioError && <p className="msg err">{audioError}</p>}

              {audioUrl && (
                <div className="result-strip">
                  <span className="result-badge">Ready</span>
                  <audio controls src={audioUrl} className="aplayer" />
                  <a href={audioUrl} download="audio.mp3" className="dl-link">
                    Download MP3
                  </a>
                </div>
              )}
            </div>
          )}

          {activePage === "youtube" && (
            <div className="card" style={{ padding: 0, border: "none" }}>
              <Learnify />
            </div>
          )}

          {activePage === "past-papers" && (
            <div className="card past-papers-card">
              <p className="card-eyebrow">Library</p>
              <h3 className="card-title">Past Papers</h3>
              <p className="card-body">
                Review previously uploaded papers from MongoDB Atlas.
              </p>

              <div className="paper-search-wrap">
                <input
                  type="text"
                  className="paper-search"
                  placeholder="Search by subject, course code, year, or paper type..."
                  value={paperSearch}
                  onChange={(e) => setPaperSearch(e.target.value)}
                />
              </div>

              {papersLoading && <p className="card-body">Loading papers...</p>}
              {papersError && <p className="msg err">{papersError}</p>}

              {!papersLoading && !papersError && papers.length === 0 && (
                <p className="card-body">No past papers found yet.</p>
              )}

              {!papersLoading && !papersError && papers.length > 0 && filteredPapers.length === 0 && (
                <p className="card-body">No papers match your search.</p>
              )}

              {!papersLoading && filteredPapers.length > 0 && (
                <p className="paper-meta">Showing {filteredPapers.length} of {papers.length} papers</p>
              )}

              {!papersLoading && filteredPapers.length > 0 && (
                <div className="papers-list">
                  {filteredPapers.map((paper, index) => {
                    const subjectName =
                      paper.subject ||
                      paper.title ||
                      paper.name ||
                      paper.paper_name ||
                      `Paper ${index + 1}`;
                    const courseCode = paper.course_code || paper.course;
                    const year = paper.year;
                    const paperType = paper.paper_type || paper.type;

                    const displayTitle = [
                      `${subjectName}${courseCode ? ` (${courseCode})` : ""}`,
                      year,
                      paperType,
                    ]
                      .filter(Boolean)
                      .join(" ");

                    const fileUrl = paper.file_url
                      ? (String(paper.file_url).startsWith("http")
                          ? paper.file_url
                          : `${API_BASE}${paper.file_url}`)
                      : null;

                    const fileName = paper.file_name || paper.filename || "paper-file";

                    return (
                      <div className="paper-item" key={paper.id || `${displayTitle}-${index}`}>
                        <div className="paper-main">
                          <p className="paper-title">{displayTitle}</p>
                          <p className="paper-meta">{fileName}</p>
                        </div>
                        <div className="paper-actions">
                          {fileUrl ? (
                            <button
                              type="button"
                              className="paper-link"
                              onClick={() =>
                                setPreviewPaper({
                                  title: displayTitle,
                                  fileUrl,
                                  fileName,
                                  isPdf: /\.pdf($|\?)/i.test(fileUrl),
                                })
                              }
                            >
                              Open
                            </button>
                          ) : (
                            <span className="paper-meta">No file linked</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activePage === "mentor" && (
            <MentorBot />
          )}

          {activePage === "quiz" && (
            <QuizModule userName={userName} />
          )}


          {activePage === "support" && (
            <div className="support-page">
              <div className="support-hero">
                <p className="card-eyebrow">Support</p>
                <h3 className="support-title">Contact The Learnify Team</h3>
                <p className="support-subtitle">
                  Reach out for account help, course uploads, YouTube learning issues,
                  quiz support, or dashboard questions.
                </p>
              </div>

              <div className="support-grid">
                <article className="support-profile-card">
                  <div className="support-photo-wrap">
                    <img
                      className="support-photo soban-photo"
                      src="/Soban.JPG"
                      alt="Muhammad Soban Bashir"
                    />
                  </div>
                  <div className="support-profile-body">
                    <p className="support-role">Primary Support</p>
                    <h4>Muhammad Soban Bashir</h4>
                    <div className="support-contact-list">
                      <a href="mailto:soban.bscs@gmail.com">
                        <span>Email</span>
                        soban.bscs@gmail.com
                      </a>
                      <a href="tel:+923125621477">
                        <span>Phone</span>
                        +92 312 5621477
                      </a>
                      <a
                        href="https://wa.me/923125621477"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span>WhatsApp</span>
                        +92 312 5621477
                      </a>
                    </div>
                  </div>
                </article>

                <article className="support-profile-card">
                  <div className="support-photo-wrap">
                    <img
                      className="support-photo sarim-photo"
                      src="/Sarim.JPG"
                      alt="Muhammad Saraam"
                    />
                  </div>
                  <div className="support-profile-body">
                    <p className="support-role">Technical Support</p>
                    <h4>Muhammad Saraam</h4>
                    <div className="support-contact-list">
                      <a href="mailto:sarimmuhammad711@gmail.com">
                        <span>Email</span>
                        sarimmuhammad711@gmail.com
                      </a>
                      <a href="tel:+923235500710">
                        <span>Phone</span>
                        +92 323 5500710
                      </a>
                      <a
                        href="https://wa.me/923235500710"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span>WhatsApp</span>
                        +92 323 5500710
                      </a>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          )}

          {previewPaper && (
            <div
              className="paper-modal-backdrop"
              onClick={() => setPreviewPaper(null)}
              role="presentation"
            >
              <div
                className="paper-modal"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
              >
                <div className="paper-modal-head">
                  <p className="paper-modal-title">{previewPaper.title}</p>
                  <button
                    type="button"
                    className="paper-modal-close"
                    onClick={() => setPreviewPaper(null)}
                  >
                    x
                  </button>
                </div>

                <div className="paper-preview-wrap">
                  {previewPaper.isPdf ? (
                    <iframe
                      src={previewPaper.fileUrl}
                      className="paper-preview-frame"
                      title={previewPaper.title}
                    />
                  ) : (
                    <p className="paper-meta">
                      Preview is only available for PDF files. Use download below.
                    </p>
                  )}
                </div>

                <div className="paper-modal-actions">
                  <a
                    href={previewPaper.fileUrl}
                    className="paper-link"
                    download={previewPaper.fileName}
                  >
                    Download
                  </a>
                  <a
                    href={previewPaper.fileUrl}
                    className="paper-link"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in new tab
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 48 48"
      style={{ flexShrink: 0 }}
    >
      <path
        fill="#FFC107"
        d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.1-2.7-.4-4z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-1.9 13.6-5.1l-6.3-5.1C29.5 35.6 26.9 36 24 36c-5.2 0-9.5-2.9-11.3-7l-6.6 4.9C9.7 39.7 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.8l6.3 5.1C41 35.7 44 30.3 44 24c0-1.3-.1-2.7-.4-4z"
      />
    </svg>
  );
}
