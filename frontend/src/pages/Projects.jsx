import { useMemo, useState } from "react";
import { useData } from "../context/DataContext";
import { formatINR, formatArea, formatDate, titleCase } from "../lib/format";

export default function Projects() {
  const { projects, listings, loading, progress, error, meta } = useData();
  const [status, setStatus] = useState("");

  const statuses = useMemo(
    () => [...new Set(projects.map((p) => p.project_status).filter(Boolean))].sort(),
    [projects]
  );

  // The API_REFERENCE.md claims a project's total_listings "always agrees"
  // with GET /v1/listings?project_id=... — since we already have the full
  // listings dataset cached, we can check that claim live, per project,
  // right here instead of taking it on faith.
  const actualListingCountByProject = useMemo(() => {
    const m = new Map();
    for (const l of listings) {
      if (!l.project_id) continue;
      if (l.is_live === false) continue;
      m.set(l.project_id, (m.get(l.project_id) || 0) + 1);
    }
    return m;
  }, [listings]);

  const filtered = useMemo(
    () => (status ? projects.filter((p) => p.project_status === status) : projects),
    [projects, status]
  );

  if (loading && projects.length === 0) {
    return <div className="loading-state">{progress || "Loading projects…"}</div>;
  }
  if (error) return <div className="card error-text">{error}</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Projects</h2>
        <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
          {filtered.length} of {projects.length} loaded
          {meta.projectsClaimedTotal !== null && ` (server reports total: ${meta.projectsClaimedTotal})`}
        </span>
      </div>

      <div className="filters">
        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {statuses.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Developer</th>
            <th>Locality</th>
            <th>Status</th>
            <th>API price range</th>
            <th>Reported listings</th>
            <th>Actual live listings</th>
            <th>Possession</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => {
            const actual = actualListingCountByProject.get(p.project_id) ?? 0;
            const mismatch = actual !== p.total_listings;
            return (
              <tr key={p.project_id}>
                <td>{p.apartment_name}</td>
                <td>{p.developer_name}</td>
                <td>{titleCase(p.locality)}</td>
                <td>{titleCase(p.project_status)}</td>
                <td><span title="The API reference says rupees, but the running service returned inconsistent project price units; listing-level prices are authoritative for this submission.">{p.price_min ?? "—"} – {p.price_max ?? "—"} <small>(API)</small></span></td>
                <td>{p.total_listings}</td>
                <td style={mismatch ? { color: "var(--danger)", fontWeight: 600 } : undefined}>
                  {actual}
                </td>
                <td>{formatDate(p.possession_date)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
