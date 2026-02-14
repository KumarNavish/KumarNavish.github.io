import { describe, expect, it } from "vitest";
import {
  compareFlattened,
  flattenObject,
  forgettingFromScoreHistory,
  requiredFieldExactMatch,
} from "./metrics";

describe("eval metrics helpers", () => {
  it("flatten + compare works for nested objects", () => {
    const expected = {
      a: {
        b: "x",
      },
      c: [1, 2],
      d: true,
    };
    const actual = {
      a: {
        b: "x",
      },
      c: [1, 3],
      d: true,
    };

    const flatExpected = flattenObject(expected);
    const flatActual = flattenObject(actual);
    const compared = compareFlattened(flatExpected, flatActual);
    const requiredCompare = requiredFieldExactMatch(expected, actual);

    expect(flatExpected["a.b"]).toBe("x");
    expect(compared.exact).toBe(false);
    expect(compared.matched).toBe(3);
    expect(compared.total).toBe(4);
    expect(requiredCompare.mismatchedKeys).toContain("c[1]");
  });

  it("computes forgetting correctly from synthetic score history", () => {
    const history = {
      access_request: [0.85, 0.8, 0.67],
      purchase_request: [0.55, 0.61, 0.57],
      incident_escalation: [0.72],
    };

    const forgetting = forgettingFromScoreHistory(history);

    expect(forgetting.access_request).toBeCloseTo(0.18, 6);
    expect(forgetting.purchase_request).toBeCloseTo(0.04, 6);
    expect(forgetting.incident_escalation).toBeCloseTo(0, 6);
  });
});
