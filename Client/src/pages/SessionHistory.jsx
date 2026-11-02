import React, { useState, useMemo } from "react";
import {
  History,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  X,
  ChevronRight,
  Activity,
  Zap,
  Scale,
  RefreshCw,
} from "lucide-react";
import usePolling from "@/hooks/usePolling";
import { API } from "@/api/endpoint";
import { NAVIGATION_CONFIG } from "@/config/navigationConfig";

function formatSeconds(sec) {
  if (!sec || sec <= 0) return "0m";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

const EMPTY_OUTSIDE = { total_trades: 0, total_points: 0, total_money_usd: 0, trades: [] };

export default function SessionHistory() {
  const { data: res, loading, error, refetch } = usePolling(API.sessionHistory, 3000);
  const historyData = res?.data;
  const sessions = useMemo(() => historyData?.sessions_history || [], [historyData]);
  const outside = historyData?.outside_sessions || EMPTY_OUTSIDE;

  const [selectedSession, setSelectedSession] = useState(null);
  const [showOutsideModal, setShowOutsideModal] = useState(false);

  const bdtRate = NAVIGATION_CONFIG.usdToBdtRate || 124.09;

  // Aggregate Metrics across all sessions
  const aggregate = useMemo(() => {
    let totalSessions = sessions.length;
    let completedRuns = 0;
    let totalTrades = 0;
    let wonTrades = 0;
    let lostTrades = 0;
    let totalCapturedPoints = 0.0;
    let totalMoneyUSD = 0.0;
    let grossProfit = 0.0;
    let grossLoss = 0.0;
    let totalRunSec = 0;

    sessions.forEach((item) => {
      if (item.is_full_run) completedRuns++;
      totalRunSec += item.run_seconds || 0;
      const st = item.stats || {};
      totalTrades += st.total_trades || 0;
      wonTrades += st.won_trades || 0;
      lostTrades += st.lost_trades || 0;
      totalCapturedPoints += st.total_captured_points || 0;
      totalMoneyUSD += st.total_money_usd || 0;
      grossProfit += st.gross_profit || 0;
      grossLoss += st.gross_loss || 0;
    });

    const totalDecided = wonTrades + lostTrades;
    const winRate = totalDecided > 0 ? (wonTrades / totalDecided) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? grossProfit : 0);

    return {
      totalSessions,
      completedRuns,
      totalTrades,
      wonTrades,
      lostTrades,
      winRate: Math.round(winRate * 10) / 10,
      totalCapturedPoints: Math.round(totalCapturedPoints * 100) / 100,
      totalMoneyUSD: Math.round(totalMoneyUSD * 100) / 100,
      totalMoneyBDT: Math.round(totalMoneyUSD * bdtRate),
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossLoss: Math.round(grossLoss * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      totalRunSec,
    };
  }, [sessions, bdtRate]);

  const isMoneyProfit = aggregate.totalMoneyUSD >= 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. TOP HEADER - Matching Sessions & Tracker pages */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Session History
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-200">
              Analytics & Audit
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Historical audit of scalping windows, point metrics, win rates, and profit factors.
          </p>
        </div>

        <button
          onClick={() => refetch && refetch()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs shadow-md transition-all active:scale-98 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Data</span>
        </button>
      </div>

      {error && !res && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>Error loading session history: {error}</span>
        </div>
      )}

      {/* 2. 3-KPI SUMMARY CARDS (Total Captured Points removed as requested) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: TOTAL MONEY PNL (USD & BDT) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Cumulative Money PnL
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
              className={`text-2xl font-black ${
                isMoneyProfit ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {isMoneyProfit
                ? `+$${aggregate.totalMoneyUSD.toFixed(2)}`
                : `-$${Math.abs(aggregate.totalMoneyUSD).toFixed(2)}`}
            </span>
            <span className="text-xs font-bold text-slate-400">USD</span>
          </div>
          <div className="mt-2 text-[11px] font-mono text-indigo-600 font-semibold">
            ≈ {aggregate.totalMoneyBDT >= 0 ? `৳${aggregate.totalMoneyBDT.toLocaleString()}` : `-৳${Math.abs(aggregate.totalMoneyBDT).toLocaleString()}`} BDT
          </div>
        </div>

        {/* Card 2: WIN RATE & TRADES */}
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
            <span className="text-2xl font-black text-slate-900">
              {aggregate.winRate}%
            </span>
            <span className="text-xs font-bold text-slate-400">Win Rate</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
            <span className="text-emerald-600 font-bold">{aggregate.wonTrades} Won</span>
            <span>•</span>
            <span className="text-rose-600 font-bold">{aggregate.lostTrades} Lost</span>
          </div>
        </div>

        {/* Card 3: PROFIT FACTOR & SESSIONS */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Profit Factor & Time
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2 font-mono">
            <span
              className={`text-2xl font-black ${
                aggregate.profitFactor >= 1.5
                  ? "text-emerald-600"
                  : aggregate.profitFactor >= 1.0
                  ? "text-slate-900"
                  : "text-amber-600"
              }`}
            >
              {aggregate.profitFactor.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-slate-400">PF</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 font-mono flex items-center justify-between">
            <span>{aggregate.completedRuns}/{aggregate.totalSessions} Full Runs</span>
            <span>{formatSeconds(aggregate.totalRunSec)}</span>
          </div>
        </div>
      </div>

      {/* 3. SESSIONS HISTORY TABULAR AUDIT - Clean Card with Standard Table Styling */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Session History Audit Table</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Historical record of all configured scalp sessions, runtime completion, and verified point PnL.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 self-start sm:self-auto">
            {sessions.length} Sessions Logged
          </span>
        </div>

        {loading && sessions.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300 animate-pulse" />
            <p className="text-sm">Loading session history...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <History className="w-6 h-6" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-800">No Session History Yet</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Once you run a session in the Tracker, complete analytics and deal logs will appear in this table.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Session Name</th>
                  <th className="py-3 px-3">Run Status</th>
                  <th className="py-3 px-3">Target</th>
                  <th className="py-3 px-3">Actual Run</th>
                  <th className="py-3 px-3 text-right">Trades (W/L)</th>
                  <th className="py-3 px-3 text-right">Win Rate</th>
                  <th className="py-3 px-3 text-right">Profit Factor</th>
                  <th className="py-3 px-4 text-right font-bold text-slate-700">Money (USD)</th>
                  <th className="py-3 px-4 text-right text-indigo-700 font-bold">BDT Value</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((item) => {
                  const s = item.session;
                  const stats = item.stats || {};
                  const usd = stats.total_money_usd || 0;
                  const bdt = usd * bdtRate;
                  const winRate = stats.win_rate || 0;
                  const pf = stats.profit_factor || 0;
                  const isPositiveUsd = usd >= 0;
                  const isFullRun = item.is_full_run;
                  const hasRun = item.has_run;

                  return (
                    <tr
                      key={item.run_id || s.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Name */}
                      <td className="py-3 px-4 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {s.name}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            #{s.id}
                          </span>
                        </div>
                        {item.started_at && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Started: {item.started_at}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {s.status === "ACTIVE" ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            RUNNING
                          </span>
                        ) : hasRun ? (
                          isFullRun ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Full Run
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Ended Early
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                            Ready
                          </span>
                        )}
                      </td>

                      {/* Target */}
                      <td className="py-3 px-3 font-mono text-slate-600 font-semibold">
                        {item.target_hours}h 00m
                      </td>

                      {/* Actual Run */}
                      <td className="py-3 px-3 font-mono">
                        {hasRun ? (
                          <div>
                            <span className={`font-bold ${isFullRun ? "text-emerald-700" : "text-amber-700"}`}>
                              {formatSeconds(item.run_seconds)}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-1">
                              ({Math.min(100, Math.round((item.run_seconds / (item.target_hours * 3600)) * 100))}%)
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Trades */}
                      <td className="py-3 px-3 text-right font-mono">
                        <span className="font-bold text-slate-800">{stats.total_trades || 0}</span>
                        <span className="text-[10px] text-slate-400 ml-1">
                          ({stats.won_trades || 0}/{stats.lost_trades || 0})
                        </span>
                      </td>

                      {/* Win Rate */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                        {winRate.toFixed(1)}%
                      </td>

                      {/* Profit Factor */}
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        <span className={pf >= 1.5 ? "text-emerald-600" : (pf >= 1.0 ? "text-slate-800" : "text-amber-600")}>
                          {pf.toFixed(2)}
                        </span>
                      </td>

                      {/* Money PnL */}
                      <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                        <span className={`font-bold ${isPositiveUsd ? "text-emerald-600" : "text-rose-600"}`}>
                          {usd >= 0 ? `+$${usd.toFixed(2)}` : `-$${Math.abs(usd).toFixed(2)}`}
                        </span>
                      </td>

                      {/* BDT Value */}
                      <td className="py-3 px-4 text-right font-mono whitespace-nowrap text-slate-700 font-semibold">
                        ≈ {bdt >= 0 ? `৳${Math.round(bdt).toLocaleString()}` : `-৳${Math.round(Math.abs(bdt)).toLocaleString()}`}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedSession(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-[11px] shadow-2xs transition-all active:scale-95 whitespace-nowrap"
                        >
                          <span>Positions ({item.trades?.length || 0})</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. IGNORED SECTION: Trades outside sessions */}
      {/* Kept subtle, discreet, unhighlighted as requested */}
      <div className="pt-2">
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 text-slate-500 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span className="font-semibold text-slate-600">
                Outside session trades (ignored)
              </span>
              <span className="text-[11px] text-slate-400">
                • {outside.total_trades || 0} trades taken without an active session
              </span>
            </div>

            <div className="flex items-center gap-4">
              <span className="font-mono text-[11px] text-slate-500">
                Points: {outside.total_points >= 0 ? `+${(outside.total_points || 0).toFixed(2)}` : (outside.total_points || 0).toFixed(2)}
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                PnL: {outside.total_money_usd >= 0 ? `+$${(outside.total_money_usd || 0).toFixed(2)}` : `-$${Math.abs(outside.total_money_usd || 0).toFixed(2)}`}
              </span>
              {outside.total_trades > 0 && (
                <button
                  onClick={() => setShowOutsideModal(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 underline font-medium"
                >
                  inspect
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: View Session Trades - Styled identically to the Tracker positions table */}
      {selectedSession && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-white">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-extrabold text-slate-900">
                    {selectedSession.session.name}
                  </h3>
                  <span className="text-xs font-mono text-slate-400">
                    #{selectedSession.session.id}
                  </span>
                  {selectedSession.is_full_run ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                      Full Run
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded">
                      Early Exit ({formatSeconds(selectedSession.run_seconds)})
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Positions and closed deals strictly bounded within this session's time window.
                </p>
              </div>

              <button
                onClick={() => setSelectedSession(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Summary KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-slate-50 border-b border-slate-200 text-xs font-mono">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Deals</span>
                <span className="text-sm font-extrabold text-slate-900">
                  {selectedSession.stats?.total_trades || 0}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Win Rate</span>
                <span className="text-sm font-extrabold text-slate-900">
                  {selectedSession.stats?.win_rate || 0}%
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Profit Factor</span>
                <span className="text-sm font-extrabold text-slate-900">
                  {(selectedSession.stats?.profit_factor || 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Captured Points</span>
                <span className={`text-sm font-black ${
                  (selectedSession.stats?.total_captured_points || 0) >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}>
                  {(selectedSession.stats?.total_captured_points || 0) >= 0 ? `+${(selectedSession.stats?.total_captured_points || 0).toFixed(2)}` : (selectedSession.stats?.total_captured_points || 0).toFixed(2)} pts
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Money PnL</span>
                <span className={`text-sm font-black ${
                  (selectedSession.stats?.total_money_usd || 0) >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}>
                  {(selectedSession.stats?.total_money_usd || 0) >= 0 ? `+$${(selectedSession.stats?.total_money_usd || 0).toFixed(2)}` : `-$${Math.abs(selectedSession.stats?.total_money_usd || 0).toFixed(2)}`}
                </span>
              </div>
            </div>

            {/* Modal Trades Table */}
            <div className="flex-1 overflow-y-auto p-4">
              {(!selectedSession.trades || selectedSession.trades.length === 0) ? (
                <div className="py-12 text-center text-slate-400">
                  <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">No positions executed in this session window</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Time</th>
                        <th className="py-2.5 px-3">Ticket</th>
                        <th className="py-2.5 px-3">Symbol</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-right">Volume</th>
                        <th className="py-2.5 px-3 text-right">Price</th>
                        <th className="py-2.5 px-3 text-right text-indigo-700 font-bold">Points</th>
                        <th className="py-2.5 px-3 text-right font-bold text-slate-700">Money USD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {selectedSession.trades.map((t) => {
                        const isWin = (t.points || 0) >= 0;
                        const isMoneyWin = (t.profit || 0) >= 0;
                        return (
                          <tr key={t.ticket} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2 px-3 text-slate-500">{t.time}</td>
                            <td className="py-2 px-3 font-bold text-slate-700">#{t.ticket}</td>
                            <td className="py-2 px-3 font-bold text-slate-900">{t.symbol}</td>
                            <td className="py-2 px-3">
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
                            <td className="py-2 px-3 text-right text-slate-600">{Number(t.volume).toFixed(2)}</td>
                            <td className="py-2 px-3 text-right text-slate-700">{t.price}</td>
                            <td className={`py-2 px-3 text-right font-black ${
                              isWin ? "text-emerald-600" : "text-rose-600"
                            }`}>
                              {t.points >= 0 ? `+${Number(t.points).toFixed(2)}` : Number(t.points).toFixed(2)} pts
                            </td>
                            <td className={`py-2 px-3 text-right font-bold ${
                              isMoneyWin ? "text-emerald-600" : "text-rose-600"
                            }`}>
                              {isMoneyWin ? `+$${Number(t.profit).toFixed(2)}` : `-$${Math.abs(Number(t.profit)).toFixed(2)}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 flex justify-end bg-slate-50">
              <button
                onClick={() => setSelectedSession(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs shadow-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Outside Session Trades (Ignored) */}
      {showOutsideModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-150">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Trades Outside Sessions
                </h3>
                <p className="text-xs text-slate-400">
                  Executed outside configured session windows and strictly excluded from session metrics.
                </p>
              </div>
              <button
                onClick={() => setShowOutsideModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold">
                    <tr>
                      <th className="py-2 px-3">Ticket</th>
                      <th className="py-2 px-3">Time</th>
                      <th className="py-2 px-3">Symbol</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3 text-right">Points</th>
                      <th className="py-2 px-3 text-right">PnL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {outside.trades.map((t) => (
                      <tr key={t.ticket}>
                        <td className="py-1.5 px-3 text-slate-500">#{t.ticket}</td>
                        <td className="py-1.5 px-3 text-slate-500">{t.time}</td>
                        <td className="py-1.5 px-3 text-slate-800 font-bold">{t.symbol}</td>
                        <td className="py-1.5 px-3 text-slate-600">{t.type}</td>
                        <td className="py-1.5 px-3 text-right text-slate-700 font-bold">
                          {t.points >= 0 ? `+${Number(t.points).toFixed(2)}` : Number(t.points).toFixed(2)}
                        </td>
                        <td className="py-1.5 px-3 text-right text-slate-700 font-bold">
                          {(t.profit || 0) >= 0 ? `+$${Number(t.profit).toFixed(2)}` : `-$${Math.abs(Number(t.profit)).toFixed(2)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 flex justify-end bg-slate-50">
              <button
                onClick={() => setShowOutsideModal(false)}
                className="px-4 py-1.5 text-xs text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
