"""
OctaStackTrader — CLI entry point.

Run with:  python -m backend.trading

Wires configuration → ccxt market-data feed → paper or live broker → engine,
then starts the main loop. ``ccxt`` is only imported when the bot actually runs
(not during import of the package), so unit tests and the paper-trading core
have no third-party dependencies.
"""

from __future__ import annotations

import logging

from .bot import OctaStackTrader
from .broker import (
    CCXTBroker,
    CCXTMarketData,
    PaperBroker,
    _build_ccxt_exchange,
)
from .config import TradingConfig


def _configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
        handlers=[
            logging.FileHandler("octastack.log"),
            logging.StreamHandler(),
        ],
    )


def build_trader(cfg: TradingConfig) -> OctaStackTrader:
    """Compose a live/paper trader from a resolved config."""
    client = _build_ccxt_exchange(
        exchange=cfg.exchange,
        api_key=cfg.api_key,
        api_secret=cfg.api_secret,
        testnet=cfg.testnet,
    )
    market = CCXTMarketData(client)

    if cfg.dry_run:
        broker = PaperBroker(
            quote_currency=cfg.quote_currency,
            starting_balance=cfg.starting_paper_balance,
        )
    else:
        broker = CCXTBroker(client, quote_currency=cfg.quote_currency)

    return OctaStackTrader(cfg, market, broker)


def main() -> None:
    _configure_logging()
    cfg = TradingConfig.from_env()
    trader = build_trader(cfg)
    trader.run()


if __name__ == "__main__":
    main()
