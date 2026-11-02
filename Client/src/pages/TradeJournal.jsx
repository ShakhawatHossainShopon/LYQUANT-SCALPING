import React, { useMemo, useState } from "react";
import {
  BookOpen,
  Search,
} from "lucide-react";
import usePolling from "@/hooks/usePolling";
import { API } from "@/api/endpoint";
import { NAVIGATION_CONFIG } from "@/config/navigationConfig";

export default function TradeJournal() {
  const { data: res } = usePolling(API.sessionHistory, 3000);
  const historyData = res?.data;
  const sessions = useMemo(() => historyData?.sessions_history || [], [historyData]);
  const bdtRate = NAVIGATION_CONFIG.usdToBdtRate || 124.09;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOutcome, setSelectedOutcome] = useState("ALL"); // ALL, WIN, LOSS

  // Flat list of all session trades enriched with session metadata
  const allTrades = useMemo(() => {
    const list = [];
    sessions.forEach((s) => {
      const sessName = s.session?.name || "Session";
      const sessId = s.session?.id;
      (s.trades || []).forEach((t) => {
        list.push({
          ...t,
          sessionName: sessName,
          sessionId: sessId,
          sessionRunFull: s.is_full_run,
        });
      });
    });
    // Sort descending by time
    list.sort((a, b) => (b.time > a.time ? 1 : -1));
    return list;
  }, [sessions]);

  const filteredTrades = useMemo(() => {
    return allTrades.filter((t) => {
      const matchesSearch =
        !searchQuery ||
        (t.symbol || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(t.ticket || "").includes(searchQuery) ||
        (t.sessionName || "").toLowerCase().includes(searchQuery.toLowerCase());

      const pts = Number(t.points || 0);
      const isWin = pts > 0 || Number(t.profit || 0) > 0;
      const isLoss = pts < 0 || Number(t.profit || 0) < 0;

      if (selectedOutcome === "WIN" && !isWin) return false;
      if (selectedOutcome === "LOSS" && !isLoss) return false;

      return matchesSearch;
    });
  }, [allTrades, searchQuery, selectedOutcome]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. TOP HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Scalp Trade Journal
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-200">
              Deal Audit
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Searchable trade-by-trade log with execution tickets, captured points, session tagging, and win/loss audits.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-400 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 self-start sm:self-auto">
          {filteredTrades.length} of {allTrades.length} Deals
        </div>
      </div>

      {/* 2. SEARCH & FILTER CONTROLS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ticket, symbol (BTC, XAU), or session..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        {/* Outcome Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
          {["ALL", "WIN", "LOSS"].map((opt) => (
            <button
              key={opt}
              onClick={() => setSelectedOutcome(opt)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedOutcome === opt
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {opt === "ALL" ? "All Deals" : opt === "WIN" ? "Winning (+pts)" : "Losing (-pts)"}
            </button>
          ))}
        </div>
      </div>

      {/* 3. TRADES TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {filteredTrades.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-base font-bold text-slate-800">No Journal Entries Found</p>
            <p className="text-xs text-slate-400">Try adjusting your search query or run a scalping session in the tracker.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-3">Ticket</th>
                  <th className="py-3 px-3">Session Tag</th>
                  <th className="py-3 px-3">Symbol</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3 text-right">Volume</th>
                  <th className="py-3 px-3 text-right">Price</th>
                  <th className="py-3 px-4 text-right text-indigo-700 font-bold">
                    Captured Points
                  </th>
                  <th className="py-3 px-4 text-right font-bold text-slate-700">
                    Money USD
                  </th>
                  <th className="py-3 px-4 text-right">BDT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredTrades.map((t, idx) => {
                  const pts = Number(t.points || 0);
                  const pnl = Number(t.profit || 0);
                  const isWin = pts >= 0;
                  const isMoneyWin = pnl >= 0;
                  const bdt = pnl * bdtRate;

                  return (
                    <tr key={t.ticket || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                        {t.time}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-700">
                        #{t.ticket}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {t.sessionName}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {t.symbol}
                      </td>
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
                      <td className="py-2.5 px-3 text-right text-slate-700">
                        {t.price}
                      </td>
                      <td className={`py-2.5 px-4 text-right font-black whitespace-nowrap ${
                        isWin ? "text-emerald-600" : "text-rose-600"
                      }`}>
                        {pts >= 0 ? `+${pts.toFixed(2)}` : pts.toFixed(2)} pts
                      </td>
                      <td className={`py-2.5 px-4 text-right font-bold whitespace-nowrap ${
                        isMoneyWin ? "text-emerald-600" : "text-rose-600"
                      }`}>
                        {isMoneyWin ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-500 whitespace-nowrap">
                        ≈ {bdt >= 0 ? `৳${Math.round(bdt).toLocaleString()}` : `-৳${Math.round(Math.abs(bdt)).toLocaleString()}`}
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
