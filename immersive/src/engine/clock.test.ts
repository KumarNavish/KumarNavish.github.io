import { describe, expect, it } from "vitest";
import { advanceFrameClock } from "./clock";

describe("monotonic render clock", () => {
  it("does not reverse elapsed time when rAF precedes the startup sample", () => {
    expect(advanceFrameClock(1000, 1100)).toEqual({
      timestamp: 1100,
      delta: 0,
    });
  });
  it("does not double count the interval following an earlier callback", () => {
    const earlier = advanceFrameClock(1000, 1100);
    expect(advanceFrameClock(1110, earlier.timestamp).delta).toBeCloseTo(0.01);
  });
  it("caps elapsed time after a suspended frame", () => {
    expect(advanceFrameClock(10000, 1000).delta).toBe(0.05);
  });
  it("does not introduce NaN from a malformed clock value", () => {
    expect(advanceFrameClock(NaN, 1000)).toEqual({ timestamp: 1000, delta: 0 });
  });
  it("initializes the first frame with a positive bounded increment", () => {
    expect(advanceFrameClock(1000, 0)).toEqual({
      timestamp: 1000,
      delta: 0.016,
    });
  });
});
