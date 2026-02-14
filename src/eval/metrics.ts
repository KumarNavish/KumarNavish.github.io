import type { ProcessId } from "../domain/types";

export type FlatObject = Record<string, string>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function flattenObject(value: unknown, prefix = ""): FlatObject {
  if (!isPlainObject(value) && !Array.isArray(value)) {
    return {
      [prefix || "$"]: value === null || value === undefined ? "" : String(value),
    };
  }

  const output: FlatObject = {};
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      const key = prefix ? `${prefix}[${index}]` : `[${index}]`;
      const nested = flattenObject(entry, key);
      Object.assign(output, nested);
    });
    return output;
  }

  const keys = Object.keys(value);
  for (const key of keys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const nested = flattenObject(value[key], path);
    Object.assign(output, nested);
  }
  return output;
}

export interface FlattenCompareResult {
  total: number;
  matched: number;
  exact: boolean;
  mismatchedKeys: string[];
}

export function compareFlattened(expected: FlatObject, actual: FlatObject): FlattenCompareResult {
  const expectedKeys = Object.keys(expected).sort();
  const actualKeys = Object.keys(actual).sort();
  const universe = new Set<string>([...expectedKeys, ...actualKeys]);

  let matched = 0;
  const mismatchedKeys: string[] = [];
  for (const key of universe) {
    if (expected[key] === actual[key]) {
      matched += 1;
    } else {
      mismatchedKeys.push(key);
    }
  }

  return {
    total: universe.size,
    matched,
    exact: mismatchedKeys.length === 0,
    mismatchedKeys,
  };
}

export function requiredFieldExactMatch(
  expectedRequiredFields: Record<string, unknown>,
  actualRequiredFields: Record<string, unknown>,
): FlattenCompareResult {
  return compareFlattened(flattenObject(expectedRequiredFields), flattenObject(actualRequiredFields));
}

export function computeOverallScore(
  intentAccuracy: number,
  requiredFieldExactMatchRate: number,
  weights: { intent: number; fields: number } = { intent: 0.6, fields: 0.4 },
): number {
  const score = intentAccuracy * weights.intent + requiredFieldExactMatchRate * weights.fields;
  return Math.max(0, Math.min(1, score));
}

export function forgettingFromScoreHistory(
  historyByProcess: Partial<Record<ProcessId, number[]>> | Record<string, number[]>,
): Record<string, number> {
  const forgetting: Record<string, number> = {};
  for (const [processId, history] of Object.entries(historyByProcess)) {
    if (!history || history.length === 0) {
      forgetting[processId] = 0;
      continue;
    }
    const bestHistorical = Math.max(...history);
    const current = history[history.length - 1];
    forgetting[processId] = Math.max(0, bestHistorical - current);
  }
  return forgetting;
}

export function meanScore(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
