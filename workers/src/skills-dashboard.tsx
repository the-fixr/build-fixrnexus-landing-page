/**
 * Fixr Skills Dashboard — Public page showing skill registry,
 * confidence scores, lessons learned, and learning reports.
 */

import { Skill } from './lib/skills';
import { LearningReport } from './lib/learning';
import { SelfModification } from './lib/selfmod';

export interface SkillsDashboardData {
  skills: Skill[];
  totalSkills: number;
  activeSkills: number;
  avgConfidence: number;
  latestReport: LearningReport | null;
  pendingMods: SelfModification[];
  recentMods: SelfModification[];
}

function confidenceColor(c: number): string {
  if (c >= 0.8) return '#10b981';
  if (c >= 0.6) return '#8b5cf6';
  if (c >= 0.4) return '#f59e0b';
  return '#ef4444';
}

function confidenceBar(c: number): string {
  const pct = Math.round(c * 100);
  const color = confidenceColor(c);
  return `<div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
}

function safetyBadge(level: string): string {
  const colors: Record<string, string> = {
    safe: '#10b981',
    moderate: '#f59e0b',
    risky: '#ef4444',
  };
  return `<span class="badge" style="border-color:${colors[level] || '#666'};color:${colors[level] || '#666'}">${level}</span>`;
}

function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    pending: '#f59e0b',
    approved: '#8b5cf6',
    applied: '#10b981',
    rejected: '#ef4444',
    rolled_back: '#666',
  };
  return `<span class="badge" style="border-color:${colors[status] || '#666'};color:${colors[status] || '#666'}">${status}</span>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function generateSkillsDashboard(data: SkillsDashboardData): string {
  const { skills, totalSkills, activeSkills, avgConfidence, latestReport, pendingMods, recentMods } = data;

  const activeSkillsSorted = skills
    .filter(s => s.total_uses > 0)
    .sort((a, b) => b.confidence - a.confidence);

  const dormantSkills = skills.filter(s => s.total_uses === 0);

  const skillCards = activeSkillsSorted.map(s => {
    const successPct = s.total_uses > 0 ? Math.round((s.successes / s.total_uses) * 100) : 0;
    const lessonsHtml = (s.lessons || []).slice(-3).map(l =>
      `<div class="lesson">${escapeHtml(l.lesson)}<span class="lesson-meta">${l.source} &middot; ${timeAgo(l.learnedAt)}</span></div>`
    ).join('');
    const errorsHtml = (s.common_errors || []).slice(0, 2).map(e =>
      `<div class="error-item">${escapeHtml(e.errorClass)} <span class="text-dim">&times;${e.count}</span></div>`
    ).join('');

    return `<div class="skill-card">
      <div class="skill-header">
        <div>
          <span class="skill-name">${escapeHtml(s.display_name)}</span>
          <span class="skill-category">${escapeHtml(s.category)}</span>
        </div>
        <span class="confidence-num" style="color:${confidenceColor(s.confidence)}">${(s.confidence * 100).toFixed(0)}%</span>
      </div>
      ${confidenceBar(s.confidence)}
      <div class="skill-stats">
        <span>${s.total_uses} uses</span>
        <span>${successPct}% success</span>
        <span>${s.successes}W / ${s.failures}L</span>
        ${s.avg_duration_ms > 0 ? `<span>${(s.avg_duration_ms / 1000).toFixed(1)}s avg</span>` : ''}
      </div>
      ${lessonsHtml ? `<div class="lessons-section"><div class="lessons-label">Lessons</div>${lessonsHtml}</div>` : ''}
      ${errorsHtml ? `<div class="errors-section"><div class="errors-label">Common Errors</div>${errorsHtml}</div>` : ''}
      ${s.last_used ? `<div class="last-used">Last used: ${timeAgo(s.last_used)}</div>` : ''}
    </div>`;
  }).join('');

  const dormantHtml = dormantSkills.length > 0
    ? `<div class="dormant-list">${dormantSkills.map(s =>
        `<span class="dormant-skill">${escapeHtml(s.display_name)}</span>`
      ).join('')}</div>`
    : '';

  const reportHtml = latestReport
    ? `<div class="report-card">
        <div class="report-summary">${escapeHtml(latestReport.summary)}</div>
        ${latestReport.created_at ? `<div class="report-time">${timeAgo(latestReport.created_at)}</div>` : ''}
        ${latestReport.details?.newLessons?.length > 0
          ? `<div class="report-lessons">${latestReport.details.newLessons.map(l =>
              `<div class="lesson">[${escapeHtml(l.skillId)}] ${escapeHtml(l.text)}</div>`
            ).join('')}</div>`
          : ''}
      </div>`
    : '<div class="empty-state">No learning cycles run yet.</div>';

  const modsHtml = [...pendingMods, ...recentMods].length > 0
    ? [...pendingMods, ...recentMods].slice(0, 10).map(m =>
        `<div class="mod-card">
          <div class="mod-header">
            ${statusBadge(m.status)} ${safetyBadge(m.safety_level)}
            <span class="mod-file">${escapeHtml(m.target_file)}</span>
          </div>
          <div class="mod-desc">${escapeHtml(m.description)}</div>
          ${m.created_at ? `<div class="mod-time">${timeAgo(m.created_at)}</div>` : ''}
        </div>`
      ).join('')
    : '<div class="empty-state">No self-modifications yet.</div>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fixr Skills Dashboard</title>
  <meta name="description" content="Live skill registry, confidence scores, and learning reports for the Fixr autonomous agent.">
  <meta property="og:title" content="Fixr Skills Dashboard">
  <meta property="og:description" content="Live capability metrics and self-improvement data for the Fixr autonomous agent.">
  <meta property="og:image" content="https://fixr.nexus/fixrpfp.png">
  <link rel="icon" href="/fixrpfp.png">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #050505;
      --surface: #0a0a0a;
      --surface-hover: #111;
      --border: #1a1a1a;
      --text: #fff;
      --text-muted: #666;
      --text-dim: #444;
      --accent: #8b5cf6;
      --accent-glow: rgba(139, 92, 246, 0.3);
      --green: #10b981;
      --orange: #f59e0b;
      --red: #ef4444;
    }
    body {
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      line-height: 1.6;
    }
    .container { max-width: 960px; margin: 0 auto; padding: 3rem 2rem; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* Header */
    .header { display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; }
    .header img { width: 48px; height: 48px; border-radius: 50%; border: 2px solid var(--border); }
    .header h1 { font-size: 1.5rem; letter-spacing: -0.02em; }
    .header .subtitle { color: var(--text-muted); font-size: 0.8rem; }
    .back-link { margin-bottom: 1.5rem; display: inline-block; font-size: 0.8rem; color: var(--text-muted); }
    .back-link:hover { color: var(--accent); }

    /* Stats bar */
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 1rem;
      margin-bottom: 2.5rem;
    }
    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.2rem;
      text-align: center;
    }
    .stat-value { font-size: 1.8rem; font-weight: 700; }
    .stat-label { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 0.25rem; }

    /* Section headers */
    .section { margin-bottom: 2.5rem; }
    .section-header {
      display: flex; align-items: center; gap: 0.75rem;
      margin-bottom: 1.25rem; font-size: 0.8rem;
      color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em;
    }
    .section-line { flex: 1; height: 1px; background: var(--border); }

    /* Skill cards */
    .skills-grid { display: flex; flex-direction: column; gap: 0.75rem; }
    .skill-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.2rem;
      transition: border-color 0.2s;
    }
    .skill-card:hover { border-color: var(--accent); }
    .skill-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; }
    .skill-name { font-weight: 600; font-size: 0.95rem; }
    .skill-category {
      font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;
      letter-spacing: 0.08em; margin-left: 0.75rem;
      border: 1px solid var(--border); padding: 0.15rem 0.5rem; border-radius: 4px;
    }
    .confidence-num { font-size: 1.3rem; font-weight: 700; }
    .bar-track { height: 4px; background: var(--border); border-radius: 2px; margin-bottom: 0.6rem; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 2px; transition: width 0.4s; }
    .skill-stats { display: flex; gap: 1rem; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem; flex-wrap: wrap; }
    .lessons-section, .errors-section { margin-top: 0.6rem; }
    .lessons-label, .errors-label { font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.3rem; }
    .lesson {
      font-size: 0.8rem; color: var(--text-muted); padding: 0.4rem 0;
      border-bottom: 1px solid var(--border);
    }
    .lesson:last-child { border-bottom: none; }
    .lesson-meta { display: block; font-size: 0.65rem; color: var(--text-dim); margin-top: 0.15rem; }
    .error-item { font-size: 0.8rem; color: var(--orange); padding: 0.2rem 0; }
    .last-used { font-size: 0.65rem; color: var(--text-dim); margin-top: 0.5rem; }

    /* Dormant skills */
    .dormant-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .dormant-skill {
      font-size: 0.75rem; color: var(--text-dim);
      border: 1px solid var(--border); padding: 0.3rem 0.7rem; border-radius: 6px;
    }

    /* Report + mods */
    .report-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 1.2rem;
    }
    .report-summary { font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; }
    .report-time { font-size: 0.65rem; color: var(--text-dim); margin-top: 0.5rem; }
    .report-lessons { margin-top: 0.75rem; }
    .mod-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
      padding: 1rem; margin-bottom: 0.5rem;
    }
    .mod-header { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.4rem; }
    .mod-file { font-size: 0.75rem; color: var(--text-dim); }
    .mod-desc { font-size: 0.85rem; color: var(--text-muted); }
    .mod-time { font-size: 0.65rem; color: var(--text-dim); margin-top: 0.3rem; }
    .badge {
      font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.06em;
      border: 1px solid; padding: 0.15rem 0.5rem; border-radius: 4px;
    }
    .empty-state { font-size: 0.85rem; color: var(--text-dim); padding: 1rem; }

    /* Footer */
    .footer { text-align: center; color: var(--text-dim); font-size: 0.7rem; margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--border); }

    /* Responsive */
    @media (max-width: 600px) {
      .container { padding: 2rem 1rem; }
      .stats-bar { grid-template-columns: repeat(2, 1fr); }
      .skill-header { flex-direction: column; align-items: flex-start; gap: 0.3rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <a href="/" class="back-link">&larr; back to fixr</a>

    <div class="header">
      <img src="https://fixr.nexus/fixrpfp.png" alt="Fixr">
      <div>
        <h1>Skills Dashboard</h1>
        <div class="subtitle">Live capability metrics &middot; Self-improvement data</div>
      </div>
    </div>

    <div class="stats-bar">
      <div class="stat-card">
        <div class="stat-value">${activeSkills}</div>
        <div class="stat-label">Active Skills</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalSkills}</div>
        <div class="stat-label">Total Skills</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:${confidenceColor(avgConfidence)}">${(avgConfidence * 100).toFixed(0)}%</div>
        <div class="stat-label">Avg Confidence</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${skills.reduce((s, sk) => s + sk.total_uses, 0)}</div>
        <div class="stat-label">Total Actions</div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <span>Active Skills</span>
        <div class="section-line"></div>
      </div>
      <div class="skills-grid">
        ${skillCards || '<div class="empty-state">No active skills yet. Outcomes will populate this once Fixr starts recording actions.</div>'}
      </div>
    </div>

    ${dormantSkills.length > 0 ? `
    <div class="section">
      <div class="section-header">
        <span>Dormant Skills</span>
        <div class="section-line"></div>
      </div>
      ${dormantHtml}
    </div>` : ''}

    <div class="section">
      <div class="section-header">
        <span>Latest Learning Report</span>
        <div class="section-line"></div>
      </div>
      ${reportHtml}
    </div>

    <div class="section">
      <div class="section-header">
        <span>Self-Modifications</span>
        <div class="section-line"></div>
      </div>
      ${modsHtml}
    </div>

    <div class="footer">
      Fixr &middot; Autonomous Builder Agent &middot; <a href="/docs">API Docs</a> &middot; <a href="https://fixr.nexus">fixr.nexus</a>
    </div>
  </div>
</body>
</html>`;
}
