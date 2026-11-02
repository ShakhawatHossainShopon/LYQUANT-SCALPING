import React, { useState } from "react";
import {
  ShieldAlert,
  Sliders,
  DollarSign,
  TrendingDown,
  Save,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import usePolling from "@/hooks/usePolling";
import { API } from "@/api/endpoint";
import { NAVIGATION_CONFIG } from "@/config/navigationConfig";

const STORAGE_KEY = "liquant_scalping_risk_guard_settings";

export default function RiskGuard() {
  const { data: headerRes } = usePolling(API.header, 2000);
  const { data: trackerRes } = usePolling(API.tracker, 2000);

  const account = headerRes?.data?.account || {};
  const trackerData = trackerRes?.data || {};
  const stats = trackerData.stats || {};

  const bdtRate = NAVIGATION_CONFIG.usdToBdtRate || 124.09;

  // Local settings with localStorage persistence
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {
      maxPointsDrawdown: "50",
      maxDailyLossUSD: "25",
      maxOpenLots: "1.0",
      minMarginLevel: "500",
      autoEndOnLimit: true,
      soundAlerts: false,
    };
  });

  const [savedBanner, setSavedBanner] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 3000);
  };

  const handleReset = () => {
    const defaults = {
      maxPointsDrawdown: "50",
      maxDailyLossUSD: "25",
      maxOpenLots: "1.0",
      minMarginLevel: "500",
      autoEndOnLimit: true,
      soundAlerts: false,
    };
    setSettings(defaults);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 3000);
  };

  // Real-time violations check against active session
  const currentPoints = stats.total_captured_points || 0;
  const currentLossUSD = Math.max(0, -(stats.total_money_usd || 0));
  const currentMarginLevel = account.margin_level || 99999;

  const isPointsBreached = currentPoints < -parseFloat(settings.maxPointsDrawdown || 9999);
  const isLossBreached = currentLossUSD > parseFloat(settings.maxDailyLossUSD || 9999);
  const isMarginBreached = currentMarginLevel < parseFloat(settings.minMarginLevel || 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. TOP HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Risk Guard & Session Safety Limits
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-rose-50 text-rose-700 border border-rose-200">
              Capital Protection
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure hard stop-loss point limits, max money drawdown thresholds, and margin alerts for scalping sessions.
          </p>
        </div>

        {savedBanner && (
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Settings Saved</span>
          </div>
        )}
      </div>

      {/* 2. REAL-TIME GUARD STATUS BANNER */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1: Points Drawdown Guard */}
        <div className={`p-5 rounded-2xl border ${
          isPointsBreached
            ? "bg-rose-50 border-rose-300 text-rose-900 ring-2 ring-rose-500/20"
            : "bg-white border-slate-200 text-slate-900"
        } shadow-xs`}>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-2">
            <span>Points Stop Guard</span>
            <TrendingDown className={`w-4 h-4 ${isPointsBreached ? "text-rose-600" : "text-slate-400"}`} />
          </div>
          <div className="text-2xl font-black font-mono">
            {currentPoints >= 0 ? `+${currentPoints.toFixed(2)}` : currentPoints.toFixed(2)} pts
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            Limit: -{settings.maxPointsDrawdown} pts {isPointsBreached && <span className="text-rose-700 font-bold">(BREACHED)</span>}
          </div>
        </div>

        {/* Metric 2: Max Loss USD Guard */}
        <div className={`p-5 rounded-2xl border ${
          isLossBreached
            ? "bg-rose-50 border-rose-300 text-rose-900 ring-2 ring-rose-500/20"
            : "bg-white border-slate-200 text-slate-900"
        } shadow-xs`}>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-2">
            <span>Session Loss Guard</span>
            <DollarSign className={`w-4 h-4 ${isLossBreached ? "text-rose-600" : "text-slate-400"}`} />
          </div>
          <div className="text-2xl font-black font-mono">
            ${currentLossUSD.toFixed(2)} USD
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            Cap: ${settings.maxDailyLossUSD} (≈ ৳{(parseFloat(settings.maxDailyLossUSD || 0) * bdtRate).toLocaleString("en-US", { maximumFractionDigits: 0 })} BDT)
          </div>
        </div>

        {/* Metric 3: Margin Level Safety */}
        <div className={`p-5 rounded-2xl border ${
          isMarginBreached
            ? "bg-rose-50 border-rose-300 text-rose-900 ring-2 ring-rose-500/20"
            : "bg-white border-slate-200 text-slate-900"
        } shadow-xs`}>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-2">
            <span>Margin Cushion</span>
            <ShieldAlert className={`w-4 h-4 ${isMarginBreached ? "text-rose-600" : "text-emerald-500"}`} />
          </div>
          <div className="text-2xl font-black font-mono">
            {account.margin_level ? `${Math.round(account.margin_level)}%` : "Safe"}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            Min Threshold: {settings.minMarginLevel}%
          </div>
        </div>
      </div>

      {/* 3. SETTINGS FORM */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <span>Configurable Scalping Risk Parameters</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Set safety limits to ensure disciplined scalping without blowing accounts.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Setting 1: Max Points Drawdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>Max Session Point Drawdown (pts)</span>
            </label>
            <input
              type="number"
              step="1"
              value={settings.maxPointsDrawdown}
              onChange={(e) => setSettings({ ...settings, maxPointsDrawdown: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="e.g. 50"
            />
            <p className="text-[11px] text-slate-400">
              Triggers warning or action if cumulative session points drop below this threshold.
            </p>
          </div>

          {/* Setting 2: Max Loss USD */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>Max Session Money Loss ($ USD)</span>
            </label>
            <input
              type="number"
              step="1"
              value={settings.maxDailyLossUSD}
              onChange={(e) => setSettings({ ...settings, maxDailyLossUSD: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="e.g. 25"
            />
            <p className="text-[11px] text-slate-400">
              Hard capital limit per active scalping window.
            </p>
          </div>

          {/* Setting 3: Max Open Lots */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>Max Combined Exposure (Lots)</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={settings.maxOpenLots}
              onChange={(e) => setSettings({ ...settings, maxOpenLots: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="e.g. 1.0"
            />
            <p className="text-[11px] text-slate-400">
              Prevents over-leveraging and revenge position sizing.
            </p>
          </div>

          {/* Setting 4: Min Margin Level */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>Minimum Margin Level (%)</span>
            </label>
            <input
              type="number"
              step="50"
              value={settings.minMarginLevel}
              onChange={(e) => setSettings({ ...settings, minMarginLevel: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="e.g. 500"
            />
            <p className="text-[11px] text-slate-400">
              Stop-out warning buffer well above broker margin call (broker call is 60%).
            </p>
          </div>
        </div>

        {/* Toggles */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoEndOnLimit}
              onChange={(e) => setSettings({ ...settings, autoEndOnLimit: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <span className="text-xs font-medium text-slate-700">
              Highlight tracker header in red when any threshold is breached
            </span>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-md transition-all active:scale-98 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Rules</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
