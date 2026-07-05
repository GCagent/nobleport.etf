import { createHash } from "crypto";
import { ed25519 } from "@noble/curves/ed25519";
import { canonicalize } from "./canonical";

export interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

export class CryptographicCore {
  /** SHA-256 over the recursive canonical serialization of `payload`. */
  public static calculateSHA256(payload: object): string {
    return createHash("sha256").update(canonicalize(payload)).digest("hex");
  }

  public static generateKeyPair(): KeyPair {
    const privateKey = ed25519.utils.randomPrivateKey();
    return { privateKey, publicKey: ed25519.getPublicKey(privateKey) };
  }

  /**
   * Ed25519 signature over a hex-encoded SHA-256 hash. @noble/curves v1 is
   * synchronous; the async signature is kept for API stability with callers
   * that await it.
   */
  public static async signPayload(
    hash: string,
    privateKey: Uint8Array
  ): Promise<string> {
    const hashBytes = Buffer.from(hash, "hex");
    const signatureBytes = ed25519.sign(hashBytes, privateKey);
    return Buffer.from(signatureBytes).toString("hex");
  }

  public static async verifySignature(
    hash: string,
    signature: string,
    publicKey: Uint8Array
  ): Promise<boolean> {
    try {
      const hashBytes = Buffer.from(hash, "hex");
      const sigBytes = Buffer.from(signature, "hex");
      return ed25519.verify(sigBytes, hashBytes, publicKey);
    } catch {
      return false;
    }
  }
}
