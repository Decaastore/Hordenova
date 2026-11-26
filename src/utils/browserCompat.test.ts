import { describe, expect, it } from "vitest";
import { installBrowserCompat } from "./browserCompat";

describe("browserCompat — canvas features older Safari lacks", () => {
  it("adds roundRect when the browser has none, drawing a closed rounded path", () => {
    const calls: string[] = [];
    const proto: Record<string, unknown> = {
      moveTo: () => calls.push("moveTo"),
      lineTo: () => calls.push("lineTo"),
      arcTo: () => calls.push("arcTo"),
      closePath: () => calls.push("closePath"),
    };
    const original = (window as unknown as { CanvasRenderingContext2D?: unknown }).CanvasRenderingContext2D;
    (window as unknown as { CanvasRenderingContext2D: unknown }).CanvasRenderingContext2D = { prototype: proto };
    try {
      installBrowserCompat();
      expect(typeof proto.roundRect).toBe("function");
      (proto.roundRect as (x: number, y: number, w: number, h: number, r: number) => void).call(proto, 0, 0, 40, 20, 6);
      expect(calls.filter((c) => c === "arcTo")).toHaveLength(4);
      expect(calls.at(-1)).toBe("closePath");
    } finally {
      (window as unknown as { CanvasRenderingContext2D?: unknown }).CanvasRenderingContext2D = original;
    }
  });
});
