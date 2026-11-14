import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteComplaint,
  listComplaints,
  resolveComplaint,
} from "../api/complaints";
import { getErrorMessage } from "../api/client";
import type { Complaint } from "../api/types";
import ConfirmDialog from "../components/ConfirmDialog";

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

type Filter = "open" | "all" | "resolved";

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [filter, setFilter] = useState<Filter>("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Complaint | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setComplaints(await listComplaints());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const counts = useMemo(() => {
    const open = complaints.filter((c) => !c.is_resolved).length;
    const resolved = complaints.filter((c) => c.is_resolved).length;
    return { open, resolved, all: complaints.length };
  }, [complaints]);

  const visible = useMemo(() => {
    if (filter === "open") return complaints.filter((c) => !c.is_resolved);
    if (filter === "resolved") return complaints.filter((c) => c.is_resolved);
    return complaints;
  }, [complaints, filter]);

  async function onResolve(id: number, isResolved: boolean) {
    setBusyId(id);
    setError(null);
    try {
      await resolveComplaint(id, isResolved);
      await refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteComplaint(pendingDelete.id);
      setPendingDelete(null);
      await refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <h1>Complaints</h1>
      <p className="muted">
        Student-submitted reports — mark resolved when handled.
      </p>

      <div className="filter-bar">
        {(
          [
            { key: "open", label: `Open (${counts.open})` },
            { key: "resolved", label: `Resolved (${counts.resolved})` },
            { key: "all", label: `All (${counts.all})` },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            type="button"
            className={
              filter === f.key
                ? "filter-chip filter-chip--active"
                : "filter-chip"
            }
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          className="ghost small-btn"
          onClick={() => refresh()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && (
        <div className="table-wrap">
          <div className="table-toolbar">
            <h2 className="table-title">Complaints</h2>
            <span className="count-badge">{visible.length} Shown</span>
          </div>
          {visible.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon" aria-hidden>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                >
                  <path d="M4 5h16v11H8l-4 3V5z" />
                  <path d="M8 9h8M8 12h5" />
                </svg>
              </span>
              <p className="empty-state-msg">No complaints in this view.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Student</th>
                  <th>Driver</th>
                  <th>Subject</th>
                  <th>Body</th>
                  <th>When</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>
                      <span
                        className={
                          c.is_resolved
                            ? "status-pill status-pill--resolved"
                            : "status-pill status-pill--open"
                        }
                      >
                        {c.is_resolved ? "Resolved" : "Open"}
                      </span>
                    </td>
                    <td>#{c.student_id}</td>
                    <td>{c.driver_id != null ? `#${c.driver_id}` : "—"}</td>
                    <td>{c.subject}</td>
                    <td style={{ maxWidth: 280 }}>{c.body}</td>
                    <td>{formatWhen(c.created_at)}</td>
                    <td>
                      <div className="row-actions">
                        {!c.is_resolved ? (
                          <button
                            type="button"
                            className="primary-cta small-btn"
                            disabled={busyId === c.id}
                            onClick={() => onResolve(c.id, true)}
                          >
                            {busyId === c.id ? "…" : "Mark Resolved"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ghost small-btn"
                            disabled={busyId === c.id}
                            onClick={() => onResolve(c.id, false)}
                          >
                            Reopen
                          </button>
                        )}
                        <button
                          type="button"
                          className="danger-outline small-btn"
                          disabled={busyId === c.id || deleting}
                          onClick={() => setPendingDelete(c)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete != null}
        title="Delete complaint"
        message="Are you sure you want to permanently delete this complaint? This cannot be undone."
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
