"""
OctaStackTrader — unit tests.

These run with zero third-party dependencies (no ccxt / pandas), using a stub
market-data feed and the in-memory paper broker.
"""

from __future__ import annotations

import math

from backend.trading.backtest import Backtester
from backend.trading.bot import OctaStackTrader
from backend.trading.broker import Candles, MarketData, PaperBroker
from backend.trading.config import TradingConfig
from backend.trading.indicators import adx, atr, ema, rsi, supertrend
from backend.trading.risk import position_size, stop_loss_price, take_profit_price
from backend.trading.strategy import (
    EmaCrossoverStrategy,
    Signal,
    SupertrendAdxStrategy,
)


# --------------------------------------------------------------------------- #
# Helpers / stubs
# --------------------------------------------------------------------------- #
def _candles(closes: list[float]) -> Candles:
    """Candles where O/H/L/C all track close (fine for close-only strategies)."""
    closes = [float(c) for c in closes]
    return Candles(
        timestamp=list(range(len(closes))),
        open=list(closes),
        high=list(closes),
        low=list(closes),
        close=list(closes),
        volume=[0.0] * len(closes),
    )


class StubMarketData(MarketData):
    def __init__(self, closes: list[float], price: float | None = None) -> None:
        self.candles = _candles(closes)
        self.price = price if price is not None else float(closes[-1])

    def fetch_ohlcv(self, symbol, timeframe, limit):
        return self.candles

    def fetch_price(self, symbol):
        return self.price


class StubStrategy:
    """Always emits a fixed signal — decouples engine tests from indicators."""

    def __init__(self, signal: Signal) -> None:
        self.signal = signal
        self.min_candles = 1

    def generate(self, closes):
        return self.signal


def _cfg(**overrides) -> TradingConfig:
    base = dict(
        symbols=["BTC/USDT"],
        max_positions=8,
        risk_per_trade=0.02,
        stop_loss_pct=0.05,
        take_profit_tiers=[(0.05, 0.5), (0.10, 1.0)],
        order_size_min=10.0,
        starting_paper_balance=1_000_000.0,
        log_file="",  # disable CSV writes in tests
    )
    base.update(overrides)
    cfg = TradingConfig(**base)
    cfg.validate()
    return cfg


def _engine(cfg, market, strategy=None) -> OctaStackTrader:
    broker = PaperBroker(
        quote_currency=cfg.quote_currency,
        starting_balance=cfg.starting_paper_balance,
    )
    return OctaStackTrader(cfg, market, broker, strategy=strategy)


# --------------------------------------------------------------------------- #
# Indicators
# --------------------------------------------------------------------------- #
def test_ema_constant_series_is_constant():
    out = ema([100.0] * 20, period=5)
    assert out[:4] == [None, None, None, None]
    assert all(abs(v - 100.0) < 1e-9 for v in out[4:])


def test_rsi_monotonic_increasing_is_100():
    out = rsi([float(i) for i in range(1, 30)], period=14)
    assert out[14] is not None
    assert abs(out[-1] - 100.0) < 1e-9


def test_rsi_within_bounds():
    series = [10, 11, 10.5, 12, 11.5, 13, 12, 14, 13, 15, 14, 16, 15, 17, 16, 18]
    for v in rsi([float(x) for x in series], period=5):
        if v is not None:
            assert 0.0 <= v <= 100.0


# --------------------------------------------------------------------------- #
# Strategy
# --------------------------------------------------------------------------- #
def test_strategy_buy_on_bullish_crossover():
    strat = EmaCrossoverStrategy(
        fast_ema=3, slow_ema=5, rsi_period=3,
        rsi_overbought=200.0, rsi_oversold=-1.0,
    )
    # Decline then a sharp rebound forces the fast EMA above the slow EMA
    # exactly on the final bar.
    closes = [10, 9, 8, 7, 6, 5, 6, 8, 11]
    assert strat.generate(_candles(closes)) is Signal.BUY


def test_strategy_sell_on_bearish_crossover():
    strat = EmaCrossoverStrategy(
        fast_ema=3, slow_ema=5, rsi_period=3,
        rsi_overbought=200.0, rsi_oversold=-1.0,
    )
    closes = [5, 6, 7, 8, 9, 10, 9, 7, 4]
    assert strat.generate(_candles(closes)) is Signal.SELL


def test_strategy_holds_without_enough_data():
    strat = EmaCrossoverStrategy(fast_ema=10, slow_ema=30)
    assert strat.generate(_candles([1.0, 2.0, 3.0])) is Signal.HOLD


# --------------------------------------------------------------------------- #
# Risk
# --------------------------------------------------------------------------- #
def test_position_size_matches_risk_math():
    qty = position_size(
        price=100.0, balance=10_000.0, risk_per_trade=0.02,
        stop_loss_pct=0.05, order_size_min=10.0,
    )
    # risk 200 / stop distance 5 = 40 units
    assert abs(qty - 40.0) < 1e-9


def test_position_size_respects_min_notional():
    qty = position_size(
        price=100.0, balance=10.0, risk_per_trade=0.02,
        stop_loss_pct=0.05, order_size_min=10.0,
    )
    assert qty * 100.0 >= 10.0 - 1e-9


def test_stop_and_take_profit_prices():
    assert math.isclose(stop_loss_price(100.0, 0.05), 95.0)
    assert math.isclose(take_profit_price(100.0, 0.10), 110.0)


# --------------------------------------------------------------------------- #
# Paper broker
# --------------------------------------------------------------------------- #
def test_paper_broker_buy_then_sell_updates_balances():
    pb = PaperBroker(quote_currency="USDT", starting_balance=1_000.0)
    assert pb.market_buy("BTC/USDT", 2.0, 100.0)  # spend 200
    assert math.isclose(pb.free_balance("USDT"), 800.0)
    assert math.isclose(pb.free_balance("BTC"), 2.0)
    assert pb.market_sell("BTC/USDT", 2.0, 150.0)  # gain 300
    assert math.isclose(pb.free_balance("USDT"), 1_100.0)
    assert math.isclose(pb.free_balance("BTC"), 0.0)


def test_paper_broker_rejects_overspend():
    pb = PaperBroker(quote_currency="USDT", starting_balance=50.0)
    assert pb.market_buy("BTC/USDT", 1.0, 100.0) is False


# --------------------------------------------------------------------------- #
# Engine
# --------------------------------------------------------------------------- #
def test_engine_enforces_eight_position_stack():
    symbols = [f"C{i}/USDT" for i in range(12)]
    cfg = _cfg(symbols=symbols, max_positions=8)
    market = StubMarketData(closes=[100.0] * 5, price=100.0)
    eng = _engine(cfg, market, strategy=StubStrategy(Signal.BUY))
    eng.step()
    assert len(eng.positions) == 8


def test_engine_take_profit_ladder():
    cfg = _cfg()
    market = StubMarketData(closes=[100.0] * 5, price=100.0)
    eng = _engine(cfg, market, strategy=StubStrategy(Signal.HOLD))
    assert eng.open_position("BTC/USDT", 100.0)
    pos = eng.positions["BTC/USDT"]
    initial = pos.initial_quantity

    # +6% → first tier (+5%) books half.
    market.price = 106.0
    eng.check_exits()
    assert "BTC/USDT" in eng.positions
    assert math.isclose(eng.positions["BTC/USDT"].quantity, initial * 0.5)

    # +11% → second tier (+10%) books the rest and closes the position.
    market.price = 111.0
    eng.check_exits()
    assert "BTC/USDT" not in eng.positions


def test_engine_stop_loss_exit():
    cfg = _cfg()
    market = StubMarketData(closes=[100.0] * 5, price=100.0)
    eng = _engine(cfg, market, strategy=StubStrategy(Signal.HOLD))
    eng.open_position("BTC/USDT", 100.0)
    market.price = 94.0  # below the 95.0 stop
    eng.check_exits()
    assert "BTC/USDT" not in eng.positions


def test_engine_sell_signal_closes_position():
    cfg = _cfg()
    market = StubMarketData(closes=[100.0] * 5, price=100.0)
    eng = _engine(cfg, market, strategy=StubStrategy(Signal.BUY))
    eng.step()
    assert "BTC/USDT" in eng.positions
    eng.strategy = StubStrategy(Signal.SELL)
    eng.step()
    assert "BTC/USDT" not in eng.positions


def test_config_validation_rejects_bad_emas():
    try:
        _cfg(fast_ema=30, slow_ema=10)
    except ValueError:
        return
    raise AssertionError("expected ValueError for fast_ema >= slow_ema")


# --------------------------------------------------------------------------- #
# SuperTrend / ADX indicators + strategy
# --------------------------------------------------------------------------- #
def _ohlc_trend(closes, spread=1.0):
    closes = [float(c) for c in closes]
    return Candles(
        timestamp=list(range(len(closes))),
        open=list(closes),
        high=[c + spread for c in closes],
        low=[c - spread for c in closes],
        close=list(closes),
        volume=[0.0] * len(closes),
    )


def test_atr_is_non_negative():
    c = _ohlc_trend([float(i) for i in range(1, 40)])
    for v in atr(c.high, c.low, c.close, 14):
        if v is not None:
            assert v >= 0.0


def test_supertrend_follows_direction():
    up = _ohlc_trend([100 + i for i in range(40)])
    st_up = supertrend(up.high, up.low, up.close, 10, 3.0)
    assert st_up[-1] == 1  # sustained uptrend → bullish

    down = _ohlc_trend([140 - i for i in range(40)])
    st_down = supertrend(down.high, down.low, down.close, 10, 3.0)
    assert st_down[-1] == -1


def test_adx_high_in_strong_trend():
    c = _ohlc_trend([100 + i for i in range(60)])
    vals = [v for v in adx(c.high, c.low, c.close, 14) if v is not None]
    assert vals, "expected some ADX values"
    assert max(vals) > 25.0  # a clean linear trend is "strong"


def test_supertrend_adx_strategy_buys_on_flip():
    # Down-trend then a sustained up-trend produces a bullish flip with strong ADX.
    closes = [140 - i for i in range(30)] + [110 + 2 * i for i in range(30)]
    strat = SupertrendAdxStrategy(
        supertrend_period=10, supertrend_multiplier=3.0,
        adx_period=14, adx_threshold=20.0,
    )
    signals = []
    c = _ohlc_trend(closes)
    for end in range(strat.min_candles, len(closes) + 1):
        window = Candles(
            timestamp=c.timestamp[:end], open=c.open[:end], high=c.high[:end],
            low=c.low[:end], close=c.close[:end], volume=c.volume[:end],
        )
        signals.append(strat.generate(window))
    assert Signal.BUY in signals


# --------------------------------------------------------------------------- #
# Backtester
# --------------------------------------------------------------------------- #
def test_backtester_runs_and_scores():
    # Oscillating series so EMA crossovers fire repeatedly.
    closes = []
    for cycle in range(6):
        closes += [100 - i for i in range(15)] + [85 + i for i in range(15)]
    cfg = _cfg(
        symbols=["BTC/USDT"], fast_ema=5, slow_ema=12, rsi_period=5,
        rsi_overbought=95.0, rsi_oversold=5.0, starting_paper_balance=10_000.0,
    )
    data = {"BTC/USDT": _candles(closes)}
    result = Backtester(cfg, data).run()
    assert result.initial_equity == 10_000.0
    assert len(result.equity_curve) > 0
    assert result.num_trades >= 1
    assert 0.0 <= result.win_rate <= 1.0
    assert result.max_drawdown_pct >= 0.0
    assert isinstance(result.summary(), str)


def test_backtester_restores_log_level():
    import logging
    pkg = logging.getLogger("backend.trading")
    pkg.setLevel(logging.INFO)
    cfg = _cfg(symbols=["BTC/USDT"], fast_ema=5, slow_ema=12,
               rsi_overbought=95.0, rsi_oversold=5.0)
    Backtester(cfg, {"BTC/USDT": _candles(_osc_closes())}).run()
    assert pkg.level == logging.INFO  # restored after the quiet block


# --------------------------------------------------------------------------- #
# Data I/O
# --------------------------------------------------------------------------- #
def _osc_closes(cycles=6):
    closes = []
    for _ in range(cycles):
        closes += [100 - i for i in range(15)] + [85 + i for i in range(15)]
    return closes


def test_csv_round_trip(tmp_path=None):
    import tempfile, os
    from backend.trading.data import load_candles_csv, save_candles_csv

    candles = _candles([1, 2, 3, 4, 5])
    d = tempfile.mkdtemp()
    path = os.path.join(d, "c.csv")
    save_candles_csv(path, candles)
    loaded = load_candles_csv(path)
    assert loaded.close == candles.close
    assert loaded.high == candles.high
    assert len(loaded) == 5


def test_csv_missing_columns_raises():
    import tempfile, os
    from backend.trading.data import load_candles_csv

    d = tempfile.mkdtemp()
    path = os.path.join(d, "bad.csv")
    with open(path, "w") as fh:
        fh.write("timestamp,close\n1,100\n")
    try:
        load_candles_csv(path)
    except ValueError:
        return
    raise AssertionError("expected ValueError for missing columns")


# --------------------------------------------------------------------------- #
# Optimizer
# --------------------------------------------------------------------------- #
def test_grid_search_ranks_results():
    from backend.trading.optimize import grid_search

    cfg = _cfg(
        symbols=["BTC/USDT"], strategy="ema",
        rsi_overbought=95.0, rsi_oversold=5.0, starting_paper_balance=10_000.0,
    )
    data = {"BTC/USDT": _candles(_osc_closes())}
    ranked = grid_search(
        cfg, data,
        {"fast_ema": [3, 5], "slow_ema": [10, 15]},
        sort_key="sharpe", min_trades=1,
    )
    assert ranked, "expected at least one valid combination"
    # Sorted descending by sharpe.
    sharpes = [o.result.sharpe for o in ranked]
    assert sharpes == sorted(sharpes, reverse=True)
    assert "fast_ema" in ranked[0].params
    assert isinstance(ranked[0].as_dict(), dict)


def test_grid_search_skips_invalid_combos():
    from backend.trading.optimize import grid_search

    cfg = _cfg(symbols=["BTC/USDT"], strategy="ema",
               rsi_overbought=95.0, rsi_oversold=5.0)
    data = {"BTC/USDT": _candles(_osc_closes())}
    # fast >= slow is invalid and must be skipped, not raise.
    ranked = grid_search(
        cfg, data, {"fast_ema": [5, 20], "slow_ema": [10]},
        sort_key="total_return_pct", min_trades=0,
    )
    for o in ranked:
        assert o.params["fast_ema"] < o.params["slow_ema"]


def test_grid_search_rejects_bad_sort_key():
    from backend.trading.optimize import grid_search

    cfg = _cfg(symbols=["BTC/USDT"])
    data = {"BTC/USDT": _candles(_osc_closes())}
    try:
        grid_search(cfg, data, {"fast_ema": [3]}, sort_key="nope")
    except ValueError:
        return
    raise AssertionError("expected ValueError for bad sort_key")


# --------------------------------------------------------------------------- #
# MCP tool functions (logic only — no mcp package / network needed)
# --------------------------------------------------------------------------- #
def test_mcp_run_backtest_and_optimize(tmp_path=None):
    import tempfile, os
    from backend.trading.data import save_candles_csv
    from backend.trading.mcp_server import optimize as mcp_optimize
    from backend.trading.mcp_server import run_backtest as mcp_run_backtest

    d = tempfile.mkdtemp()
    path = os.path.join(d, "btc.csv")
    save_candles_csv(path, _candles(_osc_closes()))
    data_paths = {"BTC/USDT": path}

    bt = mcp_run_backtest(
        data_paths, strategy="ema", timeframe="4h",
        params={"fast_ema": 5, "slow_ema": 12,
                "rsi_overbought": 95.0, "rsi_oversold": 5.0},
    )
    assert "total_return_pct" in bt and "sharpe" in bt
    assert bt["num_trades"] >= 0

    ranked = mcp_optimize(
        data_paths, {"fast_ema": [3, 5], "slow_ema": [10, 15]},
        strategy="ema", sort_key="sharpe", top_n=3,
    )
    assert isinstance(ranked, list) and len(ranked) <= 3
