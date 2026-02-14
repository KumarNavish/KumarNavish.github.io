export interface DriftOptions {
  seed: number;
  intensity?: number;
}

const SYNONYM_MAP: Record<string, string[]> = {
  request: ["ticket", "submission", "intake"],
  approve: ["authorize", "sign off", "clear"],
  access: ["entitlement", "permission", "entry"],
  vendor: ["supplier", "partner", "provider"],
  purchase: ["procurement", "buy", "acquisition"],
  incident: ["outage", "event", "failure"],
  escalate: ["route up", "raise", "promote"],
  urgent: ["time-sensitive", "high-priority", "critical"],
  review: ["assessment", "check", "verification"],
  policy: ["control", "guideline", "standard"],
};

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function replaceToken(token: string, rand: () => number): string {
  const normalized = token.toLowerCase();
  const candidates = SYNONYM_MAP[normalized];
  if (!candidates || candidates.length === 0) {
    return token;
  }

  const replacement = candidates[Math.floor(rand() * candidates.length)];
  const startsUpper = token[0] === token[0]?.toUpperCase();
  return startsUpper
    ? replacement[0].toUpperCase() + replacement.slice(1)
    : replacement;
}

export function applyTextDrift(text: string, options: DriftOptions): string {
  const rand = mulberry32(options.seed);
  const intensity = Math.min(Math.max(options.intensity ?? 0.35, 0), 1);

  return text
    .split(/(\b)/)
    .map((chunk) => {
      if (!/^[a-zA-Z]+$/.test(chunk)) {
        return chunk;
      }
      return rand() < intensity ? replaceToken(chunk, rand) : chunk;
    })
    .join("");
}
