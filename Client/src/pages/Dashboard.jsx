import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowRight,
  ShieldCheck,
  Target,
  Layers,
  History,
  Timer,
  Wallet,
  Play,
  Scale,
  Sparkles,
} from "lucide-react";
import usePolling from "@/hooks/usePolling";
import { API } from "@/api/endpoint";
import { NAVIGATION_CONFIG } from "@/config/navigationConfig";

function formatTimer(totalSec) {
  if (!totalSec || totalSec <= 0) return "00:00:00";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Dashboard() {
  // Live polling feeds
  const { data: headerRes } = usePolling(API.header, 2000);
  const { data: trackerRes } = usePolling(API.tracker, 2000);
  const { data: historyRes } = usePolling(API.sessionHistory, 3000);

  const account = headerRes?.data?.account || {};
  const summary = headerRes?.data?.summary || {};
  const trackerData = trackerRes?.data || {};
  const activeSession = trackerData.active_session || null;
  const recentTrades = trackerData.trades || [];
  const trackerStats = trackerData.stats || {};

  const historyData = historyRes?.data;
  const sessionsHistory = useMemo(() => historyData?.sessions_history || [], [historyData]);

  const bdtRate = NAVIGATION_CONFIG.usdToBdtRate || 124.09;
  const isCent = account.is_cent ?? account.currency === "USC";

  // Account normalized values
  const balanceUSD = isCent ? (account.balance || 0) / 100 : account.balance || 0;
  const equityUSD = isCent ? (account.equity || 0) / 100 : account.equity || 0;
  const equityBDT = equityUSD * bdtRate;
  const floatingProfitUSD = isCent ? (account.profit || 0) / 100 : account.profit || 0;

  // Cumulative Session History Aggregates
  const cumulative = useMemo(() => {
    let totalPoints = 0.0;
    let totalMoney = 0.0;
    let won = 0;
    let lost = 0;
    let grossProfit = 0.0;
    let grossLoss = 0.0;

    sessionsHistory.forEach((item) => {
      const st = item.stats || {};
      totalPoints += st.total_captured_points || 0;
      totalMoney += st.total_money_usd || 0;
      won += st.won_trades || 0;
      lost += st.lost_trades || 0;
      grossProfit += st.gross_profit || 0;
      grossLoss += st.gross_loss || 0;
    });

    const totalDeals = won + lost;
    const winRate = totalDeals > 0 ? (won / totalDeals) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? grossProfit : 0);

    return {
      totalPoints: Math.round(totalPoints * 100) / 100,
      totalMoneyUSD: Math.round(totalMoney * 100) / 100,
      totalMoneyBDT: Math.round(totalMoney * bdtRate),
      winRate: Math.round(winRate * 10) / 10,
      profitFactor: Math.round(profitFactor * 100) / 100,
      totalDeals,
      won,
      lost,
    };
  }, [sessionsHistory, bdtRate]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. TOP HERO HEADER - Command Overview */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Quant Scalping Terminal
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-200">
              {isCent ? "Cent Account (USC)" : "Standard (USD)"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Live quantitative point surveillance engine connected to MT5 ({account.server || "Connected"}). Focused strictly on disciplined session time windows and net point yield.
          </p>
        </div>

        {/* Quick Route Shortcuts */}
        <div className="flex items-center gap-2.5 self-start lg:self-center">
          <Link
            to="/tracker"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs shadow-md transition-all active:scale-98"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Open Tracker</span>
          </Link>
          <Link
            to="/history"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs shadow-2xs transition-all"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>Session History</span>
          </Link>
        </div>
      </div>

      {/* 2. LIVE ACTIVE SESSION BANNER (OR QUICK START CALLOUT) */}
      {activeSession ? (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 border border-slate-700 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>SESSION SURVEILLANCE RUNNING</span>
              </div>
              <h2 className="text-xl font-black tracking-tight flex items-center gap-3">
                <span>{activeSession.name}</span>
                <span className="text-xs font-mono font-medium text-slate-300 bg-white/10 px-2.5 py-0.5 rounded">
                  Window: {activeSession.duration_hours}h
                </span>
              </h2>
              <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
                <span>Points: <strong className={trackerStats.total_captured_points >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {trackerStats.total_captured_points >= 0 ? `+${Number(trackerStats.total_captured_points || 0).toFixed(2)}` : Number(trackerStats.total_captured_points || 0).toFixed(2)} pts
                </strong></span>
                <span>•</span>
                <span>PnL: <strong className={trackerStats.total_money_usd >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {trackerStats.total_money_usd >= 0 ? `+$${trackerStats.total_money_usd.toFixed(2)}` : `-$${Math.abs(trackerStats.total_money_usd).toFixed(2)}`}
                </strong></span>
                <span>•</span>
                <span>Trades: {trackerStats.total_trades || 0} ({trackerStats.win_rate || 0}% WR)</span>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-black/40 backdrop-blur-md px-5 py-3.5 rounded-xl border border-white/10 font-mono">
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                  <Timer className="w-3.5 h-3.5 text-indigo-400" />
                  Remaining
                </span>
                <span className="text-2xl font-black tracking-widest text-emerald-400 mt-0.5">
                  {formatTimer(trackerStats.duration_left_sec)}
                </span>
                <span className="text-[10px] text-slate-400">
                  Elapsed: {formatTimer(trackerStats.elapsed_sec)}
                </span>
              </div>

              <Link
                to="/tracker"
                className="ml-2 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1"
              >
                <span>Live Feed</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800">
                No Scalp Session Currently Active
              </div>
              <p className="text-xs text-slate-400">
                Start a session in the tracker to track point capture, countdown limits, and deal metrics.
              </p>
            </div>
          </div>
          <Link
            to="/tracker"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition-all self-start sm:self-auto"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Launch a Session</span>
          </Link>
        </div>
      )}

      {/* 3. 4-KPI SUMMARY TILES (Standard Design Pattern) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: TOTAL CUMULATIVE POINTS */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Cumulative Points Won
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                cumulative.totalPoints >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
              }`}
            >
              {cumulative.totalPoints >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2 font-mono">
            <span
              className={`text-3xl font-black ${
                cumulative.totalPoints >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {cumulative.totalPoints >= 0 ? `+${cumulative.totalPoints.toFixed(2)}` : cumulative.totalPoints.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-slate-400">Points</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono">
            Across {cumulative.totalDeals} historical session trade(s)
          </div>
        </div>

        {/* Card 2: ACCOUNT EQUITY & CONVERTED BDT */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Account Equity
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2 font-mono">
            <span className="text-2xl font-black text-slate-900">
              ${equityUSD.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-slate-400">USD</span>
          </div>
          <div className="mt-2 text-[11px] font-mono text-indigo-600 font-semibold flex items-center justify-between">
            <span>≈ ৳{equityBDT.toLocaleString("en-US", { maximumFractionDigits: 0 })} BDT</span>
            <span className={floatingProfitUSD >= 0 ? "text-emerald-600" : "text-rose-600"}>
              Float: {floatingProfitUSD >= 0 ? `+$${floatingProfitUSD.toFixed(2)}` : `-$${Math.abs(floatingProfitUSD).toFixed(2)}`}
            </span>
          </div>
        </div>

        {/* Card 3: HISTORICAL WIN RATE */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Session Win Rate
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2 font-mono">
            <span className="text-2xl font-black text-slate-900">
              {cumulative.winRate}%
            </span>
            <span className="text-xs font-bold text-slate-400">Win Rate</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
            <span className="text-emerald-600 font-bold">{cumulative.won} Won</span>
            <span>•</span>
            <span className="text-rose-600 font-bold">{cumulative.lost} Lost</span>
          </div>
        </div>

        {/* Card 4: OVERALL PROFIT FACTOR */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Profit Factor
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2 font-mono">
            <span
              className={`text-2xl font-black ${
                cumulative.profitFactor >= 1.5
                  ? "text-emerald-600"
                  : cumulative.profitFactor >= 1.0
                  ? "text-slate-900"
                  : "text-amber-600"
              }`}
            >
              {cumulative.profitFactor.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-slate-400">Ratio</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 font-mono flex items-center justify-between">
            <span>Net: {cumulative.totalMoneyUSD >= 0 ? `+$${cumulative.totalMoneyUSD.toFixed(1)}` : `-$${Math.abs(cumulative.totalMoneyUSD).toFixed(1)}`}</span>
            <span>{sessionsHistory.length} Sessions</span>
          </div>
        </div>
      </div>

      {/* 4. TWO-COLUMN SPLIT: RECENT ACTIVE TRADES & ACCOUNT RISK MARGIN STATUS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Session Trades (2 Cols wide) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-600" />
                <span>Recent Scalp Deals (Live Feed)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Latest deals bounded to current scalping activity.
              </p>
            </div>
            <Link
              to="/tracker"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <span>View Tracker</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="flex-1 overflow-x-auto">
            {recentTrades.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium">No trades recorded yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Active and closed positions in your current session will appear here in real-time.
                </p>
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Ticket</th>
                    <th className="py-2.5 px-3">Symbol</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Volume</th>
                    <th className="py-2.5 px-3 text-right text-indigo-700 font-bold">Points</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-700">Money USD</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {recentTrades.slice(0, 5).map((t, idx) => {
                    const isPointPos = (t.points || 0) >= 0;
                    const isMoneyPos = (t.profit || 0) >= 0;
                    return (
                      <tr key={t.ticket || idx} className="hover:bg-slate-50/70 transition-colors">
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
                        <td className="py-2 px-3 text-right text-slate-600">
                          {Number(t.volume || 0).toFixed(2)}
                        </td>
                        <td className={`py-2 px-3 text-right font-black ${
                          isPointPos ? "text-emerald-600" : "text-rose-600"
                        }`}>
                          {isPointPos ? `+${Number(t.points || 0).toFixed(2)}` : Number(t.points || 0).toFixed(2)} pts
                        </td>
                        <td className={`py-2 px-3 text-right font-bold ${
                          isMoneyPos ? "text-emerald-600" : "text-rose-600"
                        }`}>
                          {isMoneyPos ? `+$${Number(t.profit || 0).toFixed(2)}` : `-$${Math.abs(Number(t.profit || 0)).toFixed(2)}`}
                        </td>
                        <td className="py-2 px-3 text-center">
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
            )}
          </div>
        </div>

        {/* Right Column: Account & Risk Health Gauge */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Account & Risk Health</span>
              </span>
              <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200">
                Healthy
              </span>
            </div>

            <div className="mt-4 space-y-3 text-xs font-mono">
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Account Balance</span>
                <span className="font-bold text-slate-900">${balanceUSD.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Live Equity</span>
                <span className="font-bold text-slate-900">${equityUSD.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Free Margin</span>
                <span className="font-bold text-slate-900">${(account.margin_free || 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Margin Level</span>
                <span className="font-bold text-emerald-600">
                  {account.margin_level ? `${Math.round(account.margin_level)}%` : "∞"}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Current Exposure</span>
                <span className="font-bold text-slate-900">
                  ${(summary.total_volume_usd || 0).toLocaleString("en-US", { maximumFractionDigits: 1 })} ({summary.total_lots || 0} lots)
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">Open Positions</span>
                <span className="font-bold text-slate-900">{summary.total_positions || 0} active</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <span>
              Leverage is <strong>1:{account.leverage || 2000}</strong>. Point-based risk tracking ensures positions remain disciplined within active time windows.
            </span>
          </div>
        </div>
      </div>

      {/* 5. RECENT SESSIONS AUDIT SNIPPET */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Past Scalping Sessions Audit
            </h2>
          </div>
          <Link
            to="/history"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            <span>Full History Table</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {sessionsHistory.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No completed sessions found. Create a session to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {sessionsHistory.slice(0, 3).map((item) => {
              const s = item.session;
              const st = item.stats || {};
              const pts = st.total_captured_points || 0;
              const usd = st.total_money_usd || 0;
              const isPtsPos = pts >= 0;
              return (
                <div
                  key={s.id}
                  className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl flex flex-col justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {s.name}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                      item.is_full_run ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      {item.is_full_run ? "Full Run" : "Ended Early"}
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between font-mono">
                    <span className={`text-base font-black ${isPtsPos ? "text-emerald-600" : "text-rose-600"}`}>
                      {pts >= 0 ? `+${pts.toFixed(2)}` : pts.toFixed(2)} pts
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      {usd >= 0 ? `+$${usd.toFixed(2)}` : `-$${Math.abs(usd).toFixed(2)}`}
                    </span>
                  </div>

                  <div className="mt-2 text-[10px] text-slate-400 font-mono flex items-center justify-between border-t border-slate-200/60 pt-2">
                    <span>{st.total_trades || 0} trades • {st.win_rate || 0}% WR</span>
                    <span>{item.target_hours}h Window</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
