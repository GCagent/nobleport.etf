#!/usr/bin/env node
"use strict";

// Compatibility entrypoint for jobs that still call nftstorage-upload.js.
// Classic nft.storage is dead; the real implementation is ipfs-upload.mjs (Pinata).
const { spawnSync } = require("child_process");
const path = require("path");

const result = spawnSync(
  process.execPath,
  [path.join(__dirname, "ipfs-upload.mjs"), ...process.argv.slice(2)],
  { stdio: "inherit" },
);

process.exit(result.status === null ? 1 : result.status);
