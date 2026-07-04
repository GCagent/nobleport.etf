# OctaStackTrader

A production-oriented crypto trading bot for NoblePort. It manages up to **8
concurrent long positions** (the "8 stack") across a configurable set of pairs,
with two pluggable strategies, fixed-percentage **risk-based position sizing**, a
**5% stop-loss**, and a **5% / 10% take-profit ladder**.

It runs **paper (dry-run)** trading out of the box and **live** trading via any
[ccxt](https://github.com/ccxt/ccxt)-supported exchange (**Bybit**, Binance,
Kucoin, Coinbase, …), and ships with a **backtester** that replays history
through the real engine.

## Features

- **8-position limit** — never holds more than `MAX_POSITIONS` trades at once.
- **Multi-symbol** — configure any number of pairs (up to the stack limit held
  simultaneously).
- **Two strategies** (`STRATEGY=`):
  - `ema` — 10/30 EMA crossover + RSI overbought/oversold filter.
  - `supertrend_adx` — SuperTrend direction gated by ADX trend strength
    ("David's approach"; great on 4h BTC/ETH/SOL).
- **Risk management** — fixed % risk per trade, 5% stop-loss, tiered take-profit
  (book half at +5%, the rest at +10% by default), minimum order notional.
- **Backtesting** — score any strategy/parameter set on historical candles
  (return, win rate, profit factor, max drawdown, Sharpe) using the *same*
  engine that trades live.
- **Dry-run mode** — simulate trades against *live* prices with a virtual
  balance.
- **CSV trade logging** — every fill is recorded to `trading_log.csv`.
- **Dependency-light core** — indicators, strategies, risk, paper broker and
  backtester are pure Python (no pandas/numpy); `ccxt` is only imported for live
  trading.

## Architecture

```
config.py      TradingConfig — env-driven, validated configuration
indicators.py  ema, rsi, atr, supertrend, adx — pure-Python indicators
strategy.py    EmaCrossover + SupertrendAdx strategies, build_strategy()
risk.py        position sizing + stop-loss / take-profit price math
broker.py      Candles, Position, MarketData + Broker interfaces,
               PaperBroker (sim) and CCXT{MarketData,Broker} (live)
bot.py         OctaStackTrader — the engine (step() / run())
backtest.py    Backtester — replays history through the real engine
optimize.py    grid_search — score/rank parameter sets (the loop's core)
data.py        load/save Candles (CSV/JSON) + ccxt history downloader
mcp_server.py  MCP server exposing run_backtest / optimize / download_ohlcv
strategy.pine  TradingView Pine Script mirror of the SuperTrend+ADX logic
__main__.py    CLI wiring (ccxt feed → paper/live broker → engine)
```

This realises the full "David's approach" pipeline:

```
Claude ──▶ mcp_server.py ──▶ optimize.py ──▶ backtest.py ──▶ bot.py (engine)
   ▲                                                              │
   └──────────────── metrics (Sharpe, win rate, …) ◀─────────────┘
              tuned params → .env → live execution on Bybit
```

Market **data** (read-only prices) is deliberately separated from order
**execution**, so paper trading reacts to real live prices while routing fills
to the simulated broker.

## Install

```bash
cd backend/trading
pip install -r requirements.txt   # ccxt + python-dotenv (live only)
cp .env.example .env              # then edit .env
```

The core can be imported and tested without installing anything.

## Configure

Edit `.env` (see `.env.example` for all options). Key settings:

| Variable            | Meaning                                              |
| ------------------- | ---------------------------------------------------- |
| `DRY_RUN`           | `true` = paper trading, `false` = real orders        |
| `TESTNET`           | use the exchange sandbox first                        |
| `SYMBOLS`           | comma-separated pairs, e.g. `BTC/USDT,ETH/USDT`       |
| `MAX_POSITIONS`     | the 8-stack limit                                     |
| `RISK_PER_TRADE`    | fraction of quote balance risked per trade           |
| `STOP_LOSS_PCT`     | stop distance below entry (default `0.05` = 5%)       |
| `TAKE_PROFIT_TIERS` | ladder `pct:fraction,...` (default `0.05:0.5,0.10:1.0`) |

## Run

From the repository root:

```bash
python -m backend.trading
```

Start with `DRY_RUN=true` and `TESTNET=true`. Only set `DRY_RUN=false` after you
have validated behaviour on the testnet with small size.

## Backtest

```python
from backend.trading import TradingConfig, Backtester, Candles

cfg = TradingConfig(symbols=["BTC/USDT"], strategy="supertrend_adx", timeframe="4h")
data = {"BTC/USDT": Candles.from_ccxt(rows)}   # rows from exchange.fetch_ohlcv
result = Backtester(cfg, data).run()
print(result.summary())
# return=+12.40%  trades=18  win_rate=55.6%  profit_factor=1.84  max_dd=6.10%  sharpe=1.42
```

`Backtester.run()` returns a `BacktestResult` with `total_return_pct`,
`num_trades`, `win_rate`, `profit_factor`, `max_drawdown_pct`, `sharpe` and the
full `equity_curve` — exactly the metrics an optimization loop needs to rank
parameter sets.

## "David's approach" — AI-optimized SuperTrend + ADX

The recommended workflow:

1. **Generate / tune** the strategy in TradingView using `strategy.pine`
   (SuperTrend + ADX, 4h, BTC/ETH/SOL).
2. **Optimize** parameters (`SUPERTREND_*`, `ADX_THRESHOLD`) by scoring them with
   `Backtester` over historical candles. This is the function an MCP backtesting
   server would expose to Claude for an automated optimization loop.
3. **Export** the winning parameters into `.env`.
4. **Paper-trade** on the exchange testnet (`DRY_RUN=true`, `TESTNET=true`).
5. **Go live** with small capital only after validation.

The Python `SupertrendAdxStrategy` mirrors `strategy.pine` so backtest results
on TradingView and in this bot stay consistent.

## MCP backtesting server (the optimization loop)

`mcp_server.py` exposes the backtester/optimizer to Claude over MCP so the
parameter search can be driven by the model:

| Tool             | Purpose                                                    |
| ---------------- | ---------------------------------------------------------- |
| `download_ohlcv` | fetch + cache history from an exchange (Bybit, …)          |
| `run_backtest`   | score one strategy/parameter set → metrics                |
| `optimize`       | grid-search parameters → ranked metrics                   |

Run it:

```bash
pip install "mcp[cli]" ccxt
python -m backend.trading.mcp_server
```

Register it with Claude Code (`.mcp.json` / `claude mcp add`):

```json
{
  "mcpServers": {
    "octastack-trader": {
      "command": "python",
      "args": ["-m", "backend.trading.mcp_server"]
    }
  }
}
```

Then ask Claude to optimize — it can call `download_ohlcv` for BTC/ETH/SOL 4h,
then `optimize` over e.g. `{"supertrend_multiplier":[2,3,4],"adx_threshold":[20,25,30]}`,
and iterate until the metrics look good. The optimizer is also usable directly:

```python
from backend.trading import TradingConfig
from backend.trading.data import load_dataset
from backend.trading.optimize import grid_search

cfg = TradingConfig(symbols=["BTC/USDT"], strategy="supertrend_adx", timeframe="4h")
data = load_dataset({"BTC/USDT": "data/btc_4h.csv"})
best = grid_search(cfg, data,
    {"supertrend_multiplier": [2, 3, 4], "adx_threshold": [20, 25, 30]},
    sort_key="sharpe", top_n=5)
print(best[0].as_dict())
```

## Test

The test suite needs no third-party packages:

```bash
# with pytest
pytest backend/trading/tests/

# or without pytest
python -c "import inspect, backend.trading.tests.test_trading as t; \
[f() for n,f in inspect.getmembers(t, inspect.isfunction) if n.startswith('test_')]; \
print('ok')"
```

## Disclaimer

For educational purposes only. Cryptocurrency trading carries substantial risk.
Always test in dry-run / on a testnet and understand the strategy before
deploying real funds. The authors accept no responsibility for financial losses.
