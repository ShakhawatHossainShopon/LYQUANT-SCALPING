import MetaTrader5 as mt5


def _calc_volume_usd(symbol: str, lots: float, price: float) -> float:
    symbol_info = mt5.symbol_info(symbol)
    if not symbol_info:
        return 0.0

    contract_size = symbol_info.trade_contract_size or 100000.0
    units = lots * contract_size

    if symbol_info.currency_profit == "USD":
        return units * price
    elif symbol_info.currency_base == "USD":
        return units
    else:
        for base_pair in [f"{symbol_info.currency_base}USDc", f"{symbol_info.currency_base}USD"]:
            tick = mt5.symbol_info_tick(base_pair)
            if tick and tick.bid > 0:
                return units * tick.bid
        return units * price


def get_header_data():
    if not mt5.initialize():
        raise RuntimeError(f"MT5 initialization failed: {mt5.last_error()}")

    try:
        account = mt5.account_info()
        if account is None:
            raise RuntimeError(f"Account info unavailable: {mt5.last_error()}")

        account_dict = account._asdict()
        currency = account_dict.get("currency", "USD")
        is_cent = (currency == "USC") or ("cent" in account_dict.get("server", "").lower())
        account_dict["is_cent"] = is_cent
        account_dict["currency_digits"] = account_dict.get("currency_digits", 2)

        positions = mt5.positions_get()
        total_lots = 0.0
        total_volume_usd = 0.0

        if positions:
            for pos in positions:
                pos_dict = pos._asdict()
                symbol = pos_dict["symbol"]
                lots = float(pos_dict["volume"])
                price = float(pos_dict.get("price_current", pos_dict.get("price_open", 0.0)))
                volume_usd = _calc_volume_usd(symbol, lots, price)
                total_lots += lots
                total_volume_usd += volume_usd

        return {
            "account": account_dict,
            "summary": {
                "total_volume_usd": round(total_volume_usd, 2),
                "total_lots": round(total_lots, 2),
                "total_positions": len(positions) if positions else 0
            }
        }
    finally:
        mt5.shutdown()
