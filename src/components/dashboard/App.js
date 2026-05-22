import { useState, useEffect } from 'react';
import './Dashboard.css';

const DEFAULT_BASE = process.env.REACT_APP_DASHBOARD_API_BASE || 'http://localhost:5001';

// ─── ICONS ───────────────────────────────────
const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const Icons = {
  grid:    "M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z",
  user:    "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  quiz:    "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
  trend:   "M22 12h-4l-3 9L9 3l-3 9H2",
  trophy:  "M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z",
  book:    "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
  logout:  "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  check:   "M20 6 9 17l-5-5",
  warn:    "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  target:  "M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zM12 8v4l3 3",
};

// ─── API ─────────────────────────────────────
function buildDashboardUrl(apiBase, path) {
  const base = (apiBase || DEFAULT_BASE).replace(/\/$/, '');
  const prefix = base.endsWith('/api/dashboard') ? '' : '/dashboard';
  return `${base}${prefix}${path}`;
}

async function api(apiBase, path) {
  const res = await fetch(buildDashboardUrl(apiBase, path), {
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── HELPERS ─────────────────────────────────
function scoreClass(pct) {
  if (pct >= 70) return 'score-high';
  if (pct >= 40) return 'score-mid';
  return 'score-low';
}
function diffClass(d) {
  if (!d) return '';
  const l = d.toLowerCase();
  if (l === 'easy') return 'diff-easy';
  if (l === 'hard') return 'diff-hard';
  return 'diff-medium';
}
function rankClass(i) {
  if (i === 0) return 'rank-1';
  if (i === 1) return 'rank-2';
  if (i === 2) return 'rank-3';
  return 'rank-n';
}
function rankMedal(i) {
  if (i === 0) return 'Gold';
  if (i === 1) return 'Silver';
  if (i === 2) return 'Bronze';
  return i + 1;
}
function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}
function initials(name) {
  return (name || '?').slice(0, 2).toUpperCase();
}

// ─── SKELETON ────────────────────────────────
function SkeletonStats() {
  return (
    <div className="stats-grid">
      {[1,2,3,4].map(i => <div key={i} className={`skeleton skel-stat d${i}`} />)}
    </div>
  );
}
function SkeletonCharts() {
  return (
    <div className="charts-grid">
      <div className="skeleton skel-chart-tall" />
      <div className="skeleton skel-chart-tall" />
    </div>
  );
}

// ─── DONUT CHART ─────────────────────────────
const DONUT_COLORS = { Easy: '#40c057', Medium: '#fab005', Hard: '#e03131', Unknown: '#555' };
function DonutChart({ data }) {
  if (!data || data.length === 0) return <div className="empty-state"><div className="empty-icon">◌</div><div className="empty-title">No data</div></div>;
  const total = data.reduce((s, d) => s + d.count, 0);
  const size = 120; const cx = size / 2; const cy = size / 2; const r = 46; const stroke = 18;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const segments = data.map(d => {
    const frac = total > 0 ? d.count / total : 0;
    const dash = frac * circ;
    const seg = { ...d, dash, offset, color: DONUT_COLORS[d.difficulty] || '#666' };
    offset += dash;
    return seg;
  });

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#272727" strokeWidth={stroke} />
        {segments.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color} strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${circ}`}
            strokeDashoffset={-s.offset}
            style={{ animation: `fadeIn 0.6s ${i * 0.1}s ease both`, filter: `drop-shadow(0 0 4px ${s.color}44)` }}
          />
        ))}
        <text x={cx} y={cy} fill="#f0f0f0" fontSize="18" fontWeight="700"
          textAnchor="middle" dominantBaseline="middle"
          fontFamily="Syne, sans-serif" style={{ transform: 'rotate(90deg)', transformOrigin: `${cx}px ${cy}px` }}>
          {total}
        </text>
      </svg>
      <div className="donut-legend">
        {segments.map((s, i) => (
          <div key={i} className="legend-row">
            <div className="legend-dot-label">
              <div className="legend-dot" style={{ background: s.color, boxShadow: `0 0 5px ${s.color}88` }} />
              {s.difficulty}
            </div>
            <span className="legend-val">{s.count} ({total > 0 ? Math.round(s.count / total * 100) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BAR CHART ───────────────────────────────
function BarChart({ data, labelKey, valueKey }) {
  if (!data || data.length === 0) return <div className="empty-state"><div className="empty-icon">▭</div><div className="empty-title">No data</div></div>;
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div className="bar-chart">
      {data.map((d, i) => (
        <div key={i} className={`bar-row anim-fade d${Math.min(i + 1, 6)}`}>
          <span className="bar-label" title={d[labelKey]}>{d[labelKey]}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(d[valueKey] / max) * 100}%`, '--bar-w': `${(d[valueKey] / max) * 100}%` }} />
          </div>
          <span className="bar-pct">{d[valueKey]}%</span>
        </div>
      ))}
    </div>
  );
}

// ─── LINE CHART ──────────────────────────────
function LineChart({ data }) {
  if (!data || data.length < 2) return (
    <div className="empty-state"><div className="empty-icon">〰</div><div className="empty-title">Need more quizzes</div><div className="empty-sub">Take at least 2 quizzes to see trend</div></div>
  );
  const W = 480; const H = 160; const PAD = { t: 16, r: 16, b: 30, l: 36 };
  const pts = data;
  const vals = pts.map(p => p.percentage);
  const minV = Math.max(0, Math.min(...vals) - 10);
  const maxV = Math.min(100, Math.max(...vals) + 10);
  const xScale = i => PAD.l + (i / (pts.length - 1)) * (W - PAD.l - PAD.r);
  const yScale = v => PAD.t + (1 - (v - minV) / (maxV - minV)) * (H - PAD.t - PAD.b);

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(p.percentage)}`).join(' ');
  const areaPath = `${linePath} L${xScale(pts.length - 1)},${H - PAD.b} L${xScale(0)},${H - PAD.b} Z`;

  const yTicks = [0, 25, 50, 75, 100].filter(v => v >= minV && v <= maxV);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="svg-chart" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e03131" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#e03131" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="lineStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#e03131"/>
          <stop offset="100%" stopColor="#ff6b6b"/>
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map(v => (
        <g key={v}>
          <line x1={PAD.l} y1={yScale(v)} x2={W - PAD.r} y2={yScale(v)} stroke="#272727" strokeWidth={1} />
          <text x={PAD.l - 6} y={yScale(v)} fill="#555" fontSize="9" textAnchor="end" dominantBaseline="middle" fontFamily="JetBrains Mono">{v}</text>
        </g>
      ))}

      {/* Area */}
      <path d={areaPath} fill="url(#lineGrad)" />

      {/* Line */}
      <path d={linePath} fill="none" stroke="url(#lineStroke)" strokeWidth={2}
        style={{ strokeDasharray: 1000, strokeDashoffset: 1000, animation: 'drawLine 1.2s ease forwards' }} />

      {/* Dots */}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={xScale(i)} cy={yScale(p.percentage)} r={4} fill="#e03131"
            style={{ animation: `fadeIn 0.3s ${i * 0.06}s ease both`, filter: 'drop-shadow(0 0 3px #e0313188)' }} />
          <circle cx={xScale(i)} cy={yScale(p.percentage)} r={7} fill="transparent" stroke="#e03131" strokeWidth={1} strokeOpacity={0.3}
            style={{ animation: `fadeIn 0.3s ${i * 0.06}s ease both` }} />
        </g>
      ))}

      {/* X labels */}
      {pts.map((p, i) => (
        i % Math.max(1, Math.floor(pts.length / 6)) === 0 && (
          <text key={i} x={xScale(i)} y={H - PAD.b + 14} fill="#555" fontSize="9"
            textAnchor="middle" fontFamily="DM Sans">
            #{p.quiz_num}
          </text>
        )
      ))}
    </svg>
  );
}

// ─── SCORE DIST BARS ─────────────────────────
function ScoreDistChart({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  const colors = { '0-25': '#e03131', '26-50': '#fab005', '51-75': '#339af0', '76-100': '#40c057' };
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: 80 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: colors[d.range] || '#999', fontWeight: 600 }}>{d.count}</span>
          <div style={{
            width: '100%', borderRadius: '4px 4px 0 0',
            background: colors[d.range] || '#555',
            height: `${Math.max(4, (d.count / max) * 56)}px`,
            boxShadow: `0 0 8px ${(colors[d.range] || '#555')}44`,
            animation: `barGrow 0.8s ${i * 0.1}s var(--ease) both`,
            transformOrigin: 'bottom',
          }} />
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{d.range}</span>
        </div>
      ))}
    </div>
  );
}

// ─── OVERVIEW PAGE ───────────────────────────
export function OverviewPage({ apiBase = DEFAULT_BASE } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api(apiBase, '/overview')
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [apiBase]);

  if (loading) return (
    <div className="dashboard-module">
      <div className="dashboard-content">
        <div className="page-header">
          <div className="page-tag">OVERVIEW</div>
          <div className="page-title">Learning <span>Overview</span></div>
        </div>
        <SkeletonStats />
        <SkeletonCharts />
      </div>
    </div>
  );

  if (error) return (
    <div className="dashboard-module">
      <div className="dashboard-content">
        <div className="empty-state">
          <Icon d={Icons.warn} size={32} />
          <div className="empty-title">Failed to load dashboard</div>
          <div className="empty-sub">{error}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="dashboard-module">
      <div className="dashboard-content">
      <div className="page-header">
        <div className="page-tag">OVERVIEW</div>
        <div className="page-title">Learning <span>Overview</span></div>
        <div className="page-subtitle">Quiz insights from your Learnify activity</div>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        {[
          { label: 'Total Quizzes', value: data.total_quizzes, icon: Icons.quiz, delay: 'd1' },
          { label: 'Total Users', value: data.total_users, icon: Icons.user, delay: 'd2' },
          { label: 'Avg Score', value: `${data.avg_score}%`, icon: Icons.trend, delay: 'd3', cls: data.avg_score >= 70 ? 'green' : data.avg_score >= 40 ? '' : 'red' },
          { label: 'Subjects', value: data.subject_performance?.length || 0, icon: Icons.book, delay: 'd4' },
        ].map(({ label, value, icon, delay, cls }) => (
          <div key={label} className={`stat-card ${delay}`}>
            <div className="stat-icon"><Icon d={icon} /></div>
            <div className="stat-label">{label}</div>
            <div className={`stat-value anim-count ${cls || ''}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="charts-grid">
        <div className="chart-card d1">
          <div className="chart-header">
            <div><div className="chart-title">Subject Performance</div><div className="chart-subtitle">Avg score by subject</div></div>
            <span className="chart-badge">{data.subject_performance?.length || 0} subjects</span>
          </div>
          <BarChart data={data.subject_performance} labelKey="subject" valueKey="avg_percentage" />
        </div>
        <div className="chart-card d2">
          <div className="chart-header">
            <div><div className="chart-title">Difficulty Split</div><div className="chart-subtitle">Quiz distribution</div></div>
          </div>
          <DonutChart data={data.difficulty_distribution} />
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="charts-grid">
        <div className="chart-card d1">
          <div className="chart-header">
            <div><div className="chart-title">Top Performers</div><div className="chart-subtitle">Ranked by avg score</div></div>
            <span className="chart-badge">Top 3</span>
          </div>
          {data.top_performers && data.top_performers.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>User</th>
                  <th>Avg Score</th>
                  <th>Quizzes</th>
                  <th>Questions</th>
                </tr>
              </thead>
              <tbody>
                {data.top_performers.map((p, i) => (
                  <tr key={p.username}>
                    <td><span className={`rank-badge ${rankClass(i)}`}>{rankMedal(i)}</span></td>
                    <td>
                      <div className="td-user">
                        <div className="td-avatar">{initials(p.username)}</div>
                        <span className="td-name">{p.username}</span>
                      </div>
                    </td>
                    <td><span className={`score-chip ${scoreClass(p.avg_percentage)}`}>{p.avg_percentage}%</span></td>
                    <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--text)' }}>{p.total_quizzes}</td>
                    <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{p.total_correct}/{p.total_questions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state"><div className="empty-icon">🏆</div><div className="empty-title">No performers yet</div></div>
          )}
        </div>
        <div className="chart-card d2">
          <div className="chart-header">
            <div><div className="chart-title">Score Distribution</div><div className="chart-subtitle">Users by score range</div></div>
          </div>
          <ScoreDistChart data={data.score_distribution} />
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── USER PAGE ───────────────────────────────
export function UserAnalyticsPage({ userName = '', apiBase = DEFAULT_BASE } = {}) {
  const [selected, setSelected] = useState(userName || '');
  const users = [];
  const usersLoading = false;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setSelected(userName || '');
  }, [userName]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setData(null);
    api(apiBase, `/user/${encodeURIComponent(selected)}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [apiBase, selected]);

  return (
    <div className="dashboard-module">
      <div className="dashboard-content">
      <div className="page-header">
        <div className="page-tag">USER ANALYTICS</div>
        <div className="page-title">Student <span>Performance</span></div>
        <div className="page-subtitle">
          {selected ? `Deep-dive quiz analytics for ${selected}` : 'Deep-dive quiz analytics for the logged-in user'}
        </div>
      </div>

      {false && (
      <div className="user-selector">
        <label>Select User:</label>
        {usersLoading ? (
          <div className="skeleton" style={{ width: 180, height: 36, borderRadius: 10 }} />
        ) : (
          <select className="user-select" value={selected} onChange={e => setSelected(e.target.value)}>
            <option value="">— choose a user —</option>
            {users.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        )}
      </div>
      )}

      {!selected && (
        <div className="empty-state">
          <div className="empty-icon">👤</div>
          <div className="empty-title">No logged-in user found</div>
          <div className="empty-sub">Sign in again so Learnify can load your analytics.</div>
        </div>
      )}

      {loading && (
        <>
          <SkeletonStats />
          <SkeletonCharts />
        </>
      )}

      {error && (
        <div className="empty-state">
          <Icon d={Icons.warn} size={28} />
          <div className="empty-title">Error loading user data</div>
          <div className="empty-sub">{error}</div>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Summary cards */}
          <div className="stats-grid">
            {[
              { label: 'Total Quizzes', value: data.summary.total_quizzes, icon: Icons.quiz, delay: 'd1' },
              { label: 'Avg Score', value: `${data.summary.avg_percentage}%`, icon: Icons.trend, delay: 'd2', cls: scoreClass(data.summary.avg_percentage).replace('score-', '') },
              { label: 'Best Score', value: `${data.summary.best_score}%`, icon: Icons.trophy, delay: 'd3', cls: 'green' },
              { label: 'Latest Score', value: `${data.summary.latest_score}%`, icon: Icons.target, delay: 'd4', cls: scoreClass(data.summary.latest_score).replace('score-', '') },
            ].map(({ label, value, icon, delay, cls }) => (
              <div key={label} className={`stat-card ${delay}`}>
                <div className="stat-icon"><Icon d={icon} /></div>
                <div className="stat-label">{label}</div>
                <div className={`stat-value anim-count ${cls === 'mid' ? '' : cls || ''}`}>{value}</div>
                {label === 'Total Quizzes' && (
                  <div className="stat-sub">{data.summary.total_correct}/{data.summary.total_questions} correct</div>
                )}
              </div>
            ))}
          </div>

          {/* Score trend + subject breakdown */}
          <div className="charts-grid">
            <div className="chart-card d1">
              <div className="chart-header">
                <div><div className="chart-title">Score Trend</div><div className="chart-subtitle">Quiz performance over time</div></div>
                <span className="chart-badge">{data.score_trend.length} quizzes</span>
              </div>
              <LineChart data={data.score_trend} />
            </div>
            <div className="chart-card d2">
              <div className="chart-header">
                <div><div className="chart-title">Subject Breakdown</div><div className="chart-subtitle">Performance by subject</div></div>
              </div>
              <BarChart data={data.subject_breakdown} labelKey="subject" valueKey="avg_percentage" />
            </div>
          </div>

          {/* Difficulty + Weak topics */}
          <div className="charts-grid">
            <div className="chart-card d1">
              <div className="chart-header">
                <div><div className="chart-title">Difficulty Performance</div><div className="chart-subtitle">Score by difficulty level</div></div>
              </div>
              <div className="bar-chart">
                {data.difficulty_performance.map((d, i) => (
                  <div key={d.difficulty} className={`bar-row anim-fade d${i + 1}`}>
                    <span className="bar-label">{d.difficulty}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${d.avg_percentage}%` }} />
                    </div>
                    <span className="bar-pct">{d.avg_percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="chart-card d2">
              <div className="chart-header">
                <div><div className="chart-title">Weak Topics</div><div className="chart-subtitle">Topics scoring below 50%</div></div>
                <span className="chart-badge" style={{ color: 'var(--red)', borderColor: 'rgba(224,49,49,0.3)' }}>
                  {data.weak_topics.length} found
                </span>
              </div>
              {data.weak_topics.length > 0 ? (
                <div className="weak-list">
                  {data.weak_topics.map((t, i) => (
                    <div key={t.topic} className={`weak-item anim-fade d${Math.min(i+1,6)}`}>
                      <span className="weak-label" title={t.topic}>{t.topic}</span>
                      <div className="weak-track">
                        <div className="weak-fill" style={{ width: `${t.avg_percentage}%` }} />
                      </div>
                      <span className="weak-pct">{t.avg_percentage}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '24px 0' }}>
                  <Icon d={Icons.check} size={28} />
                  <div className="empty-title" style={{ color: 'var(--green)' }}>No weak topics!</div>
                  <div className="empty-sub">Scoring ≥50% on everything</div>
                </div>
              )}
            </div>
          </div>

          {/* Recent activity */}
          <div className="chart-card" style={{ marginBottom: 14 }}>
            <div className="chart-header">
              <div><div className="chart-title">Recent Activity</div><div className="chart-subtitle">Last 5 quizzes</div></div>
            </div>
            <div className="activity-list">
              {data.recent_activity.map((a, i) => (
                <div key={a.quiz_id || i} className={`activity-item anim-fade d${Math.min(i+1,6)}`}>
                  <div className="activity-left">
                    <div className="activity-subject">{a.subject} — {a.topic}</div>
                    <div className="activity-meta">{fmtTime(a.submitted_at)} · {a.score}/{a.total} correct</div>
                  </div>
                  <div className="activity-right">
                    <span className={`activity-score ${a.percentage >= 70 ? '' : a.percentage >= 40 ? '' : ''}`}
                      style={{ color: a.percentage >= 70 ? 'var(--green)' : a.percentage >= 40 ? 'var(--yellow)' : 'var(--red)' }}>
                      {a.percentage}%
                    </span>
                    <span className={`activity-diff ${diffClass(a.difficulty)}`}>{a.difficulty}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────
export default function App() {
  const [page, setPage] = useState('overview');

  const nav = [
    { id: 'overview', label: 'Overview', icon: Icons.grid },
    { id: 'user',     label: 'User Analytics', icon: Icons.user },
  ];

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">L</div>
          <span className="logo-text">Learnify</span>
        </div>
        <div className="sidebar-section-label">Menu</div>
        <nav className="sidebar-nav">
          {nav.map(({ id, label, icon }) => (
            <button key={id} className={`nav-btn ${page === id ? 'active' : ''}`} onClick={() => setPage(id)}>
              <Icon d={icon} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">AD</div>
            <span className="user-name">Admin</span>
          </div>
          <button className="nav-btn">
            <Icon d={Icons.logout} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <span className="breadcrumb-home">HOME</span>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-page">{page === 'overview' ? 'Overview' : 'User Analytics'}</span>
          </div>
          <div className="topbar-right">
            <span className="hub-badge">LEARNIFY HUB</span>
          </div>
        </header>

        {page === 'overview' && <OverviewPage />}
        {page === 'user'     && <UserAnalyticsPage />}
      </div>
    </div>
  );
}
