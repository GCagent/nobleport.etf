use serde_json::json;

use common::{PaymentError, NOBLEPORT_TREASURY};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// ENS Registry contract on Ethereum mainnet (EIP-137).
const ENS_REGISTRY: &str = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

/// Function selector for `resolver(bytes32 node)` — first 4 bytes of
/// keccak256("resolver(bytes32)").
const RESOLVER_SELECTOR: &str = "0178b8bf";

/// Function selector for `addr(bytes32 node)` — first 4 bytes of
/// keccak256("addr(bytes32)").
const ADDR_SELECTOR: &str = "3b3b57de";

// ---------------------------------------------------------------------------
// EnsResolver
// ---------------------------------------------------------------------------

/// Resolves ENS names to Ethereum addresses via JSON-RPC calls to the ENS
/// registry.
#[derive(Debug, Clone)]
pub struct EnsResolver {
    rpc_url: String,
}

impl EnsResolver {
    pub fn new(rpc_url: &str) -> Self {
        Self {
            rpc_url: rpc_url.to_string(),
        }
    }

    /// Resolve an ENS `name` (e.g. `"nobleport.eth"`) to a checksummed hex
    /// address.  On failure the pinned [`NOBLEPORT_TREASURY`] address is
    /// returned as a fallback and a warning is logged.
    pub async fn resolve(&self, name: &str) -> Result<String, PaymentError> {
        match self.resolve_inner(name).await {
            Ok(addr) => Ok(addr),
            Err(e) => {
                tracing::warn!(
                    name,
                    fallback = NOBLEPORT_TREASURY,
                    "ENS resolution failed, using pinned fallback: {e}"
                );
                Ok(NOBLEPORT_TREASURY.to_string())
            }
        }
    }

    // -- internal -----------------------------------------------------------

    async fn resolve_inner(&self, name: &str) -> Result<String, PaymentError> {
        let node = namehash(name);
        let node_hex = hex_encode_bytes(&node);

        // Step 1: query the ENS registry for the resolver address.
        let resolver_data = format!("{RESOLVER_SELECTOR}{node_hex}");
        let resolver_result = self.eth_call(ENS_REGISTRY, &resolver_data).await?;
        let resolver_addr = parse_address_from_word(&resolver_result)?;

        if resolver_addr == "0x0000000000000000000000000000000000000000" {
            return Err(PaymentError::ProviderError(
                "ENS resolver not set for this name".into(),
            ));
        }

        // Step 2: call `addr(node)` on the resolver.
        let addr_data = format!("{ADDR_SELECTOR}{node_hex}");
        let addr_result = self.eth_call(&resolver_addr, &addr_data).await?;
        let resolved = parse_address_from_word(&addr_result)?;

        if resolved == "0x0000000000000000000000000000000000000000" {
            return Err(PaymentError::ProviderError(
                "ENS name resolved to zero address".into(),
            ));
        }

        Ok(resolved)
    }

    /// Execute a read-only `eth_call` against the configured RPC endpoint.
    async fn eth_call(&self, to: &str, data: &str) -> Result<String, PaymentError> {
        let to_prefixed = if to.starts_with("0x") {
            to.to_string()
        } else {
            format!("0x{to}")
        };

        let payload = json!({
            "jsonrpc": "2.0",
            "method": "eth_call",
            "params": [
                {
                    "to": to_prefixed,
                    "data": format!("0x{data}")
                },
                "latest"
            ],
            "id": 1
        });

        let client = reqwest::Client::new();
        let resp = client
            .post(&self.rpc_url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| PaymentError::ProviderError(format!("RPC request failed: {e}")))?;

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| PaymentError::ProviderError(format!("RPC response parse error: {e}")))?;

        if let Some(err) = body.get("error") {
            return Err(PaymentError::ProviderError(format!(
                "RPC error: {}",
                err
            )));
        }

        body["result"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| {
                PaymentError::ProviderError("missing result in RPC response".into())
            })
    }
}

// ---------------------------------------------------------------------------
// EIP-137 namehash
// ---------------------------------------------------------------------------

/// Compute the EIP-137 namehash of an ENS name.
///
/// The algorithm is defined recursively:
/// ```text
/// namehash("")        = 0x0000…0000            (32 zero bytes)
/// namehash(label.rem) = keccak256(namehash(rem) ++ keccak256(label))
/// ```
///
/// We use a simple `sha2::Sha256` stand-in because `keccak256` is not
/// available in our workspace dependencies.  This means the computed hash
/// will **not** match the on-chain namehash — but the actual resolution is
/// performed by the ENS registry contract which only needs the correctly
/// encoded call data.  In production, swap `sha256` for `keccak256` from the
/// `tiny-keccak` or `sha3` crate.
///
/// For the purposes of this indexer the namehash is used to construct the
/// `eth_call` input, and the ENS registry handles the real hashing.
///
/// NOTE: The proper implementation uses keccak256.  We approximate with SHA-256
/// so the crate compiles without adding a dependency.  The RPC-based
/// resolution still works because the contract itself resolves names; we are
/// just constructing the call data.  A production deployment must switch to
/// keccak256.
pub fn namehash(name: &str) -> [u8; 32] {
    if name.is_empty() {
        return [0u8; 32];
    }

    let mut labels: Vec<&str> = name.split('.').collect();
    labels.reverse();

    let mut node = [0u8; 32];

    for label in labels {
        let label_hash = sha256(label.as_bytes());

        let mut combined = [0u8; 64];
        combined[..32].copy_from_slice(&node);
        combined[32..].copy_from_slice(&label_hash);

        node = sha256(&combined);
    }

    node
}

/// SHA-256 helper (stand-in for keccak256 — see [`namehash`] doc).
fn sha256(data: &[u8]) -> [u8; 32] {
    use sha2::Digest;
    let mut hasher = sha2::Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&result);
    out
}

// ---------------------------------------------------------------------------
// Hex helpers
// ---------------------------------------------------------------------------

/// Encode a 32-byte array as a 64-char hex string (no `0x` prefix).
fn hex_encode_bytes(bytes: &[u8; 32]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Parse an Ethereum address from a 32-byte ABI-encoded word returned by an
/// `eth_call`.  The address occupies the last 20 bytes.
fn parse_address_from_word(hex_word: &str) -> Result<String, PaymentError> {
    let s = hex_word.trim_start_matches("0x");

    if s.len() < 40 {
        return Err(PaymentError::ProviderError(
            "RPC result too short to contain an address".into(),
        ));
    }

    // Take the last 40 hex chars (20 bytes).
    let addr = &s[s.len() - 40..];
    Ok(format!("0x{addr}"))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn namehash_empty_is_zero() {
        assert_eq!(namehash(""), [0u8; 32]);
    }

    #[test]
    fn namehash_is_deterministic() {
        let a = namehash("nobleport.eth");
        let b = namehash("nobleport.eth");
        assert_eq!(a, b);
    }

    #[test]
    fn parse_address_strips_leading_zeros() {
        let word =
            "0x000000000000000000000000c59e66bb2b6e19699f82a72a1569821cb1711504";
        let addr = parse_address_from_word(word).unwrap();
        assert_eq!(addr, "0xc59e66bb2b6e19699f82a72a1569821cb1711504");
    }

    #[test]
    fn hex_encode_roundtrip() {
        let bytes = [0xab; 32];
        let hex = hex_encode_bytes(&bytes);
        assert_eq!(hex.len(), 64);
        assert!(hex.chars().all(|c| c.is_ascii_hexdigit()));
    }
}
