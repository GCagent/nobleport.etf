"""
OctaStackTrader — Historical Data I/O

Load/save OHLCV :class:`~backend.trading.broker.Candles` from CSV/JSON so the
backtester and optimizer can run offline on saved history, plus a thin ccxt
downloader to fetch fresh candles from an exchange (Bybit, Binance, …).

CSV format (header required): ``timestamp,open,high,low,close,volume``.
"""

from __future__ import annotations

import csv
import json
import os

from .broker import Candles

_COLUMNS = ["timestamp", "open", "high", "low", "close", "volume"]


def load_candles_csv(path: str) -> Candles:
    """Load a single symbol's candles from a CSV file."""
    c = Candles()
    with open(path, newline="") as fh:
        reader = csv.DictReader(fh)
        missing = [col for col in _COLUMNS if col not in (reader.fieldnames or [])]
        if missing:
            raise ValueError(f"{path} missing columns: {missing}")
        for row in reader:
            c.timestamp.append(int(float(row["timestamp"])))
            c.open.append(float(row["open"]))
            c.high.append(float(row["high"]))
            c.low.append(float(row["low"]))
            c.close.append(float(row["close"]))
            c.volume.append(float(row["volume"]))
    return c


def save_candles_csv(path: str, candles: Candles) -> None:
    """Write a symbol's candles to CSV."""
    with open(path, "w", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(_COLUMNS)
        for i in range(len(candles)):
            writer.writerow([
                candles.timestamp[i], candles.open[i], candles.high[i],
                candles.low[i], candles.close[i], candles.volume[i],
            ])


def load_candles_json(path: str) -> Candles:
    """Load candles from JSON: a list of ``[ts, o, h, l, c, v]`` rows."""
    with open(path) as fh:
        rows = json.load(fh)
    return Candles.from_ccxt(rows)


def load_dataset(paths: dict[str, str]) -> dict[str, "Candles"]:
    """
    Load ``{symbol: Candles}`` from a mapping of ``{symbol: file_path}``.

    File type is inferred from the extension (``.json`` vs anything else → CSV).
    """
    out: dict[str, Candles] = {}
    for symbol, path in paths.items():
        if path.lower().endswith(".json"):
            out[symbol] = load_candles_json(path)
        else:
            out[symbol] = load_candles_csv(path)
    return out


def download_history(  # pragma: no cover - requires network + ccxt
    *,
    exchange: str,
    symbol: str,
    timeframe: str = "4h",
    limit: int = 1000,
    out_path: str | None = None,
    testnet: bool = False,
) -> Candles:
    """
    Download OHLCV from a ccxt exchange and optionally persist it to CSV.

    Read-only — needs no API keys for public market data.
    """
    import ccxt  # lazy

    client = getattr(ccxt, exchange)({"enableRateLimit": True})
    if testnet and hasattr(client, "set_sandbox_mode"):
        client.set_sandbox_mode(True)
    rows = client.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
    candles = Candles.from_ccxt(rows)
    if out_path:
        os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
        save_candles_csv(out_path, candles)
    return candles
