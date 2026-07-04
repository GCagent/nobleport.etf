/**
 * Deterministic JSON canonicalization (RFC 8785-style subset).
 *
 * `JSON.stringify(payload, Object.keys(payload).sort())` — the naive
 * approach — treats the key array as a whitelist at every depth, so nested
 * keys absent from the top level are silently dropped from the hash input.
 * This module sorts keys recursively instead, guaranteeing that two
 * structurally equal payloads always produce byte-identical serializations.
 */

export function canonicalize(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError("Cannot canonicalize non-finite number");
      }
      return JSON.stringify(value);
    case "bigint":
      throw new TypeError("Cannot canonicalize BigInt; serialize it as a string first");
    case "undefined":
    case "function":
    case "symbol":
      throw new TypeError(`Cannot canonicalize value of type ${typeof value}`);
  }

  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalize(v === undefined ? null : v)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && typeof v !== "function" && typeof v !== "symbol")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`);
  return `{${entries.join(",")}}`;
}
