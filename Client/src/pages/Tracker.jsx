import React, { useState, useEffect } from "react";
import {
  Clock,
  Play,
  Square,
  TrendingUp,
  TrendingDown,
  Layers,
  Sparkles,
  Zap,
  Activity,
  AlertCircle,
  Timer,
  ShieldAlert,
  X,
  Sliders,
  LogOut,
  AlertTriangle,
} from "lucide-react";
import usePolling from "@/hooks/usePolling";
import { API } from "@/api/endpoint";
import { NAVIGATION_CONFIG } from "@/config/navigationConfig";

function formatTimer(totalSec) {
  if (totalSec <= 0) return "00:00:00";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Tracker() {
  const { data: headerRes } = usePolling(API.header, 2000);
  const { data: trackerRes, error, refetch } = usePolling(API.tracker, 2000);

  const account = headerRes?.data?.account || {};
  const isCent = account.is_cent ?? account.currency === "USC";
  const currLabel = isCent ? "USC (Cent)" : "USD";

  const data = trackerRes?.data || {};
  const activeSession = data.active_session || null;
  const sessions = data.sessions || [];
  const trades = data.trades || [];
  const stats = data.stats || {
    total_trades: 0,
    won_trades: 0,
    lost_trades: 0,
    win_rate: 0,
    total_money_usd: 0,
    duration_left_sec: 0,
    elapsed_sec: 0,
    is_expired: false,
  };

  const bdtRate = NAVIGATION_CONFIG.usdToBdtRate || 124.09;
  
  // Normalized Money Values based on Cent vs USD account
  // In MT5 cent account, profit and balance are reported in cents (USC)
  const rawProfit = Number(stats.total_money_usd || 0);
  const moneyUSD = isCent ? rawProfit / 100 : rawProfit;
  const moneyBDT = moneyUSD * bdtRate;

  // Activation modal state for session drawdown limit
  const [activatingSession, setActivatingSession] = useState(null);
  const [drawdownAmountInput, setDrawdownAmountInput] = useState(isCent ? "2500" : "25");
  const [isActivating, setIsActivating] = useState(false);

  // Quick Quit Confirmation Modal State
  const [showQuitModal, setShowQuitModal] = useState(false);

  // Local tick for smooth countdown
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  useEffect(() => {
    if (!activeSession) return;
    const startTs = activeSession.start_timestamp || 0;
    const durationSec = Math.round((activeSession.duration_hours || 0) * 3600);

    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const elapsed = Math.max(0, now - startTs);
      setSecondsRemaining(Math.max(0, durationSec - elapsed));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  // Open activation prompt
  const handleOpenActivateModal = (session) => {
    setActivatingSession(session);
    setDrawdownAmountInput(isCent ? "2500" : "25");
  };

  // Submit activation with drawdown
  const handleConfirmActivate = async () => {
    if (!activatingSession) return;
    setIsActivating(true);
    try {
      const limitVal = parseFloat(drawdownAmountInput) || (isCent ? 2500 : 25);
      // Store in native terms
      const res = await fetch(API.activateSession, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activatingSession.id,
          drawdown_usd: limitVal,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setActivatingSession(null);
        if (refetch) refetch();
      }
    } catch (err) {
      console.error("Activate session error:", err);
    } finally {
      setIsActivating(false);
    }
  };

  // Direct, effective quit action
  const handleQuitSession = async () => {
    if (!activeSession) return;
    try {
      const res = await fetch(API.endSession, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeSession.id }),
      });
      const json = await res.json();
      if (json.success) {
        setShowQuitModal(false);
        if (refetch) refetch();
      }
    } catch (err) {
      console.error("Quit session error:", err);
    }
  };

  // Drawdown tracking computations
  const maxDdLimit = Number(activeSession?.drawdown_usd || 0);
  const totalPoints = Number(stats.total_captured_points || 0);
  const isPointsPos = totalPoints >= 0;

  // Drawdown used in current session
  const usedDrawdown = Math.max(0, -rawProfit);
  const remainingDrawdown = maxDdLimit > 0 ? Math.max(0, maxDdLimit - usedDrawdown) : 0;
  const ddPct = maxDdLimit > 0 ? Math.min(100, Math.round((usedDrawdown / maxDdLimit) * 100)) : 0;
  const isBreached = maxDdLimit > 0 && usedDrawdown >= maxDdLimit;

  const isMoneyProfit = rawProfit >= 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. TOP HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Live Scalp Tracker
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-200">
              {currLabel}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time session time window surveillance, monetary PnL ({currLabel} / BDT), and live session drawdown limits.
          </p>
        </div>

        {activeSession && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQuitModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all active:scale-98"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Quit Session</span>
            </button>
          </div>
        )}
      </div>

      {error && !trackerRes && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>Error connecting to tracker backend: {error}</span>
        </div>
      )}

      {/* 2. CHOOSE / ACTIVATE SESSION BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            <span>Select & Activate Scalping Session</span>
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            {sessions.length} Saved in SQLite
          </span>
        </div>

        {sessions.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-400">
            No sessions found. Create a session on the Sessions page first.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {sessions.map((s) => {
              const isSelected = activeSession?.id === s.id;
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-xs font-mono transition-all ${
                    isSelected
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-emerald-500/20"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-xs">{s.name}</span>
                    <span className={`text-[10px] ${isSelected ? "text-slate-300" : "text-slate-400"}`}>
                      {s.duration_hours}h Window
                    </span>
                  </div>

                  {isSelected ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      RUNNING
                    </span>
                  ) : (
                    <button
                      onClick={() => handleOpenActivateModal(s)}
                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 text-indigo-600 border border-slate-200 shadow-2xs transition-colors"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>Set Drawdown & Activate</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. ACTIVE SESSION WITH LIVE DRAWDOWN PROGRESS BAR & TIMER */}
      {activeSession ? (
        <div className="space-y-4">
          {/* Active Session Hero */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-7 border border-slate-700 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>SESSION TRACKING ACTIVE</span>
                </div>
                <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                  <span>{activeSession.name}</span>
                  <span className="text-xs font-mono font-medium text-slate-300 bg-white/10 px-2 py-0.5 rounded">
                    Started at {activeSession.started_at ? activeSession.started_at.split(" ")[1] : "Now"}
                  </span>
                </h2>
                <p className="text-xs text-slate-300 font-mono">
                  Window: {activeSession.duration_hours}h • Monitoring PnL in {currLabel} & real-time drawdown
                </p>
              </div>

              {/* Time Countdown Box */}
              <div className="flex items-center gap-4 bg-black/40 backdrop-blur-md px-6 py-4 rounded-xl border border-white/10 font-mono">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                    <Timer className="w-3.5 h-3.5 text-indigo-400" />
                    Time Remaining
                  </span>
                  <span className="text-2xl font-black tracking-widest text-emerald-400 mt-1">
                    {formatTimer(secondsRemaining)}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Elapsed: {formatTimer(stats.elapsed_sec)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* LIVE SESSION DRAWDOWN PROGRESS SECTION */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className={`w-4 h-4 ${isBreached ? "text-rose-600 animate-bounce" : "text-indigo-600"}`} />
                <h3 className="text-sm font-bold text-slate-900">
                  Session Drawdown Progress & Remaining Cushion
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                {isBreached ? (
                  <span className="px-2.5 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                    DRAWDOWN LIMIT BREACHED
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    WITHIN SAFE LIMITS
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-semibold text-slate-600">
                  {isCent ? "Cent Loss Drawdown (USC)" : "Loss Drawdown ($ USD)"}
                </span>
                <span className="font-bold text-slate-800">
                  Used: <span className={usedDrawdown > 0 ? "text-rose-600" : "text-emerald-600"}>
                    -{usedDrawdown.toFixed(2)} {isCent ? "USC" : "USD"}
                  </span> / Cap: {maxDdLimit > 0 ? `${maxDdLimit} ${isCent ? "USC" : "USD"}` : "None"}
                </span>
              </div>

              {/* Progress bar track */}
              <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    ddPct >= 90
                      ? "bg-rose-600"
                      : ddPct >= 60
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.max(2, ddPct)}%` }}
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-mono text-slate-500 gap-1 pt-1">
                <span>
                  Remaining Cushion: <strong className={remainingDrawdown > 0 ? "text-emerald-600" : "text-rose-600"}>
                    {remainingDrawdown.toFixed(2)} {isCent ? "USC" : "USD"}
                  </strong>
                  {isCent && (
                    <span className="text-slate-400 ml-1">
                      (≈ ${(remainingDrawdown / 100).toFixed(2)} USD • ৳{Math.round((remainingDrawdown / 100) * bdtRate).toLocaleString()} BDT)
                    </span>
                  )}
                  {!isCent && (
                    <span className="text-slate-400 ml-1">
                      (≈ ৳{Math.round(remainingDrawdown * bdtRate).toLocaleString()} BDT)
                    </span>
                  )}
                </span>
                <span className="font-bold text-slate-700">{ddPct}% Drawdown Consumed</span>
              </div>
            </div>
          </div>

          {/* 4 Performance KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: TOTAL AMOUNT OF POINTS */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total Amount of Points
                </span>
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isPointsPos ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                  }`}
                >
                  {isPointsPos ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2 font-mono">
                <span
                  className={`text-3xl font-black ${
                    isPointsPos ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {isPointsPos ? `+${totalPoints.toFixed(2)}` : totalPoints.toFixed(2)}
                </span>
                <span className="text-xs font-bold text-slate-400">pts</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400 font-mono">
                Captured across {stats.total_trades} trade(s)
              </div>
            </div>

            {/* Card 2: SESSION MONEY PNL */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Session Money PnL
                </span>
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isMoneyProfit ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                  }`}
                >
                  <Zap className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2 font-mono">
                <span
                  className={`text-3xl font-black ${
                    isMoneyProfit ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {isCent ? (
                    rawProfit >= 0 ? `+${rawProfit.toFixed(2)}` : rawProfit.toFixed(2)
                  ) : (
                    rawProfit >= 0 ? `+$${rawProfit.toFixed(2)}` : `-$${Math.abs(rawProfit).toFixed(2)}`
                  )}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {isCent ? "USC" : "USD"}
                </span>
              </div>
              <div className="mt-2 text-[11px] font-mono text-indigo-600 font-semibold flex items-center justify-between">
                <span>
                  ≈ ৳{Math.abs(moneyBDT).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} BDT
                </span>
                {isCent && (
                  <span className="text-slate-400">
                    (${moneyUSD >= 0 ? `+$${moneyUSD.toFixed(2)}` : `-$${Math.abs(moneyUSD).toFixed(2)}`})
                  </span>
                )}
              </div>
            </div>

            {/* Card 3: SESSION TRADES & WIN RATE */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Win Rate & Trades
                </span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2 font-mono">
                <span className="text-3xl font-black text-slate-900">
                  {stats.win_rate}%
                </span>
                <span className="text-xs font-bold text-slate-400">Win Rate</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                <span className="text-emerald-600 font-bold">{stats.won_trades} W</span>
                <span>•</span>
                <span className="text-rose-600 font-bold">{stats.lost_trades} L</span>
                <span>•</span>
                <span>{stats.total_trades} Total</span>
              </div>
            </div>

            {/* Card 4: PROFIT PER TRADE */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Average / Trade
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2 font-mono">
                <span className="text-3xl font-black text-slate-900">
                  {stats.total_trades > 0
                    ? (rawProfit / stats.total_trades).toFixed(2)
                    : "0.00"}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {isCent ? "USC/trade" : "$/trade"}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400 font-mono">
                Average scalp execution return
              </div>
            </div>
          </div>

          {/* 4. TRADES LIST FOR THIS SESSION */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  <span>Session Executed Positions</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Live execution table showing money PnL during this active session ({currLabel}).
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-slate-100 text-slate-700">
                {trades.length} Position(s)
              </span>
            </div>

            {trades.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-mono text-xs">
                No trades taken yet in this session window.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Ticket</th>
                      <th className="py-2.5 px-3">Symbol</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3 text-right">Volume</th>
                      <th className="py-2.5 px-3 text-right">Price</th>
                      <th className="py-2.5 px-3 text-right font-bold text-indigo-700">
                        {isCent ? "Profit (USC)" : "Profit (USD)"}
                      </th>
                      <th className="py-2.5 px-3 text-right">BDT Equivalent</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {trades.map((t, idx) => {
                      const tProfit = Number(t.profit || 0);
                      const isProfitPos = tProfit >= 0;
                      const tUsd = isCent ? tProfit / 100 : tProfit;
                      const tBdt = tUsd * bdtRate;

                      return (
                        <tr key={t.ticket || idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3 text-slate-400">{t.time}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-700">#{t.ticket}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{t.symbol}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                t.type === "BUY"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {t.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600">
                            {Number(t.volume || 0).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-700">{t.price}</td>
                          <td
                            className={`py-2.5 px-3 text-right font-bold ${
                              isProfitPos ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {isCent ? (
                              isProfitPos ? `+${tProfit.toFixed(2)} USC` : `${tProfit.toFixed(2)} USC`
                            ) : (
                              isProfitPos ? `+$${tProfit.toFixed(2)}` : `-$${Math.abs(tProfit).toFixed(2)}`
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-500">
                            ≈ {tBdt >= 0 ? `৳${Math.round(tBdt).toLocaleString()}` : `-৳${Math.round(Math.abs(tBdt)).toLocaleString()}`}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {t.is_closed ? (
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                Closed
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 animate-pulse">
                                Running
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* No session active currently */
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              No Session Active Right Now
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Select one of your saved sessions above to configure its drawdown stop limit ({currLabel}) and start tracking.
            </p>
          </div>
          {sessions.length > 0 && (
            <button
              onClick={() => handleOpenActivateModal(sessions[0])}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Set Drawdown & Activate "{sessions[0].name}"</span>
            </button>
          )}
        </div>
      )}

      {/* MODAL: Set Session Drawdown Before Activation */}
      {activatingSession && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  <span>Configure Session Drawdown</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set safety stop limits before launching "{activatingSession.name}".
                </p>
              </div>
              <button
                onClick={() => setActivatingSession(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Session Drawdown Stop Limit ({currLabel})</span>
                  <span className="text-[11px] font-mono text-indigo-600 font-normal">{isCent ? "USC" : "USD"}</span>
                </label>
                <input
                  type="number"
                  step="1"
                  value={drawdownAmountInput}
                  onChange={(e) => setDrawdownAmountInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder={isCent ? "e.g. 2500" : "e.g. 25"}
                />
                <p className="text-[11px] text-slate-400">
                  {isCent
                    ? `2,500 USC = $25.00 USD (≈ ৳${Math.round(25 * bdtRate).toLocaleString()} BDT) maximum drawdown limit for this session.`
                    : `Maximum loss allowed before drawdown limit is reached.`}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActivatingSession(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isActivating}
                onClick={handleConfirmActivate}
                className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md transition-all active:scale-98 flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isActivating ? "Starting..." : "Start Session"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Direct Quit Session Confirmation */}
      {showQuitModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Quit Active Session?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tracking will conclude immediately and save to history.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Session PnL:</span>
                <span className={rawProfit >= 0 ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                  {isCent
                    ? `${rawProfit >= 0 ? `+${rawProfit.toFixed(2)}` : rawProfit.toFixed(2)} USC`
                    : `${rawProfit >= 0 ? `+$${rawProfit.toFixed(2)}` : `-$${Math.abs(rawProfit).toFixed(2)}`}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">BDT Value:</span>
                <span className="text-slate-700 font-bold">
                  ≈ {moneyBDT >= 0 ? `৳${Math.round(moneyBDT).toLocaleString()}` : `-৳${Math.round(Math.abs(moneyBDT)).toLocaleString()}`}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowQuitModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                No, Keep Running
              </button>
              <button
                type="button"
                onClick={handleQuitSession}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-all active:scale-98 flex items-center gap-1.5"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Yes, Quit Session</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
