use chrono::Utc;
use serde::Deserialize;
use serde::Serialize;

use common::PaymentError;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Cached ETH/USD price with the UNIX timestamp (seconds) at which it was
/// fetched.  The cache is considered stale after [`PriceOracle::max_age_secs`]
/// seconds.
#[derive(Debug, Clone, Copy)]
struct PriceEntry {
    price: f64,
    fetched_at: i64,
}

/// A simple price oracle that fetches ETH/USD from CoinGecko and caches the
/// result for up to `max_age_secs` seconds (default 300 = 5 minutes).
#[derive(Debug)]
pub struct PriceOracle {
    cache: Option<PriceEntry>,
    /// Maximum age of a cached price in seconds.
    pub max_age_secs: i64,
}

/// The subset of the CoinGecko `/simple/price` response we care about.
#[derive(Debug, Deserialize)]
struct CoinGeckoResponse {
    ethereum: EthPrice,
}

#[derive(Debug, Deserialize)]
struct EthPrice {
    usd: f64,
}

/// Public view of a price quote, returned from the `/price/eth` endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceQuote {
    pub price_usd: f64,
    pub timestamp: i64,
    pub max_age_secs: i64,
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

impl PriceOracle {
    /// Default maximum cache age: 5 minutes.
    const DEFAULT_MAX_AGE: i64 = 300;

    /// Create a new oracle with the default 5-minute cache window.
    pub fn new() -> Self {
        Self {
            cache: None,
            max_age_secs: Self::DEFAULT_MAX_AGE,
        }
    }

    /// Return the current ETH/USD price and the UNIX timestamp at which it was
    /// locked.  A cached value is reused when it is less than `max_age_secs`
    /// old; otherwise a fresh price is fetched from CoinGecko.
    pub async fn get_eth_usd(&mut self) -> Result<(f64, i64), PaymentError> {
        let now = Utc::now().timestamp();

        // Return cached value if still fresh.
        if let Some(entry) = &self.cache {
            if now - entry.fetched_at < self.max_age_secs {
                return Ok((entry.price, entry.fetched_at));
            }
        }

        // Fetch a fresh price.
        let price = Self::fetch_from_coingecko().await?;
        let ts = Utc::now().timestamp();

        self.cache = Some(PriceEntry {
            price,
            fetched_at: ts,
        });

        Ok((price, ts))
    }

    /// Check whether a price that was locked at `locked_at` (UNIX seconds) is
    /// still within the acceptable window.
    pub fn is_price_valid(&self, locked_at: i64) -> bool {
        let now = Utc::now().timestamp();
        (now - locked_at).abs() < self.max_age_secs
    }

    /// Return a [`PriceQuote`] suitable for API responses.
    pub async fn quote(&mut self) -> Result<PriceQuote, PaymentError> {
        let (price_usd, timestamp) = self.get_eth_usd().await?;
        Ok(PriceQuote {
            price_usd,
            timestamp,
            max_age_secs: self.max_age_secs,
        })
    }

    // -- internal -----------------------------------------------------------

    async fn fetch_from_coingecko() -> Result<f64, PaymentError> {
        let url =
            "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd";

        let resp = reqwest::get(url)
            .await
            .map_err(|e| PaymentError::ProviderError(format!("CoinGecko request failed: {e}")))?;

        if !resp.status().is_success() {
            return Err(PaymentError::ProviderError(format!(
                "CoinGecko returned status {}",
                resp.status()
            )));
        }

        let body: CoinGeckoResponse = resp
            .json()
            .await
            .map_err(|e| PaymentError::ProviderError(format!("CoinGecko parse error: {e}")))?;

        Ok(body.ethereum.usd)
    }
}

impl Default for PriceOracle {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn price_validity_window() {
        let oracle = PriceOracle::new();
        let now = Utc::now().timestamp();

        // A price locked just now should be valid.
        assert!(oracle.is_price_valid(now));

        // A price locked 6 minutes ago should be expired.
        assert!(!oracle.is_price_valid(now - 360));
    }

    #[test]
    fn default_max_age_is_five_minutes() {
        let oracle = PriceOracle::new();
        assert_eq!(oracle.max_age_secs, 300);
    }
}
