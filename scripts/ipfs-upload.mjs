#!/usr/bin/env node
/**
 * Pin files or folders to IPFS via Pinata.
 *
 * nft.storage Classic (api.nft.storage) stopped accepting uploads on
 * 2024-06-30. This script is the replacement for the never-committed
 * nftstorage-upload.js: it uses Pinata's live pinFileToIPFS endpoint
 * (a single JWT, GitHub-Actions-friendly) instead of the dead SDK.
 *
 * Credentials (never printed):
 *   PINATA_JWT          preferred
 *   NFT_STORAGE_KEY     accepted only if it is NOT an nft.storage Classic JWT
 *
 * Usage:
 *   node scripts/ipfs-upload.mjs --path <file-or-dir> [--json] [--verify] [--name <name>]
 *   node scripts/ipfs-upload.mjs --self-test
 *
 * Exit codes:
 *   0 ok
 *   1 usage / runtime error
 *   2 missing credential
 *   3 nft.storage Classic key (will never work)
 *   4 upload rejected
 *   5 gateway verification failed
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PIN_ENDPOINT = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const GATEWAYS = [
  (cid) => `https://gateway.pinata.cloud/ipfs/${cid}`,
  (cid) => `https://ipfs.io/ipfs/${cid}`,
  (cid) => `https://w3s.link/ipfs/${cid}`,
];

export function decodeJwtPayload(token) {
  if (typeof token !== "string" || token.split(".").length < 2) return null;
  try {
    const payload = token.split(".")[1];
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const buf = Buffer.from(padded, "base64");
    return JSON.parse(buf.toString("utf8"));
  } catch {
    return null;
  }
}

export function classifyToken(token) {
  if (!token || !String(token).trim()) {
    return { ok: false, code: 2, reason: "missing" };
  }
  const trimmed = String(token).trim();
  const payload = decodeJwtPayload(trimmed);
  if (payload && (payload.iss === "nft-storage" || payload.iss === "nft.storage")) {
    return { ok: false, code: 3, reason: "nft-storage-classic", iss: payload.iss };
  }
  return { ok: true, token: trimmed, iss: payload?.iss ?? null };
}

export function resolveCredential(env = process.env) {
  const pinata = classifyToken(env.PINATA_JWT);
  if (pinata.ok) return { ...pinata, source: "PINATA_JWT" };

  const legacy = classifyToken(env.NFT_STORAGE_KEY);
  if (legacy.ok) return { ...legacy, source: "NFT_STORAGE_KEY" };
  if (legacy.code === 3) return { ...legacy, source: "NFT_STORAGE_KEY" };

  if (pinata.code === 3) return { ...pinata, source: "PINATA_JWT" };
  return { ok: false, code: 2, reason: "missing", source: null };
}

function fail(code, message) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const out = {
    path: null,
    json: false,
    verify: false,
    name: null,
    selfTest: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--path") out.path = argv[++i];
    else if (arg === "--name") out.name = argv[++i];
    else if (arg === "--json") out.json = true;
    else if (arg === "--verify") out.verify = true;
    else if (arg === "--self-test") out.selfTest = true;
    else if (arg === "--help" || arg === "-h") out.help = true;
    else if (!arg.startsWith("-") && !out.path) out.path = arg;
    else fail(1, `Unknown argument: ${arg}`);
  }
  return out;
}

async function walkFiles(root) {
  const abs = resolve(root);
  const info = await stat(abs);
  if (info.isFile()) {
    return [{ abs, rel: basename(abs), size: info.size }];
  }
  if (!info.isDirectory()) {
    throw new Error(`Not a file or directory: ${root}`);
  }
  const files = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const child = join(dir, entry.name);
      if (entry.isDirectory()) await walk(child);
      else if (entry.isFile()) {
        const s = await stat(child);
        files.push({
          abs: child,
          rel: relative(abs, child).split("\\").join("/"),
          size: s.size,
        });
      }
    }
  }
  await walk(abs);
  if (files.length === 0) throw new Error(`Directory is empty: ${root}`);
  return files;
}

async function buildForm(targetPath, name) {
  const files = await walkFiles(targetPath);
  const form = new FormData();
  const folderName = name || basename(resolve(targetPath));
  const isDir = files.length > 1 || files[0].rel.includes("/");

  for (const file of files) {
    const bytes = await readFile(file.abs);
    const filename = isDir ? `${folderName}/${file.rel}` : file.rel;
    form.append("file", new Blob([bytes]), filename);
  }

  form.append(
    "pinataMetadata",
    JSON.stringify({
      name: folderName,
      keyvalues: {
        repo: "GCagent/nobleport.etf",
        purpose: "document-pinning",
      },
    }),
  );
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1, wrapWithDirectory: isDir }));
  return { form, files, name: folderName };
}

async function pin(form, token) {
  const res = await fetch(PIN_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  if (!res.ok) {
    const err = new Error(`Pinata rejected upload (HTTP ${res.status})`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  const cid = body.IpfsHash || body.ipfsHash || body.cid;
  if (!cid) {
    const err = new Error("Pinata response missing IpfsHash");
    err.body = body;
    throw err;
  }
  return {
    cid,
    pinSize: body.PinSize ?? body.pinSize ?? null,
    timestamp: body.Timestamp ?? body.timestamp ?? new Date().toISOString(),
    isDuplicate: Boolean(body.isDuplicate),
  };
}

async function verifyCid(cid, expectedBytes) {
  const errors = [];
  for (const build of GATEWAYS) {
    const url = build(cid);
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        errors.push(`${url} -> HTTP ${res.status}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (expectedBytes != null && buf.length === 0) {
        errors.push(`${url} -> empty body`);
        continue;
      }
      return { ok: true, gateway: url, bytes: buf.length };
    } catch (err) {
      errors.push(`${url} -> ${err.message}`);
    }
  }
  return { ok: false, errors };
}

function printHelp() {
  process.stdout.write(`Pin a file or directory to IPFS via Pinata.\n\nUsage:\n  node scripts/ipfs-upload.mjs --path <file-or-dir> [--json] [--verify] [--name <name>]\n  node scripts/ipfs-upload.mjs --self-test\n\nEnv:\n  PINATA_JWT        Pinata JWT (preferred). Never printed.\n  NFT_STORAGE_KEY   Accepted only if it is not an nft.storage Classic token.\n\nnft.storage Classic (api.nft.storage) stopped accepting uploads 2024-06-30.\nCreate a Pinata JWT at https://app.pinata.cloud/developers/api-keys and store\nit as the GitHub Actions secret PINATA_JWT.\n`);
}

function selfTest() {
  const cases = [];
  const assert = (name, cond) => {
    cases.push({ name, ok: Boolean(cond) });
    if (!cond) process.stderr.write(`  FAIL  ${name}\n`);
    else process.stderr.write(`  PASS  ${name}\n`);
  };

  const classic =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
    Buffer.from(JSON.stringify({ iss: "nft-storage", iat: 1, name: "x" })).toString("base64url") +
    ".sig";
  const pinata =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
    Buffer.from(JSON.stringify({ iss: "pinata", iat: 1 })).toString("base64url") +
    ".sig";

  assert("empty credential is missing", resolveCredential({}).code === 2);
  assert("whitespace credential is missing", resolveCredential({ PINATA_JWT: "  " }).code === 2);
  assert(
    "nft.storage Classic JWT is rejected",
    resolveCredential({ NFT_STORAGE_KEY: classic }).code === 3,
  );
  assert(
    "PINATA_JWT is preferred",
    resolveCredential({ PINATA_JWT: pinata, NFT_STORAGE_KEY: classic }).source === "PINATA_JWT",
  );
  assert(
    "legacy name accepted when it is not Classic",
    resolveCredential({ NFT_STORAGE_KEY: pinata }).source === "NFT_STORAGE_KEY",
  );
  assert("classic iss detected", classifyToken(classic).reason === "nft-storage-classic");
  assert("args --json --verify", (() => {
    const a = parseArgs(["--path", "docs", "--json", "--verify", "--name", "bundle"]);
    return a.path === "docs" && a.json && a.verify && a.name === "bundle";
  })());

  const failed = cases.filter((c) => !c.ok).length;
  process.stderr.write(`self-test: ${cases.length - failed}/${cases.length} passed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (args.selfTest) {
    selfTest();
    return;
  }
  if (!args.path) {
    printHelp();
    fail(1, "Missing --path");
  }

  const cred = resolveCredential();
  if (!cred.ok) {
    if (cred.code === 3) {
      fail(
        3,
        [
          "NFT.Storage Classic API keys no longer accept uploads (sunset 2024-06-30).",
          "A key will not fix this — the endpoint is gone.",
          "Create a Pinata JWT at https://app.pinata.cloud/developers/api-keys",
          "and set the GitHub Actions secret PINATA_JWT (Settings → Secrets and variables → Actions).",
          "Do not put the key in the repo.",
        ].join("\n"),
      );
    }
    fail(
      2,
      [
        "PINATA_JWT is not set (or is empty).",
        "Add it at Settings → Secrets and variables → Actions.",
        "Credential value is never printed.",
      ].join("\n"),
    );
  }

  process.stderr.write(`Using ${cred.source} (present, not printed).\n`);

  let formBundle;
  try {
    formBundle = await buildForm(args.path, args.name);
  } catch (err) {
    fail(1, err.message);
  }
  process.stderr.write(
    `Pinning ${formBundle.files.length} file(s) as ${formBundle.name}\n`,
  );

  let result;
  try {
    result = await pin(formBundle.form, cred.token);
  } catch (err) {
    const extra = err.body ? ` ${JSON.stringify(err.body).slice(0, 400)}` : "";
    fail(4, `${err.message}${extra}`);
  }

  const payload = {
    ok: true,
    cid: result.cid,
    ipfsUri: `ipfs://${result.cid}`,
    gateways: GATEWAYS.map((g) => g(result.cid)),
    pinSize: result.pinSize,
    timestamp: result.timestamp,
    isDuplicate: result.isDuplicate,
    name: formBundle.name,
    files: formBundle.files.map((f) => ({ path: f.rel, size: f.size })),
    provider: "pinata",
    credentialSource: cred.source,
  };

  if (args.verify) {
    const expected =
      formBundle.files.length === 1 ? formBundle.files[0].size : null;
    const verified = await verifyCid(result.cid, expected);
    payload.verified = verified;
    if (!verified.ok) {
      if (args.json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      fail(5, `Gateway fetch failed for CID ${result.cid}: ${verified.errors.join("; ")}`);
    }
    process.stderr.write(`Gateway ok: ${verified.gateway} (${verified.bytes} bytes)\n`);
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`${result.cid}\n`);
  }
}

const isDirect =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  main().catch((err) => fail(1, err.stack || err.message));
}
