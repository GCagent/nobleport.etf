"""
OctaStackTrader — a production-oriented crypto trading bot for NoblePort.

Manages up to 8 concurrent long positions (the "8 stack") using a 10/30 EMA
crossover strategy with an RSI filter, fixed-percentage risk sizing, a 5% stop
loss, and a 5%/10% take-profit ladder. Supports paper (dry-run) trading out of
the box and live trading via any ccxt-supported exchange.
"""

from .backtest import Backtester, BacktestResult
from .bot import OctaStackTrader
from .broker import (
    Broker,
    Candles,
    CCXTBroker,
    CCXTMarketData,
    MarketData,
    PaperBroker,
    Position,
)
from .config import TradingConfig
from .strategy import (
    EmaCrossoverStrategy,
    Signal,
    Strategy,
    SupertrendAdxStrategy,
    build_strategy,
)

__all__ = [
    "OctaStackTrader",
    "TradingConfig",
    "Strategy",
    "EmaCrossoverStrategy",
    "SupertrendAdxStrategy",
    "build_strategy",
    "Signal",
    "Backtester",
    "BacktestResult",
    "Broker",
    "MarketData",
    "Candles",
    "PaperBroker",
    "CCXTBroker",
    "CCXTMarketData",
    "Position",
]
