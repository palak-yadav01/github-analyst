import { useState, useCallback } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  Tooltip, ResponsiveContainer
} from "recharts";

const GITHUB_API = "https://api.github.com";

async function fetchGitHub(url, token) {
  const headers = { "Accept": "application/vnd.github+json" };
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error("GitHub error: " + res.status + " " + res.statusText);
  return res.json();
}

async function fetchContribs(username, token) {
  if (!token) return null;
  const query = "{ user(login: \"" + username + "\") { contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { contributionCount date } } } } } }";
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  return data?.data?.user?.contributionsCollection?.contributionCalendar || null;
}

async function loadUser(username, token) {
  const [profile, repos] = await Promise.all([
    fetchGitHub(GITHUB_API + "/users/" + username, token),
    fetchGitHub(GITHUB_API + "/users/" + username + "/repos?per_page=100&sort=updated", token),
  ]);
  const contribs = await fetchContribs(username, token);
  return { profile, repos, contribs };
}

function getMetrics(profile, repos, contribs) {
  const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const totalForks = repos.reduce((s, r) => s + r.forks_count, 0);
  const langMap = {};
  repos.forEach(r => { if (r.language) langMap[r.language] = (langMap[r.language] || 0) + 1; });
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const activeRepos = repos.filter(r => new Date(r.updated_at).getTime() > cutoff).length;
  const docsCount = repos.filter(r => r.description && r.description.trim()).length;
  const avgStars = repos.length > 0 ? totalStars / repos.length : 0;
  const topRepos = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 5);
  const langList = Object.entries(langMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count }));

  const scores = {
    Documentation: Math.min(100, Math.round((docsCount / (repos.length || 1)) * 100)),
    Community: Math.min(100, Math.round((profile.followers / 10) * 100)),
    Activity: Math.min(100, Math.round((activeRepos / (repos.length || 1)) * 100)),
    Popularity: Math.min(100, Math.round(avgStars * 5)),
    Diversity: Math.min(100, Object.keys(langMap).length * 12),
  };
  const health = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length);

  return { totalStars, totalForks, langMap, langList, activeRepos, topRepos, scores, health, contribs };
}

const LANG_COLORS = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5",
  Rust: "#dea584", Go: "#00ADD8", Ruby: "#701516", Java: "#b07219",
  "C++": "#f34b7d", C: "#555555", Shell: "#89e051", HTML: "#e34c26",
  CSS: "#563d7c", Swift: "#F05138", Kotlin: "#7F52FF",
};
function langColor(lang) { return LANG_COLORS[lang] || "#8b949e"; }

function Heatmap({ weeks }) {
  if (!weeks || weeks.length === 0) {
    return <div style={{ fontSize: 11, color: "#94a3b8", padding: "8px 0" }}>Add token to see heatmap</div>;
  }
  function squareColor(n) {
    if (!n) return "#e2e8f0";
    if (n < 3) return "#bbf7d0";
    if (n < 7) return "#4ade80";
    if (n < 12) return "#16a34a";
    return "#00ff9d";
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", gap: 2 }}>
        {weeks.map(function(week, wi) {
          return (
            <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {Array.from({ length: 7 }).map(function(_, di) {
                const day = week.contributionDays ? week.contributionDays[di] : null;
                const count = day ? day.contributionCount : 0;
                return (
                  <div key={di}
                    title={day ? day.date + ": " + count : ""}
                    style={{ width: 8, height: 8, borderRadius: 1, background: squareColor(count) }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 8, alignItems: "center", justifyContent: "flex-end" }}>
        <span style={{ fontSize: 9, color: "#94a3b8" }}>Less</span>
        {["#e2e8f0", "#bbf7d0", "#4ade80", "#16a34a", "#00ff9d"].map(function(c) {
          return <div key={c} style={{ width: 8, height: 8, borderRadius: 1, background: c }} />;
        })}
        <span style={{ fontSize: 9, color: "#94a3b8" }}>More</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color }}>{Number(value).toLocaleString()}</div>
    </div>
  );
}

function VsRow({ label, v1, v2, c1, c2 }) {
  const w = v1 > v2 ? 1 : v2 > v1 ? 2 : 0;
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
      <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: w === 1 ? c1 : "#cbd5e1" }}>{Number(v1).toLocaleString()}</span>
        <span style={{ fontSize: 9, color: "#cbd5e1", fontWeight: 700 }}>VS</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: w === 2 ? c2 : "#cbd5e1" }}>{Number(v2).toLocaleString()}</span>
      </div>
      <div style={{ fontSize: 10, marginTop: 4, color: w === 1 ? c1 : w === 2 ? c2 : "#94a3b8" }}>
        {w === 1 ? "← wins" : w === 2 ? "wins →" : "tie"}
      </div>
    </div>
  );
}

function UserColumn({ userData, accentColor }) {
  const { profile, repos, contribs } = userData;
  const m = getMetrics(profile, repos, contribs);
  const hc = m.health > 70 ? "#00ff9d" : m.health > 40 ? "#ffa726" : "#ef4444";
  const radarData = Object.entries(m.scores).map(function(entry) {
    return { subject: entry[0], value: entry[1] };
  });

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Profile */}
      <div style={{ background: "#ffffff", border: "2px solid " + accentColor, borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <img src={profile.avatar_url} alt={profile.login}
            style={{ width: 52, height: 52, borderRadius: 8, border: "2px solid " + accentColor }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{profile.name || profile.login}</div>
            <div style={{ fontSize: 11, color: accentColor }}>{"@" + profile.login}</div>
            {profile.bio && (
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {profile.bio}
              </div>
            )}
          </div>
          <div style={{ textAlign: "center", background: "#f8fafc", borderRadius: 8, padding: "6px 12px", border: "1px solid " + hc, flexShrink: 0 }}>
            <div style={{ fontSize: 8, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Health</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: hc, lineHeight: 1 }}>{m.health}</div>
            <div style={{ fontSize: 8, color: "#94a3b8" }}>/100</div>
          </div>
        </div>
        {profile.location && (
          <div style={{ fontSize: 10, color: "#64748b" }}>{"📍 " + profile.location}</div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <StatCard label="Repos"     value={profile.public_repos}         color={accentColor} />
        <StatCard label="Followers" value={profile.followers}            color="#3b82f6" />
        <StatCard label="Stars"     value={m.totalStars}                 color="#f59e0b" />
        <StatCard label="Forks"     value={m.totalForks}                 color="#3b82f6" />
        <StatCard label="Languages" value={Object.keys(m.langMap).length} color="#8b5cf6" />
        <StatCard label="Active"    value={m.activeRepos}                color="#00ff9d" />
      </div>

      {/* Radar */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Health Radar</div>
        <ResponsiveContainer width="100%" height={200}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748b", fontSize: 9 }} />
            <Radar dataKey="value" stroke={accentColor} fill={accentColor} fillOpacity={0.15} strokeWidth={2} />
            <Tooltip
              contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 11 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Languages */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Languages</div>
        {m.langList.map(function(l) {
          const pct = Math.round((l.count / repos.length) * 100);
          return (
            <div key={l.name} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: langColor(l.name) }} />
                  <span style={{ fontSize: 11, color: "#1e293b" }}>{l.name}</span>
                </div>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>{l.count} repos</span>
              </div>
              <div style={{ height: 3, background: "#e2e8f0", borderRadius: 2 }}>
                <div style={{ height: "100%", width: pct + "%", background: langColor(l.name), borderRadius: 2 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Top Repos */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Top Repos</div>
        {m.topRepos.map(function(repo) {
          return (
            <div key={repo.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <a href={repo.html_url} target="_blank" rel="noreferrer"
                  style={{ color: "#2563eb", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                  {repo.name}
                </a>
                {repo.language && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: langColor(repo.language) }} />
                    <span style={{ fontSize: 10, color: "#64748b" }}>{repo.language}</span>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: "#f59e0b" }}>{"★ " + repo.stargazers_count}</span>
                <span style={{ fontSize: 11, color: "#3b82f6" }}>{"⑂ " + repo.forks_count}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Heatmap */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
          Contributions
          {contribs && (
            <span style={{ color: accentColor, marginLeft: 8 }}>
              {contribs.totalContributions.toLocaleString() + " this year"}
            </span>
          )}
        </div>
        <Heatmap weeks={contribs ? contribs.weeks : []} />
      </div>

    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState("single");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [singleUsername, setSingleUsername] = useState("");
  const [singleData, setSingleData] = useState(null);

  const [username1, setUsername1] = useState("");
  const [username2, setUsername2] = useState("");
  const [compareData1, setCompareData1] = useState(null);
  const [compareData2, setCompareData2] = useState(null);

  const C1 = "#3b82f6";
  const C2 = "#f43f5e";

  const handleSingle = useCallback(async function() {
    if (!singleUsername.trim()) return;
    setLoading(true);
    setError(null);
    setSingleData(null);
    try {
      const d = await loadUser(singleUsername.trim(), token);
      setSingleData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [singleUsername, token]);

  const handleCompare = useCallback(async function() {
    if (!username1.trim() || !username2.trim()) return;
    setLoading(true);
    setError(null);
    setCompareData1(null);
    setCompareData2(null);
    try {
      const results = await Promise.all([
        loadUser(username1.trim(), token),
        loadUser(username2.trim(), token),
      ]);
      setCompareData1(results[0]);
      setCompareData2(results[1]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [username1, username2, token]);

  const m1 = compareData1 ? getMetrics(compareData1.profile, compareData1.repos, compareData1.contribs) : null;
  const m2 = compareData2 ? getMetrics(compareData2.profile, compareData2.repos, compareData2.contribs) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e14", fontFamily: "monospace", padding: 32 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: "#00ff9d", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 2 }}>GITPULSE</h1>
        <p style={{ color: "#475569", fontSize: 12 }}>GitHub Analytics Dashboard</p>
      </div>

      {/* Mode Toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {[
          { key: "single",  label: "Single User" },
          { key: "compare", label: "⚔ Compare" },
        ].map(function(item) {
          const active = mode === item.key;
          return (
            <button key={item.key} onClick={function() { setMode(item.key); }}
              style={{
                padding: "8px 18px",
                background: active ? "#00ff9d" : "#111820",
                color: active ? "#0a0e14" : "#475569",
                border: "1px solid " + (active ? "#00ff9d" : "#1e2d3d"),
                borderRadius: 6, fontFamily: "monospace", fontSize: 11,
                fontWeight: active ? 700 : 400, cursor: "pointer",
                textTransform: "uppercase", letterSpacing: "0.08em",
              }}>
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Single Input */}
      {mode === "single" && (
        <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          <input value={singleUsername} onChange={function(e) { setSingleUsername(e.target.value); }}
            onKeyDown={function(e) { if (e.key === "Enter") handleSingle(); }}
            placeholder="GitHub username"
            style={{ padding: "10px 14px", background: "#ffffff", border: "1px solid #e2e8f0", color: "#1e293b", borderRadius: 6, fontSize: 13 }} />
          <input value={token} onChange={function(e) { setToken(e.target.value); }}
            placeholder="Token (optional)" type="password"
            style={{ padding: "10px 14px", background: "#ffffff", border: "1px solid #e2e8f0", color: "#1e293b", borderRadius: 6, fontSize: 13, width: 250 }} />
          <button onClick={handleSingle} disabled={loading || !singleUsername}
            style={{ padding: "10px 22px", background: loading || !singleUsername ? "#1e2d3d" : "#00ff9d", color: "#0a0e14", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            {loading ? "Scanning..." : "ANALYZE"}
          </button>
        </div>
      )}

      {/* Compare Inputs */}
      {mode === "compare" && (
        <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
          <input value={username1} onChange={function(e) { setUsername1(e.target.value); }}
            placeholder="First username"
            style={{ padding: "10px 14px", background: "#ffffff", border: "2px solid " + C1, color: "#1e293b", borderRadius: 6, fontSize: 13 }} />
          <div style={{ color: "#475569", fontWeight: 700, fontSize: 14 }}>VS</div>
          <input value={username2} onChange={function(e) { setUsername2(e.target.value); }}
            placeholder="Second username"
            style={{ padding: "10px 14px", background: "#ffffff", border: "2px solid " + C2, color: "#1e293b", borderRadius: 6, fontSize: 13 }} />
          <input value={token} onChange={function(e) { setToken(e.target.value); }}
            placeholder="Token (optional)" type="password"
            style={{ padding: "10px 14px", background: "#ffffff", border: "1px solid #e2e8f0", color: "#1e293b", borderRadius: 6, fontSize: 13, width: 200 }} />
          <button onClick={handleCompare} disabled={loading || !username1 || !username2}
            style={{ padding: "10px 22px", background: loading || !username1 || !username2 ? "#1e2d3d" : "#00ff9d", color: "#0a0e14", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            {loading ? "Scanning..." : "⚔ COMPARE"}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px", color: "#ef4444", fontSize: 12, marginBottom: 20 }}>
          {"⚠ " + error}
        </div>
      )}

      {/* Single Result */}
      {mode === "single" && singleData && (
        <UserColumn userData={singleData} accentColor="#00ff9d" />
      )}

      {/* Compare Result */}
      {mode === "compare" && compareData1 && compareData2 && m1 && m2 && (
        <div>

          {/* Head to Head */}
          <div style={{ background: "#111820", border: "1px solid #1e2d3d", borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16, textAlign: "center" }}>
              Head to Head
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
              <VsRow label="Health"       v1={m1.health}                              v2={m2.health}                              c1={C1} c2={C2} />
              <VsRow label="Stars"        v1={m1.totalStars}                          v2={m2.totalStars}                          c1={C1} c2={C2} />
              <VsRow label="Followers"    v1={compareData1.profile.followers}         v2={compareData2.profile.followers}         c1={C1} c2={C2} />
              <VsRow label="Repos"        v1={compareData1.profile.public_repos}      v2={compareData2.profile.public_repos}      c1={C1} c2={C2} />
              <VsRow label="Forks"        v1={m1.totalForks}                          v2={m2.totalForks}                          c1={C1} c2={C2} />
              <VsRow label="Languages"    v1={Object.keys(m1.langMap).length}         v2={Object.keys(m2.langMap).length}         c1={C1} c2={C2} />
              <VsRow label="Active Repos" v1={m1.activeRepos}                         v2={m2.activeRepos}                         c1={C1} c2={C2} />
            </div>
          </div>

          {/* Side by Side */}
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <UserColumn userData={compareData1} accentColor={C1} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 90, flexShrink: 0 }}>
              <div style={{ width: 1, height: 48, background: "#1e2d3d" }} />
              <div style={{ background: "#1e2d3d", color: "#475569", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>VS</div>
              <div style={{ width: 1, height: 48, background: "#1e2d3d" }} />
            </div>
            <UserColumn userData={compareData2} accentColor={C2} />
          </div>

        </div>
      )}

    </div>
  );
}