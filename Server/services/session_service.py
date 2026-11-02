import sqlite3
import os
import time
from datetime import datetime
import MetaTrader5 as mt5

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scalping_sessions.db")


def _get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = _get_connection()
    try:
        with conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    duration_hours REAL NOT NULL,
                    status TEXT DEFAULT 'READY',
                    started_at TEXT,
                    ended_at TEXT,
                    start_timestamp INTEGER DEFAULT 0,
                    end_timestamp INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    drawdown_points REAL DEFAULT 0.0,
                    drawdown_usd REAL DEFAULT 0.0
                );
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS session_runs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    duration_hours REAL NOT NULL,
                    status TEXT DEFAULT 'COMPLETED',
                    started_at TEXT NOT NULL,
                    ended_at TEXT,
                    start_timestamp INTEGER NOT NULL,
                    end_timestamp INTEGER DEFAULT 0,
                    drawdown_points REAL DEFAULT 0.0,
                    drawdown_usd REAL DEFAULT 0.0,
                    created_at TEXT NOT NULL
                );
            """)
            # Check and add columns if they don't exist yet
            cursor = conn.cursor()
            cursor.execute("PRAGMA table_info(sessions)")
            columns = [info[1] for info in cursor.fetchall()]
            if "drawdown_points" not in columns:
                conn.execute("ALTER TABLE sessions ADD COLUMN drawdown_points REAL DEFAULT 0.0")
            if "drawdown_usd" not in columns:
                conn.execute("ALTER TABLE sessions ADD COLUMN drawdown_usd REAL DEFAULT 0.0")
    finally:
        conn.close()


init_db()


def list_sessions():
    conn = _get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM sessions ORDER BY id DESC")
        rows = cur.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def create_session(data: dict):
    if not isinstance(data, dict):
        raise ValueError("Invalid session payload")

    name = str(data.get("name") or "").strip()
    if not name:
        raise ValueError("Session name is required")

    try:
        duration_hours = float(data.get("duration_hours", 2.0))
        if duration_hours <= 0:
            duration_hours = 2.0
    except (ValueError, TypeError):
        duration_hours = 2.0

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    conn = _get_connection()
    try:
        with conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO sessions (name, duration_hours, status, created_at)
                VALUES (?, ?, 'READY', ?)
            """, (name, duration_hours, now_str))
            new_id = cur.lastrowid

        return {
            "id": new_id,
            "name": name,
            "duration_hours": duration_hours,
            "status": "READY",
            "created_at": now_str
        }
    finally:
        conn.close()


def delete_session(session_id: int):
    conn = _get_connection()
    try:
        with conn:
            conn.execute("DELETE FROM sessions WHERE id = ?", (int(session_id),))
        return True
    finally:
        conn.close()


def activate_session(session_id: int, drawdown_points: float = 0.0, drawdown_usd: float = 0.0):
    now_epoch = int(time.time())
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    conn = _get_connection()
    try:
        with conn:
            # If there was another session running, end it and record its run first
            cur = conn.cursor()
            cur.execute("SELECT * FROM sessions WHERE status = 'ACTIVE'")
            previously_active = cur.fetchall()
            for prev in previously_active:
                p = dict(prev)
                st_ts = p.get("start_timestamp") or (now_epoch - 60)
                conn.execute("""
                    INSERT INTO session_runs (
                        session_id, name, duration_hours, status, started_at, ended_at,
                        start_timestamp, end_timestamp, drawdown_points, drawdown_usd, created_at
                    ) VALUES (?, ?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?, ?)
                """, (
                    p["id"], p["name"], p["duration_hours"],
                    p.get("started_at") or now_str, now_str,
                    st_ts, now_epoch,
                    p.get("drawdown_points", 0.0), p.get("drawdown_usd", 0.0),
                    now_str
                ))

            conn.execute("UPDATE sessions SET status = 'READY' WHERE status = 'ACTIVE'")
            conn.execute("""
                UPDATE sessions 
                SET status = 'ACTIVE', started_at = ?, start_timestamp = ?, ended_at = NULL, end_timestamp = 0,
                    drawdown_points = ?, drawdown_usd = ?
                WHERE id = ?
            """, (now_str, now_epoch, float(drawdown_points or 0.0), float(drawdown_usd or 0.0), int(session_id)))
        return True
    finally:
        conn.close()


def end_session(session_id: int):
    now_epoch = int(time.time())
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    conn = _get_connection()
    try:
        with conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM sessions WHERE id = ?", (int(session_id),))
            sess = cur.fetchone()
            if sess:
                s = dict(sess)
                st_ts = s.get("start_timestamp") or now_epoch
                # Save into permanent immutable session_runs archive
                conn.execute("""
                    INSERT INTO session_runs (
                        session_id, name, duration_hours, status, started_at, ended_at,
                        start_timestamp, end_timestamp, drawdown_points, drawdown_usd, created_at
                    ) VALUES (?, ?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?, ?)
                """, (
                    s["id"], s["name"], s["duration_hours"],
                    s.get("started_at") or now_str, now_str,
                    st_ts, now_epoch,
                    s.get("drawdown_points", 0.0), s.get("drawdown_usd", 0.0),
                    now_str
                ))

            conn.execute("""
                UPDATE sessions 
                SET status = 'COMPLETED', ended_at = ?, end_timestamp = ?
                WHERE id = ?
            """, (now_str, now_epoch, int(session_id)))
        return True
    finally:
        conn.close()


def calc_asset_points(symbol: str, price_diff: float, point: float, digits: int) -> float:
    """
    Standardized 2-decimal point calculation compatible across BTC, Gold, US30/Indices, and Forex:
    - BTCUSD / Crypto: Dollar price difference (e.g. $77,852.09 - $77,827.81 = 24.28 points)
    - XAUUSD / Gold: Dollar price difference formatted to 2 decimals (e.g. $2,745.50 - $2,742.00 = 3.50 points)
    - US30 / US Tech / Nasdaq: Index price difference (e.g. 43,500.50 - 43,455.00 = 45.50 points)
    - Forex (EURUSD, GBPUSD, USDJPY, etc.): Standard pips with 2-decimal precision (e.g. 12.50 pips)
    """
    sym = (symbol or "").upper()
    
    # 1. Crypto (BTCUSD, ETHUSD) -> Price movement in dollars
    if any(k in sym for k in ["BTC", "ETH", "SOL", "XRP"]):
        return round(price_diff, 2)

    # 2. Gold / Metals (XAUUSD, XAGUSD) -> Price movement in dollars
    elif any(k in sym for k in ["XAU", "GOLD", "XAG", "SILVER"]):
        return round(price_diff, 2)

    # 3. Indices (US30, USTEC, NAS100, SPX500, GER40) -> Index points movement
    elif any(k in sym for k in ["US30", "USTEC", "NAS", "SPX", "GER", "DOW", "HK50"]):
        return round(price_diff, 2)

    # 4. Forex currency pairs -> Standard pips (10 fractional points = 1 pip) formatted to 2 decimals
    else:
        divisor = point * 10.0 if digits in (3, 5) else (point if point > 0 else 0.0001)
        return round(price_diff / divisor, 2)


def get_tracker_data():
    conn = _get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM sessions WHERE status = 'ACTIVE' LIMIT 1")
        active_row = cur.fetchone()
        active_session = dict(active_row) if active_row else None

        cur.execute("SELECT * FROM sessions ORDER BY id DESC")
        all_sessions = [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()

    if not active_session:
        return {
            "active_session": None,
            "sessions": all_sessions,
            "trades": [],
            "stats": {
                "total_trades": 0,
                "won_trades": 0,
                "lost_trades": 0,
                "win_rate": 0.0,
                "total_captured_points": 0.0,
                "total_money_usd": 0.0,
                "duration_left_sec": 0,
                "elapsed_sec": 0,
                "is_expired": False
            }
        }

    start_ts = active_session.get("start_timestamp") or int(time.time())
    duration_sec = int(active_session["duration_hours"] * 3600)
    now_epoch = int(time.time())
    elapsed_sec = max(0, now_epoch - start_ts)
    duration_left_sec = max(0, duration_sec - elapsed_sec)
    is_expired = elapsed_sec >= duration_sec

    trades = []
    total_captured_points = 0.0
    total_money_usd = 0.0
    won_trades = 0
    lost_trades = 0

    if mt5.initialize():
        try:
            # 1. Closed deals in session window
            history_deals = mt5.history_deals_get(start_ts, now_epoch + 60)
            if history_deals:
                # Group by position_id to get exact open and exit prices
                deals_by_pos = {}
                for deal in history_deals:
                    d = deal._asdict()
                    pos_id = d.get("position_id")
                    if pos_id:
                        deals_by_pos.setdefault(pos_id, []).append(d)

                for pos_id, deal_list in deals_by_pos.items():
                    # Find out/exit deal
                    exit_deals = [d for d in deal_list if d.get("entry") in (1, 2) or d.get("profit") != 0.0]
                    entry_deals = [d for d in deal_list if d.get("entry") == 0]

                    for exit_d in exit_deals:
                        profit = float(exit_d.get("profit", 0.0))
                        symbol = exit_d.get("symbol", "")
                        exit_price = float(exit_d.get("price", 0.0))
                        deal_type = exit_d.get("type", 0) # 0 BUY, 1 SELL
                        volume = float(exit_d.get("volume", 0.0))

                        s_info = mt5.symbol_info(symbol)
                        point = s_info.point if s_info and s_info.point else 0.0001
                        digits = s_info.digits if s_info else 2

                        # If we have entry price
                        entry_price = float(entry_deals[0].get("price", 0.0)) if entry_deals else 0.0
                        
                        if entry_price > 0:
                            # In exit deal, type is opposite of position
                            diff = (exit_price - entry_price) if deal_type == 1 else (entry_price - exit_price)
                        else:
                            # Derive points from profit & volume
                            contract_size = s_info.trade_contract_size if s_info and s_info.trade_contract_size else 1.0
                            one_unit_val = volume * contract_size
                            diff = profit / one_unit_val if one_unit_val > 0 else 0.0

                        points = calc_asset_points(symbol, diff, point, digits)

                        total_captured_points += points
                        total_money_usd += profit
                        if profit > 0 or points > 0:
                            won_trades += 1
                        elif profit < 0 or points < 0:
                            lost_trades += 1

                        trades.append({
                            "ticket": exit_d.get("ticket"),
                            "order": exit_d.get("order"),
                            "time": datetime.fromtimestamp(exit_d.get("time")).strftime("%H:%M:%S"),
                            "symbol": symbol,
                            "type": "SELL" if deal_type == 1 else "BUY",
                            "volume": volume,
                            "price": round(exit_price, digits),
                            "points": round(points, 2),
                            "profit": round(profit, 2),
                            "is_closed": True
                        })

            # 2. Open positions running in this session
            positions = mt5.positions_get()
            if positions:
                for pos in positions:
                    p_dict = pos._asdict()
                    pos_time = p_dict.get("time", 0)
                    if pos_time >= start_ts:
                        symbol = p_dict.get("symbol", "")
                        s_info = mt5.symbol_info(symbol)
                        point = s_info.point if s_info and s_info.point else 0.0001
                        digits = s_info.digits if s_info else 2
                        
                        open_p = float(p_dict.get("price_open", 0.0))
                        curr_p = float(p_dict.get("price_current", 0.0))
                        p_type = p_dict.get("type", 0)
                        
                        diff = (curr_p - open_p) if p_type == mt5.POSITION_TYPE_BUY else (open_p - curr_p)
                        points = calc_asset_points(symbol, diff, point, digits)
                        profit = float(p_dict.get("profit", 0.0))

                        total_captured_points += points
                        total_money_usd += profit

                        trades.append({
                            "ticket": p_dict.get("ticket"),
                            "time": datetime.fromtimestamp(pos_time).strftime("%H:%M:%S"),
                            "symbol": symbol,
                            "type": "BUY" if p_type == mt5.POSITION_TYPE_BUY else "SELL",
                            "volume": float(p_dict.get("volume", 0.0)),
                            "price": round(curr_p, digits),
                            "points": round(points, 2),
                            "profit": round(profit, 2),
                            "is_closed": False
                        })
        finally:
            mt5.shutdown()

    total_count = won_trades + lost_trades
    win_rate = round((won_trades / total_count * 100), 1) if total_count > 0 else 0.0

    return {
        "active_session": active_session,
        "sessions": all_sessions,
        "trades": trades,
        "stats": {
            "total_trades": len(trades),
            "won_trades": won_trades,
            "lost_trades": lost_trades,
            "win_rate": win_rate,
            "total_captured_points": round(total_captured_points, 2),
            "total_money_usd": round(total_money_usd, 2),
            "duration_left_sec": duration_left_sec,
            "elapsed_sec": elapsed_sec,
            "is_expired": is_expired
        }
    }


def _extract_trades_for_window(start_ts: int, end_ts: int):
    """Extracts and computes 2-decimal point gains and money PnL for deals within a timestamp window."""
    trades = []
    total_captured_points = 0.0
    total_money_usd = 0.0
    gross_profit = 0.0
    gross_loss = 0.0
    won_trades = 0
    lost_trades = 0

    if not mt5.initialize():
        return trades, {
            "total_trades": 0,
            "won_trades": 0,
            "lost_trades": 0,
            "win_rate": 0.0,
            "total_captured_points": 0.0,
            "total_money_usd": 0.0,
            "gross_profit": 0.0,
            "gross_loss": 0.0,
            "profit_factor": 0.0,
        }

    try:
        deals = mt5.history_deals_get(start_ts, end_ts)
        if deals:
            deals_by_pos = {}
            for deal in deals:
                d = deal._asdict()
                pos_id = d.get("position_id")
                if pos_id:
                    deals_by_pos.setdefault(pos_id, []).append(d)

            for pos_id, deal_list in deals_by_pos.items():
                exit_deals = [d for d in deal_list if d.get("entry") in (1, 2) or d.get("profit") != 0.0]
                entry_deals = [d for d in deal_list if d.get("entry") == 0]

                for exit_d in exit_deals:
                    profit = float(exit_d.get("profit", 0.0))
                    symbol = exit_d.get("symbol", "")
                    exit_price = float(exit_d.get("price", 0.0))
                    deal_type = exit_d.get("type", 0)
                    volume = float(exit_d.get("volume", 0.0))

                    s_info = mt5.symbol_info(symbol)
                    point = s_info.point if s_info and s_info.point else 0.0001
                    digits = s_info.digits if s_info else 2

                    entry_price = float(entry_deals[0].get("price", 0.0)) if entry_deals else 0.0
                    if entry_price > 0:
                        diff = (exit_price - entry_price) if deal_type == 1 else (entry_price - exit_price)
                    else:
                        contract_size = s_info.trade_contract_size if s_info and s_info.trade_contract_size else 1.0
                        one_unit_val = volume * contract_size
                        diff = profit / one_unit_val if one_unit_val > 0 else 0.0

                    points = calc_asset_points(symbol, diff, point, digits)
                    total_captured_points += points
                    total_money_usd += profit

                    if profit > 0:
                        gross_profit += profit
                        won_trades += 1
                    elif profit < 0:
                        gross_loss += abs(profit)
                        lost_trades += 1
                    else:
                        if points > 0:
                            won_trades += 1
                        elif points < 0:
                            lost_trades += 1

                    trades.append({
                        "ticket": exit_d.get("ticket"),
                        "order": exit_d.get("order"),
                        "time": datetime.fromtimestamp(exit_d.get("time")).strftime("%Y-%m-%d %H:%M:%S"),
                        "symbol": symbol,
                        "type": "SELL" if deal_type == 1 else "BUY",
                        "volume": volume,
                        "price": round(exit_price, digits),
                        "points": round(points, 2),
                        "profit": round(profit, 2),
                        "is_closed": True
                    })
    finally:
        mt5.shutdown()

    total_count = won_trades + lost_trades
    win_rate = round((won_trades / total_count * 100), 1) if total_count > 0 else 0.0
    profit_factor = round((gross_profit / gross_loss), 2) if gross_loss > 0 else (round(gross_profit, 2) if gross_profit > 0 else 0.0)

    return trades, {
        "total_trades": len(trades),
        "won_trades": won_trades,
        "lost_trades": lost_trades,
        "win_rate": win_rate,
        "total_captured_points": round(total_captured_points, 2),
        "total_money_usd": round(total_money_usd, 2),
        "gross_profit": round(gross_profit, 2),
        "gross_loss": round(gross_loss, 2),
        "profit_factor": profit_factor,
    }


def get_sessions_history():
    """Returns all session run histories with run times, completion status, metrics, and outside-session trades."""
    conn = _get_connection()
    try:
        cur = conn.cursor()
        # Fetch recorded historical completed runs
        cur.execute("SELECT * FROM session_runs ORDER BY id DESC")
        recorded_runs = [dict(r) for r in cur.fetchall()]

        # Also fetch any currently active session from sessions table
        cur.execute("SELECT * FROM sessions WHERE status = 'ACTIVE' ORDER BY id DESC")
        active_sessions = [dict(r) for r in cur.fetchall()]

        # Also get all configured sessions to include in intervals
        cur.execute("SELECT * FROM sessions ORDER BY id DESC")
        all_configured = [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()

    session_intervals = []
    earliest_session_start = None
    latest_session_end = 0

    history_list = []

    # 1. Process active running session (if any) first so it shows up at the top
    for s in active_sessions:
        start_ts = s.get("start_timestamp") or 0
        target_duration_sec = int(s["duration_hours"] * 3600)
        if start_ts > 0:
            now_ts = int(time.time())
            run_seconds = max(0, now_ts - start_ts)
            is_full_run = run_seconds >= target_duration_sec
            actual_end_ts = now_ts

            if earliest_session_start is None or start_ts < earliest_session_start:
                earliest_session_start = start_ts
            if actual_end_ts > latest_session_end:
                latest_session_end = actual_end_ts

            session_intervals.append((start_ts, actual_end_ts, s["id"]))
            s_trades, s_stats = _extract_trades_for_window(start_ts, actual_end_ts)

            history_list.append({
                "run_id": f"active-{s['id']}",
                "session": s,
                "has_run": True,
                "is_full_run": is_full_run,
                "target_hours": s["duration_hours"],
                "run_seconds": run_seconds,
                "run_hours": round(run_seconds / 3600, 2),
                "run_mins": round(run_seconds / 60, 1),
                "started_at": s.get("started_at"),
                "ended_at": "LIVE NOW",
                "stats": s_stats,
                "trades": s_trades
            })

    # 2. Process all historical runs from session_runs
    for r in recorded_runs:
        start_ts = r.get("start_timestamp") or 0
        end_ts = r.get("end_timestamp") or 0
        target_duration_sec = int(r["duration_hours"] * 3600)

        if start_ts > 0:
            actual_end_ts = end_ts if end_ts > 0 else (start_ts + target_duration_sec)
            run_seconds = max(0, actual_end_ts - start_ts)
            is_full_run = run_seconds >= target_duration_sec

            if earliest_session_start is None or start_ts < earliest_session_start:
                earliest_session_start = start_ts
            if actual_end_ts > latest_session_end:
                latest_session_end = actual_end_ts

            session_intervals.append((start_ts, actual_end_ts, r["session_id"]))
            s_trades, s_stats = _extract_trades_for_window(start_ts, actual_end_ts)

            history_list.append({
                "run_id": r["id"],
                "session": {
                    "id": r["session_id"],
                    "name": r["name"],
                    "duration_hours": r["duration_hours"],
                    "status": "COMPLETED",
                    "drawdown_usd": r.get("drawdown_usd", 0.0),
                },
                "has_run": True,
                "is_full_run": is_full_run,
                "target_hours": r["duration_hours"],
                "run_seconds": run_seconds,
                "run_hours": round(run_seconds / 3600, 2),
                "run_mins": round(run_seconds / 60, 1),
                "started_at": r.get("started_at"),
                "ended_at": r.get("ended_at") or "Ended",
                "stats": s_stats,
                "trades": s_trades
            })

    # 3. If there are no runs at all yet, show any configured sessions as READY
    if len(history_list) == 0:
        for s in all_configured:
            history_list.append({
                "run_id": f"cfg-{s['id']}",
                "session": s,
                "has_run": False,
                "is_full_run": False,
                "target_hours": s["duration_hours"],
                "run_seconds": 0,
                "run_hours": 0.0,
                "run_mins": 0.0,
                "started_at": None,
                "ended_at": None,
                "stats": {
                    "total_trades": 0,
                    "won_trades": 0,
                    "lost_trades": 0,
                    "win_rate": 0.0,
                    "total_captured_points": 0.0,
                    "total_money_usd": 0.0,
                    "gross_profit": 0.0,
                    "gross_loss": 0.0,
                    "profit_factor": 0.0,
                },
                "trades": []
            })

    # Find trades taken OUTSIDE sessions (ignored section)
    outside_trades = []
    outside_points = 0.0
    outside_money = 0.0

    if earliest_session_start is not None and mt5.initialize():
        try:
            now_epoch = int(time.time())
            deals = mt5.history_deals_get(earliest_session_start, now_epoch)
            if deals:
                deals_by_pos = {}
                for deal in deals:
                    d = deal._asdict()
                    pos_id = d.get("position_id")
                    if pos_id:
                        deals_by_pos.setdefault(pos_id, []).append(d)

                for pos_id, deal_list in deals_by_pos.items():
                    exit_deals = [d for d in deal_list if d.get("entry") in (1, 2) or d.get("profit") != 0.0]
                    entry_deals = [d for d in deal_list if d.get("entry") == 0]

                    for exit_d in exit_deals:
                        deal_time = exit_d.get("time", 0)
                        # Check if deal_time falls inside ANY session window
                        inside_any = any(st <= deal_time <= et for st, et, _ in session_intervals)
                        if not inside_any:
                            profit = float(exit_d.get("profit", 0.0))
                            symbol = exit_d.get("symbol", "")
                            exit_price = float(exit_d.get("price", 0.0))
                            deal_type = exit_d.get("type", 0)
                            volume = float(exit_d.get("volume", 0.0))

                            s_info = mt5.symbol_info(symbol)
                            point = s_info.point if s_info and s_info.point else 0.0001
                            digits = s_info.digits if s_info else 2

                            entry_price = float(entry_deals[0].get("price", 0.0)) if entry_deals else 0.0
                            if entry_price > 0:
                                diff = (exit_price - entry_price) if deal_type == 1 else (entry_price - exit_price)
                            else:
                                contract_size = s_info.trade_contract_size if s_info and s_info.trade_contract_size else 1.0
                                one_unit_val = volume * contract_size
                                diff = profit / one_unit_val if one_unit_val > 0 else 0.0

                            points = calc_asset_points(symbol, diff, point, digits)
                            outside_points += points
                            outside_money += profit

                            outside_trades.append({
                                "ticket": exit_d.get("ticket"),
                                "time": datetime.fromtimestamp(deal_time).strftime("%Y-%m-%d %H:%M:%S"),
                                "symbol": symbol,
                                "type": "SELL" if deal_type == 1 else "BUY",
                                "volume": volume,
                                "price": round(exit_price, digits),
                                "points": round(points, 2),
                                "profit": round(profit, 2)
                            })
        finally:
            mt5.shutdown()

    return {
        "sessions_history": history_list,
        "outside_sessions": {
            "total_trades": len(outside_trades),
            "total_points": round(outside_points, 2),
            "total_money_usd": round(outside_money, 2),
            "trades": outside_trades
        }
    }
