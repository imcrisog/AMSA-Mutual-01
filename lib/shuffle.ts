export function shuffleInPlace<T>(arr: T[], rng = Math.random) {
  // Fisher–Yates
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Deterministic RNG (Mulberry32) from a 32-bit seed.
 * Good for reproducible shuffles when combined with a public randomness beacon.
 */
export function mulberry32(seed: number) {
  return function rng() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Converts an hex string to a 32-bit seed (xor-folding).
 * Works for NIST `outputValue` which is hex.
 */
export function seed32FromHex(hex: string) {
  const clean = hex.trim().replace(/^0x/i, "").toLowerCase();
  let seed = 0;
  // fold by 8-hex chunks (32 bits)
  for (let i = 0; i < clean.length; i += 8) {
    const chunk = clean.slice(i, i + 8);
    const n = Number.parseInt(chunk, 16);
    if (!Number.isNaN(n)) seed ^= n >>> 0;
  }
  return seed >>> 0;
}


