import { FormEvent, useEffect, useState } from "react";
import { getErrorMessage } from "../api/client";
import { createRoute, listRoutes, updateRoute } from "../api/routes";
import type { Route, StopInput } from "../api/types";

type StopDraft = {
  name: string;
  latitude: string;
  longitude: string;
};

const emptyStop = (): StopDraft => ({
  name: "",
  latitude: "",
  longitude: "",
});

export default function RoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [stops, setStops] = useState<StopDraft[]>([emptyStop()]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setRoutes(await listRoutes());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
    setIsActive(true);
    setStops([emptyStop()]);
  }

  function startEdit(route: Route) {
    setEditingId(route.id);
    setName(route.name);
    setDescription(route.description ?? "");
    setIsActive(route.is_active);
    const ordered = [...(route.stops ?? [])].sort(
      (a, b) => a.sequence_order - b.sequence_order
    );
    setStops(
      ordered.length
        ? ordered.map((s) => ({
            name: s.name,
            latitude: String(s.latitude),
            longitude: String(s.longitude),
          }))
        : [emptyStop()]
    );
  }

  function updateStop(index: number, patch: Partial<StopDraft>) {
    setStops((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  }

  function addStopRow() {
    setStops((prev) => [...prev, emptyStop()]);
  }

  function removeStopRow(index: number) {
    setStops((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)
    );
  }

  function moveStop(index: number, direction: -1 | 1) {
    setStops((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function buildStopPayload(): StopInput[] {
    return stops
      .filter((s) => s.name.trim())
      .map((s, i) => ({
        name: s.name.trim(),
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
        sequence_order: i + 1,
      }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const stopPayload = buildStopPayload();
      for (const s of stopPayload) {
        if (Number.isNaN(s.latitude) || Number.isNaN(s.longitude)) {
          throw new Error("Each stop needs valid latitude and longitude");
        }
      }
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        is_active: isActive,
        stops: stopPayload,
      };
      if (editingId != null) {
        await updateRoute(editingId, payload);
      } else {
        await createRoute(payload);
      }
      resetForm();
      await refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function stopFlow(route: Route) {
    const ordered = [...(route.stops ?? [])].sort(
      (a, b) => a.sequence_order - b.sequence_order
    );
    if (!ordered.length) return "No stops";
    return ordered.map((s, i) => `Stop ${i + 1}: ${s.name}`).join(" → ");
  }

  return (
    <div>
      <h1>Routes</h1>
      <p className="muted">Define routes and ordered stops.</p>

      {error && <p className="error">{error}</p>}

      <form className="panel-form" onSubmit={onSubmit}>
        <h2>{editingId != null ? "Edit route" : "Create route"}</h2>
        <div className="form-grid">
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label>
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
        </div>

        <div className="stops-editor">
          <div className="stops-header">
            <h3>Stops (ordered)</h3>
            <button type="button" className="ghost small-btn" onClick={addStopRow}>
              Add stop
            </button>
          </div>
          {stops.map((stop, index) => (
            <div key={index} className="stop-row">
              <span className="stop-badge">Stop {index + 1}</span>
              <label>
                Name
                <input
                  value={stop.name}
                  onChange={(e) => updateStop(index, { name: e.target.value })}
                  required={index === 0 || Boolean(stop.latitude || stop.longitude)}
                />
              </label>
              <label>
                Latitude
                <input
                  type="number"
                  step="any"
                  value={stop.latitude}
                  onChange={(e) =>
                    updateStop(index, { latitude: e.target.value })
                  }
                  required={Boolean(stop.name.trim())}
                />
              </label>
              <label>
                Longitude
                <input
                  type="number"
                  step="any"
                  value={stop.longitude}
                  onChange={(e) =>
                    updateStop(index, { longitude: e.target.value })
                  }
                  required={Boolean(stop.name.trim())}
                />
              </label>
              <div className="stop-row-actions">
                <button
                  type="button"
                  className="ghost small-btn"
                  onClick={() => moveStop(index, -1)}
                  disabled={index === 0}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="ghost small-btn"
                  onClick={() => moveStop(index, 1)}
                  disabled={index === stops.length - 1}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="ghost small-btn"
                  onClick={() => removeStopRow(index)}
                  disabled={stops.length <= 1}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving
              ? "Saving…"
              : editingId != null
                ? "Update route"
                : "Create route"}
          </button>
          {editingId != null && (
            <button type="button" className="ghost" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Stops</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {routes.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No routes yet.
                  </td>
                </tr>
              )}
              {routes.map((route) => (
                <tr key={route.id}>
                  <td>{route.name}</td>
                  <td>{route.description || "—"}</td>
                  <td className="stop-flow">{stopFlow(route)}</td>
                  <td>{route.is_active ? "Active" : "Inactive"}</td>
                  <td>
                    <button
                      type="button"
                      className="ghost small-btn"
                      onClick={() => startEdit(route)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
