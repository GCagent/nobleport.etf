"""
OctaStackTrader — Configuration

Centralised, validated configuration for the OctaStack crypto trading bot.

Values are loaded from environment variables (optionally via a ``.env`` file
when ``python-dotenv`` is installed) and validated up-front so the bot fails
fast on misconfiguration rather than mid-trade.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _get_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _get_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    return default if raw is None or raw.strip() == "" else float(raw)


def _get_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    return default if raw is None or raw.strip() == "" else int(raw)


def _parse_take_profit_tiers(raw: str | None) -> list[tuple[float, float]]:
    """
    Parse a take-profit ladder of the form ``"0.05:0.5,0.10:1.0"``.

    Each entry is ``profit_pct:fraction`` where ``profit_pct`` is the gain
    above entry that triggers the tier and ``fraction`` is the portion of the
    *original* position size to sell at that level. The default ladder books
    half the position at +5% and the remainder at +10% — the classic
    "5% or 10% profit" exit.
    """
    if not raw or not raw.strip():
        return [(0.05, 0.5), (0.10, 1.0)]
    tiers: list[tuple[float, float]] = []
    for chunk in raw.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        pct_str, _, frac_str = chunk.partition(":")
        tiers.append((float(pct_str), float(frac_str) if frac_str else 1.0))
    return sorted(tiers, key=lambda t: t[0])


@dataclass(slots=True)
class TradingConfig:
    """Fully-resolved configuration for a single OctaStackTrader run."""

    # -- Exchange / mode --------------------------------------------------
    exchange: str = "binance"
    api_key: str | None = None
    api_secret: str | None = None
    testnet: bool = True
    dry_run: bool = True

    # -- Universe / data --------------------------------------------------
    symbols: list[str] = field(
        default_factory=lambda: ["BTC/USDT", "ETH/USDT"]
    )
    timeframe: str = "1h"
    quote_currency: str = "USDT"

    # -- Strategy ---------------------------------------------------------
    strategy: str = "ema"  # "ema" or "supertrend_adx"
    # EMA crossover
    fast_ema: int = 10
    slow_ema: int = 30
    rsi_period: int = 14
    rsi_overbought: float = 70.0
    rsi_oversold: float = 30.0
    # SuperTrend + ADX ("David's approach")
    supertrend_period: int = 10
    supertrend_multiplier: float = 3.0
    adx_period: int = 14
    adx_threshold: float = 25.0

    # -- Risk management --------------------------------------------------
    max_positions: int = 8
    risk_per_trade: float = 0.02
    stop_loss_pct: float = 0.05
    take_profit_tiers: list[tuple[float, float]] = field(
        default_factory=lambda: [(0.05, 0.5), (0.10, 1.0)]
    )
    order_size_min: float = 10.0

    # -- Runtime ----------------------------------------------------------
    poll_interval_sec: int = 60
    starting_paper_balance: float = 10_000.0
    log_file: str = "trading_log.csv"

    # ------------------------------------------------------------------ #
    @classmethod
    def from_env(cls) -> "TradingConfig":
        """Build a config from environment variables, loading ``.env`` if present."""
        try:  # optional dependency — not required for tests / paper logic
            from dotenv import load_dotenv

            load_dotenv()
        except Exception:  # pragma: no cover - dotenv is best-effort
            pass

        symbols_raw = os.getenv("SYMBOLS", "BTC/USDT,ETH/USDT")
        symbols = [s.strip() for s in symbols_raw.split(",") if s.strip()]

        cfg = cls(
            exchange=os.getenv("EXCHANGE", "binance"),
            api_key=os.getenv("API_KEY"),
            api_secret=os.getenv("API_SECRET"),
            testnet=_get_bool("TESTNET", True),
            dry_run=_get_bool("DRY_RUN", True),
            symbols=symbols,
            timeframe=os.getenv("TIMEFRAME", "1h"),
            quote_currency=os.getenv("QUOTE_CURRENCY", "USDT"),
            strategy=os.getenv("STRATEGY", "ema"),
            fast_ema=_get_int("FAST_EMA", 10),
            slow_ema=_get_int("SLOW_EMA", 30),
            rsi_period=_get_int("RSI_PERIOD", 14),
            rsi_overbought=_get_float("RSI_OVERBOUGHT", 70.0),
            rsi_oversold=_get_float("RSI_OVERSOLD", 30.0),
            supertrend_period=_get_int("SUPERTREND_PERIOD", 10),
            supertrend_multiplier=_get_float("SUPERTREND_MULTIPLIER", 3.0),
            adx_period=_get_int("ADX_PERIOD", 14),
            adx_threshold=_get_float("ADX_THRESHOLD", 25.0),
            max_positions=_get_int("MAX_POSITIONS", 8),
            risk_per_trade=_get_float("RISK_PER_TRADE", 0.02),
            stop_loss_pct=_get_float("STOP_LOSS_PCT", 0.05),
            take_profit_tiers=_parse_take_profit_tiers(
                os.getenv("TAKE_PROFIT_TIERS")
            ),
            order_size_min=_get_float("ORDER_SIZE_MIN", 10.0),
            poll_interval_sec=_get_int("POLL_INTERVAL_SEC", 60),
            starting_paper_balance=_get_float(
                "STARTING_PAPER_BALANCE", 10_000.0
            ),
            log_file=os.getenv("LOG_FILE", "trading_log.csv"),
        )
        cfg.validate()
        return cfg

    # ------------------------------------------------------------------ #
    def validate(self) -> None:
        """Raise ``ValueError`` if the configuration is internally inconsistent."""
        if self.fast_ema >= self.slow_ema:
            raise ValueError(
                f"fast_ema ({self.fast_ema}) must be < slow_ema ({self.slow_ema})"
            )
        if not 0 < self.risk_per_trade <= 1:
            raise ValueError("risk_per_trade must be in (0, 1]")
        if not 0 < self.stop_loss_pct < 1:
            raise ValueError("stop_loss_pct must be in (0, 1)")
        if self.max_positions < 1:
            raise ValueError("max_positions must be >= 1")
        if len(self.symbols) > self.max_positions:
            # Not fatal, but worth surfacing — you can't hold more symbols
            # than the stack allows simultaneously.
            pass
        if not self.take_profit_tiers:
            raise ValueError("at least one take-profit tier is required")
        for pct, frac in self.take_profit_tiers:
            if pct <= 0:
                raise ValueError("take-profit pct must be > 0")
            if not 0 < frac <= 1:
                raise ValueError("take-profit fraction must be in (0, 1]")
        if not self.dry_run and (not self.api_key or not self.api_secret):
            raise ValueError("live trading requires API_KEY and API_SECRET")
