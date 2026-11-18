const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Unbiased random base62 id (cryptographically random). */
export function randomId(length = 16): string {
  const out: string[] = [];
  const buf = new Uint8Array(length * 2);
  while (out.length < length) {
    crypto.getRandomValues(buf);
    for (const x of buf) {
      if (x < 248) out.push(ALPHABET[x % 62]); // 248 = 4 × 62: keeps the distribution uniform
      if (out.length === length) break;
    }
  }
  return out.join("");
}
