import { describe, expect, it } from "vitest";
import { distanceToPolyline, distanceToSegment, getPointAtDistance, offsetFromSegment } from "./geometry";

describe("distanceToSegment", () => {
  it("returns perpendicular distance when the projection falls inside the segment", () => {
    const d = distanceToSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(d).toBeCloseTo(5);
  });

  it("clamps to the nearest endpoint when the projection falls outside the segment", () => {
    const d = distanceToSegment({ x: -5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(d).toBeCloseTo(Math.hypot(5, 5));
  });
});

describe("distanceToPolyline", () => {
  it("takes the minimum distance across all segments", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    const d = distanceToPolyline({ x: 100, y: 50 }, path);
    expect(d).toBeCloseTo(0);
  });
});

describe("getPointAtDistance", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ];

  it("walks along the first segment", () => {
    const sample = getPointAtDistance(path, 50);
    expect(sample.position.x).toBeCloseTo(50);
    expect(sample.position.y).toBeCloseTo(0);
    expect(sample.finished).toBe(false);
  });

  it("continues onto the next segment once past the first", () => {
    const sample = getPointAtDistance(path, 150);
    expect(sample.position.x).toBeCloseTo(100);
    expect(sample.position.y).toBeCloseTo(50);
  });

  it("reports finished once the total path length is reached", () => {
    const sample = getPointAtDistance(path, 500);
    expect(sample.finished).toBe(true);
    expect(sample.position).toEqual({ x: 100, y: 100 });
  });
});

describe("offsetFromSegment", () => {
  it("produces a point exactly `distance` away from the segment", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 100, y: 0 };
    const point = offsetFromSegment(a, b, 0.5, 30, 1);
    const d = distanceToSegment(point, a, b);
    expect(d).toBeCloseTo(30);
  });
});
