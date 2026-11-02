import React, { useMemo, useState } from "react";
import {
  BarChart2,
  Layers,
  Percent,
  RefreshCw,
  Award,
  Zap,
  Target,
} from "lucide-react";
import usePolling from "@/hooks/usePolling";
import { API } from "@/api/endpoint";
import { NAVIGATION_CONFIG } from "@/config/navigationConfig";

export default function AssetAnalytics() {
  const { data: res, loading, refetch } = usePolling(API.sessionHistory, 3000);
  const historyData = res?.data;
  const sessions = useMemo(() => historyData?.sessions_history || [], [historyData]);
  const bdtRate = NAVIGATION_CONFIG.usdToBdtRate || 124.09;

  const [filterType, setFilterType] = useState("ALL"); // ALL, PROFITABLE, LOSS

  // Aggregate stats broken down by Asset / Symbol
  const assetBreakdown = useMemo(() => {
    const map = {};

    sessions.forEach((s) => {
      (s.trades || []).forEach((t) => {
        const symbol = t.symbol || "UNKNOWN";
        if (!map[symbol]) {
          map[symbol] = {
            symbol,
            trades: 0,
            won: 0,
            lost: 0,
            totalPoints: 0.0,
            totalMoneyUSD: 0.0,
            grossProfit: 0.0,
            grossLoss: 0.0,
            totalVolume: 0.0,
            assetClass: symbol.includes("BTC")
              ? "Crypto"
              : symbol.includes("XAU") || symbol.includes("GOLD")
              ? "Metals"
              : symbol.includes("US30") || symbol.includes("USTEC") || symbol.includes("NAS")
              ? "Indices"
              : "Forex",
          };
        }

        const m = map[symbol];
        m.trades += 1;
        const pts = Number(t.points || 0);
        const pnl = Number(t.profit || 0);
        const vol = Number(t.volume || 0);

        m.totalPoints += pts;
        m.totalMoneyUSD += pnl;
        m.totalVolume += vol;

        if (pnl > 0 || pts > 0) {
          m.won += 1;
          m.grossProfit += Math.max(0, pnl);
        } else if (pnl < 0 || pts < 0) {
          m.lost += 1;
          m.grossLoss += Math.abs(pnl);
        }
      });
    });

    const list = Object.values(map).map((a) => {
      const decided = a.won + a.lost;
      const winRate = decided > 0 ? (a.won / decided) * 100 : 0;
      const profitFactor = a.grossLoss > 0 ? a.grossProfit / a.grossLoss : (a.grossProfit > 0 ? a.grossProfit : 0);
      return {
        ...a,
        winRate: Math.round(winRate * 10) / 10,
        profitFactor: Math.round(profitFactor * 100) / 100,
        totalPoints: Math.round(a.totalPoints * 100) / 100,
        totalMoneyUSD: Math.round(a.totalMoneyUSD * 100) / 100,
        totalMoneyBDT: Math.round(a.totalMoneyUSD * bdtRate),
        totalVolume: Math.round(a.totalVolume * 100) / 100,
      };
    });

    // Sort by total points descending
    list.sort((a, b) => b.totalPoints - a.totalPoints);
    return list;
  }, [sessions, bdtRate]);

  const filteredAssets = useMemo(() => {
    if (filterType === "PROFITABLE") return assetBreakdown.filter((a) => a.totalPoints > 0);
    if (filterType === "LOSS") return assetBreakdown.filter((a) => a.totalPoints < 0);
    return assetBreakdown;
  }, [assetBreakdown, filterType]);

  const bestAsset = assetBreakdown.length > 0 ? assetBreakdown[0] : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. TOP HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Asset Point Analytics & Leaderboard
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-200">
              Cross-Asset
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Compare points captured, win rate, and profit factor across BTC, Gold (XAU), Indices, and Forex.
          </p>
        </div>

        <button
          onClick={() => refetch && refetch()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs shadow-md transition-all active:scale-98 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {/* 2. TOP METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: BEST PERFORMING ASSET */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Top Point Generator
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {bestAsset ? bestAsset.symbol : "None"}
            </span>
            <span className="text-xs font-bold text-emerald-600 font-mono">
              {bestAsset && bestAsset.totalPoints >= 0 ? `+${bestAsset.totalPoints.toFixed(2)} pts` : "0 pts"}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono">
            {bestAsset ? `${bestAsset.trades} trades • ${bestAsset.winRate}% Win Rate` : "No trades logged"}
          </div>
        </div>

        {/* Card 2: UNIQUE ASSETS TRADED */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Assets Traded
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2 font-mono">
            <span className="text-2xl font-black text-slate-900">
              {assetBreakdown.length}
            </span>
            <span className="text-xs font-bold text-slate-400">Symbols</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono">
            Crypto, Gold, Indices & Forex
          </div>
        </div>

        {/* Card 3: TOTAL VOLUME EXECUTED */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Cumulative Volume
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2 font-mono">
            <span className="text-2xl font-black text-slate-900">
              {assetBreakdown.reduce((sum, a) => sum + a.totalVolume, 0).toFixed(2)}
            </span>
            <span className="text-xs font-bold text-slate-400">Lots</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono">
            Normalized across all scalp deals
          </div>
        </div>

        {/* Card 4: OVERALL AVERAGE WIN RATE */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Best Win Rate Asset
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          {(() => {
            const sortedByWinRate = [...assetBreakdown].sort((a, b) => b.winRate - a.winRate);
            const topWR = sortedByWinRate.length > 0 ? sortedByWinRate[0] : null;
            return (
              <>
                <div className="mt-3 flex items-baseline gap-2 font-mono">
                  <span className="text-2xl font-black text-slate-900">
                    {topWR ? `${topWR.winRate}%` : "0%"}
                  </span>
                  <span className="text-xs font-bold text-slate-500 truncate">
                    {topWR ? topWR.symbol : "—"}
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-slate-400 font-mono">
                  {topWR ? `${topWR.won} Won / ${topWR.lost} Lost` : "No trades"}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* 3. ASSET BREAKDOWN TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-indigo-600" />
              <span>Asset Performance Table</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Individual instrument breakdown for captured points, volume exposure, and profitability.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 p-1 rounded-xl">
            {["ALL", "PROFITABLE", "LOSS"].map((f) => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  filterType === f
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {f === "ALL" ? "All Assets" : f === "PROFITABLE" ? "Positive Points" : "Negative Points"}
              </button>
            ))}
          </div>
        </div>

        {loading && assetBreakdown.length === 0 ? (
          <div className="p-12 text-center text-slate-400">Loading asset metrics...</div>
        ) : filteredAssets.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Target className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-base font-bold text-slate-800">No Asset Data Found</p>
            <p className="text-xs text-slate-400">Execute positions during an active session to see cross-asset metrics.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Asset / Symbol</th>
                  <th className="py-3 px-3">Class</th>
                  <th className="py-3 px-3 text-right">Trades (W/L)</th>
                  <th className="py-3 px-3 text-right">Win Rate</th>
                  <th className="py-3 px-3 text-right">Volume</th>
                  <th className="py-3 px-3 text-right">Profit Factor</th>
                  <th className="py-3 px-4 text-right text-indigo-700 font-bold">
                    Captured Points
                  </th>
                  <th className="py-3 px-4 text-right">Money USD</th>
                  <th className="py-3 px-4 text-right">Money BDT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredAssets.map((a) => {
                  const isPtsWin = a.totalPoints >= 0;
                  const isMoneyWin = a.totalMoneyUSD >= 0;
                  return (
                    <tr key={a.symbol} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                        {a.symbol}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                          {a.assetClass}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-bold text-slate-800">{a.trades}</span>
                        <span className="text-[10px] text-slate-400 ml-1">
                          ({a.won}/{a.lost})
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-800">
                        {a.winRate.toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">
                        {a.totalVolume.toFixed(2)} lots
                      </td>
                      <td className="py-3 px-3 text-right font-bold">
                        <span className={a.profitFactor >= 1.5 ? "text-emerald-600" : (a.profitFactor >= 1.0 ? "text-slate-800" : "text-amber-600")}>
                          {a.profitFactor.toFixed(2)}
                        </span>
                      </td>
                      <td className={`py-3 px-4 text-right font-black whitespace-nowrap text-sm ${
                        isPtsWin ? "text-emerald-600" : "text-rose-600"
                      }`}>
                        {isPtsWin ? `+${a.totalPoints.toFixed(2)}` : a.totalPoints.toFixed(2)} pts
                      </td>
                      <td className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                        isMoneyWin ? "text-emerald-600" : "text-rose-600"
                      }`}>
                        {isMoneyWin ? `+$${a.totalMoneyUSD.toFixed(2)}` : `-$${Math.abs(a.totalMoneyUSD).toFixed(2)}`}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500 whitespace-nowrap">
                        ≈ {a.totalMoneyBDT >= 0 ? `৳${a.totalMoneyBDT.toLocaleString()}` : `-৳${Math.abs(a.totalMoneyBDT).toLocaleString()}`}
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
  );
}
