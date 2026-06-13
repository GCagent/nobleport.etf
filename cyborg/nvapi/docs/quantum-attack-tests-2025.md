# Quantum Attack Tests (2025) — Source Corpus for the Cyborg.ai Threat Matrix

This is the text form of the research document that
`cyborg/nvapi/app/quantum.py` was built from
([PDF on file](./quantum-attack-tests-2025.pdf)). The code module encodes the
ten vectors with NoblePort platform exposure; this document preserves the
underlying metrics, mitigations, and **primary-source citations** so the
matrix can be audited and retrained as research moves.

**Provenance:** AI-assisted research summary (compiled 2025, uploaded
2026-06-12). The risk scores are qualitative judgments from that summary —
treat the citation list below as the authoritative layer, and per the
Operational Truth Matrix this entire dataset is **MODELED**: an assessment
input, not live telemetry.

## Score interpretation

Risk score 1 = theoretical/impractical → 10 = imminently feasible. Higher
scores mean fewer qubits/less time required or broader applicability.
Harvest-now/decrypt-later scores highest because data encrypted today can be
stored and decrypted after Q-day; BHT collisions score lowest because the
memory requirements are astronomical.

## The ten attack tests

| # | Attack (algorithm) | Key metrics | Risk | Core mitigation |
|---|--------------------|-------------|------|-----------------|
| 1 | Shor's — RSA-2048 factoring | IETF: ~20M noisy qubits / ~8 h. Gidney 2025: **<1M noisy qubits, <1 week** (approximate residue arithmetic, magic-state cultivation). Speculative: ~600k qubits / 6–10 h. | 7/10 | Migrate to PQC (ML-KEM/Kyber, HQC); no key-size increase saves RSA. 3072/4096-bit RSA + hybrid key exchange during transition; short key lifetimes. |
| 2 | Shor's — ECC/ECDSA (256-bit) | ≈1M qubits (Quantum Zeitgeist); Garn & Kan 2025: **~370,000 physical qubits, ~8–12 h**. Fewer qubits than RSA — Q-day for ECC may arrive first. | 8/10 | Replace ECDH/ECDSA with ML-KEM + ML-DSA; hybrid certificates; for crypto wallets, quantum-secure signatures or multi-sig/hybrid wallets. |
| 3 | Harvest-now / decrypt-later | Cloudflare: Q-day possibly within ~15 years; RSA-2048 breakable with <1M qubits in <1 week → data harvested today readable in the 2030s. | 9/10 | Re-encrypt long-term data with PQC; ML-KEM forward secrecy in TLS; frequent rotation, short cert lifetimes; destroy archives that must outlive Q-day. |
| 4 | Grover's — AES key search | 2^n → 2^(n/2): AES-128 falls to 64-bit security; AES-256 retains 128-bit. Grover parallelizes poorly. | 5/10 | AES-256 everywhere; segmented/multi-party key schemes; rotate keys, limit reuse. |
| 5 | Grover's — hash preimage | SHA-256 → 128-bit, SHA-512 → 256-bit preimage security; ≤224-bit hashes unacceptable (SHA-224 → 112-bit). | 5/10 | SHA-256 minimum, prefer SHA-512; Argon2/PBKDF2 + salt for passwords. |
| 6 | BHT — hash collision | O(2^(n/2)) → O(2^(n/3)); SHA-256 collision ~85-bit, but needs ~2^85 quantum memory — impractical; classical parallel methods outperform it. | 3/10 | SHA-384/SHA-512 restore ~128-bit collision security; avoid truncated hashes; HMAC for keyed contexts. |
| 7 | Simon's — block-cipher structures | Breaks Even–Mansour and 3-round Feistel in polynomial time (Kuwakado & Morii); does not extend to full-round AES/modern ciphers. | 2/10 | Full-round AES/ChaCha20; ensure new modes have no hidden periodicities. |
| 8 | BV-based quantum differential cryptanalysis | Difference discovery in polynomial time; quadratic key-recovery speed-up; O(n³q² log n) → O(nq²). No practical AES attack. | 4/10 | High round counts, large S-boxes, designs evaluated under quantum models. |
| 9 | VQAA — variational quantum attack | Same order of queries as Grover, sometimes faster; demonstrated on S-DES only; unproven at production key sizes. | 5/10 | 256-bit keys (AES-256/ChaCha20); monitor variational-attack research; cryptographic agility. |
| 10 | Quantum side-channel + ML attacks | Implementation-dependent (timing/power/EM leakage amplified by quantum ML); no fixed qubit estimates. | 7/10 | Constant-time coding, noise injection, shielding, HSMs/tamper-resistant chips; PQC is not immune to implementation attacks. |

## Additional recommendations (verbatim themes)

1. **Plan PQC migration now** — NSA/NIST/UK NCSC deadlines fall between
   **2030 and 2035**: inventory cryptographic assets, prioritize high-value
   data, build the migration roadmap.
2. **Hybrid cryptography during transition** — X25519 + ML-KEM,
   ECDSA + ML-DSA.
3. **Short-lived keys and messages** — perfect forward secrecy limits the
   value of harvested ciphertext.
4. **Monitor algorithm advances** — Chen's 2024 lattice attack (later shown
   flawed) proves surprises happen.
5. **Educate stakeholders** — share qubit/runtime metrics to justify PQC
   investment.

## References (primary sources)

1. IETF — *Post-Quantum Cryptography for Engineers* —
   https://www.ietf.org/archive/id/draft-ietf-pquip-pqc-engineers-10.html
2. Gidney 2025 — *How to factor 2048 bit RSA integers with less than a
   million noisy qubits* — https://arxiv.org/html/2505.15917v1
3. Anduro — *The Quantum Shift* —
   https://www.anduro.io/blog/the-quantum-shift-getting-ready-for-a-new-computing-era
4. Quantum Zeitgeist — *The Impact of Quantum Computing on Data Privacy and
   Security* —
   https://quantumzeitgeist.com/the-impact-of-quantum-computing-on-data-privacy-and-security-2/
5. Cloudflare — *State of the post-quantum Internet in 2025* —
   https://blog.cloudflare.com/pq-2025/
6. PostQuantum — *Grover's Algorithm and Its Impact on Cybersecurity* —
   https://postquantum.com/post-quantum/grovers-algorithm/
7. Freemindtronic — *Quantum Threats to Encryption: RSA, AES & ECC Defense* —
   https://freemindtronic.com/quantum-threats-to-encryption/
8. PostQuantum — *Brassard–Høyer–Tapp (BHT) Quantum Collision Algorithm* —
   https://postquantum.com/post-quantum/brassard-hoyer-tapp-bht/
9. EPJ Quantum Technology — *Quantum differential cryptanalysis based on
   Bernstein-Vazirani algorithm* —
   https://epjquantumtechnology.springeropen.com/articles/10.1140/epjqt/s40507-024-00295-1
10. Southampton — *VQAA paper (scis_paper.pdf)* —
    https://eprints.soton.ac.uk/469681/1/scis_paper.pdf
