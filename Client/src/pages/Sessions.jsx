import React, { useState, useCallback } from "react";
import {
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  X,
  Layers,
} from "lucide-react";
import usePolling from "@/hooks/usePolling";
import { API } from "@/api/endpoint";

export default function Sessions() {
  // Live polling for SQLite sessions (every 3s)
  const { data: response, loading, error, refetch } = usePolling(API.sessions, 3000);
  const sessions = response?.data || [];

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [timeWindowHours, setTimeWindowHours] = useState("2");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [successBanner, setSuccessBanner] = useState("");

  const handleOpenModal = () => {
    setSessionName("");
    setTimeWindowHours("2");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    setFormError("");

    const trimmedName = sessionName.trim();
    if (!trimmedName) {
      setFormError("Please enter a session name.");
      return;
    }

    const hours = parseFloat(timeWindowHours);
    if (isNaN(hours) || hours <= 0) {
      setFormError("Time window must be a positive number of hours (e.g. 2).");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(API.createSession, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          duration_hours: hours,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to create session in SQLite");
      }

      setIsModalOpen(false);
      setSuccessBanner(`Session "${trimmedName}" created successfully!`);
      setTimeout(() => setSuccessBanner(""), 4000);
      if (refetch) refetch();
    } catch (err) {
      setFormError(err.message || "Failed to create session");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSession = useCallback(
    async (id, name) => {
      if (!window.confirm(`Are you sure you want to delete session "${name}"?`)) {
        return;
      }
      try {
        const res = await fetch(API.deleteSession, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const json = await res.json();
        if (json.success && refetch) {
          refetch();
        }
      } catch (err) {
        console.error("Delete session error:", err);
      }
    },
    [refetch]
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. TOP HEADER & CREATE ACTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Sessions
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure scalping time window sessions saved in SQLite.
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm shadow-md transition-all active:scale-98"
        >
          <Plus className="w-4 h-4" />
          <span>Create Session</span>
        </button>
      </div>

      {/* 2. SUCCESS BANNER */}
      {successBanner && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between shadow-xs animate-in fade-in duration-300">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner("")}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. ERROR BANNER */}
      {error && !response && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>Database connection error: {error}</span>
        </div>
      )}

      {/* 4. SESSIONS GRID DISPLAY */}
      {loading && sessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300 animate-pulse" />
          <p className="text-sm">Loading sessions from SQLite...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-4 shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              No Sessions Created Yet
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Click "Create Session", specify your session name and time window (e.g. 2 hours), and save it.
            </p>
          </div>
          <button
            onClick={handleOpenModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create Session</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sessions.map((session) => {
            const isActive = session.status === "ACTIVE";
            const isCompleted = session.status === "COMPLETED";

            return (
              <div
                key={session.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs transition-all flex flex-col justify-between space-y-4 ${
                  isActive
                    ? "border-emerald-300 ring-2 ring-emerald-500/10"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {/* Header: Title, Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-snug tracking-tight">
                      {session.name}
                    </h3>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      Session #{session.id} • {session.created_at}
                    </div>
                  </div>

                  <div>
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        Active
                      </span>
                    ) : isCompleted ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                        <CheckCircle2 className="w-3 h-3 text-slate-500" />
                        Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                        Ready
                      </span>
                    )}
                  </div>
                </div>

                {/* Body: Time Window */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 font-mono">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    Time Window
                  </span>
                  <div className="text-lg font-extrabold text-slate-900 mt-1">
                    {session.duration_hours} {session.duration_hours === 1 ? "Hour" : "Hours"}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {Math.round(session.duration_hours * 60)} Minutes Duration
                  </span>
                </div>

                {/* Footer Controls: Delete */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>Activate in Tracker</span>
                  <button
                    onClick={() => handleDeleteSession(session.id, session.name)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete Session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. CREATE SESSION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Create Session
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Set session name & time window
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Error */}
            {formError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleCreateSession} className="space-y-4">
              {/* Field 1: Session Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Session Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. London Morning, NY Afternoon"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 font-sans"
                  autoFocus
                />
              </div>

              {/* Field 2: Time Window (Hours) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Session Time Window (Hours) *
                  </label>
                  <span className="text-xs font-mono text-indigo-600 font-bold">
                    {timeWindowHours || 0} Hours ({Math.round((parseFloat(timeWindowHours) || 0) * 60)} Mins)
                  </span>
                </div>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="24"
                  placeholder="e.g. 2"
                  value={timeWindowHours}
                  onChange={(e) => setTimeWindowHours(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                />

                {/* Preset Time Pills */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    Quick:
                  </span>
                  {[0.5, 1, 2, 3, 4].map((hr) => (
                    <button
                      key={hr}
                      type="button"
                      onClick={() => setTimeWindowHours(String(hr))}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium border transition-colors ${
                        parseFloat(timeWindowHours) === hr
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {hr}h
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-all"
                >
                  {submitting ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Save Session</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
