import { strict as assert } from "assert";
import test from "node:test";
import { canonicalize } from "../src/crypto/canonical";
import { CryptographicCore } from "../src/crypto/verify";

test("canonicalize sorts keys recursively", () => {
  const a = { b: { z: 1, a: 2 }, a: [{ y: 1, x: 2 }] };
  const b = { a: [{ x: 2, y: 1 }], b: { a: 2, z: 1 } };
  assert.equal(canonicalize(a), canonicalize(b));
  assert.equal(canonicalize(a), '{"a":[{"x":2,"y":1}],"b":{"a":2,"z":1}}');
});

test("canonicalize covers nested keys the naive replacer-array approach drops", () => {
  const payload = { outer: { inner: "value" } };
  const naive = JSON.stringify(payload, Object.keys(payload).sort());
  assert.ok(!naive.includes("inner"), "naive replacer drops nested keys");
  assert.ok(canonicalize(payload).includes("inner"));
});

test("calculateSHA256 is stable across key order", () => {
  const h1 = CryptographicCore.calculateSHA256({ x: 1, nested: { b: 2, a: 3 } });
  const h2 = CryptographicCore.calculateSHA256({ nested: { a: 3, b: 2 }, x: 1 });
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9a-f]{64}$/);
});

test("sign / verify round-trip and tamper detection", async () => {
  const { privateKey, publicKey } = CryptographicCore.generateKeyPair();
  const hash = CryptographicCore.calculateSHA256({ amount: 4500, job: "np-102" });
  const sig = await CryptographicCore.signPayload(hash, privateKey);

  assert.equal(await CryptographicCore.verifySignature(hash, sig, publicKey), true);

  const tamperedHash = CryptographicCore.calculateSHA256({ amount: 9999, job: "np-102" });
  assert.equal(await CryptographicCore.verifySignature(tamperedHash, sig, publicKey), false);

  const otherKey = CryptographicCore.generateKeyPair().publicKey;
  assert.equal(await CryptographicCore.verifySignature(hash, sig, otherKey), false);
});

test("verifySignature returns false on malformed input instead of throwing", async () => {
  const { publicKey } = CryptographicCore.generateKeyPair();
  assert.equal(
    await CryptographicCore.verifySignature("not-hex", "zz", publicKey),
    false
  );
});
