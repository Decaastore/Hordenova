import { describe, expect, it } from "vitest";
import { fortressAnchorFor, MAP_LAYOUTS } from "./mapLayouts";
import { getCityPlots } from "./cityPlots";
import { CITY_BUILDINGS } from "@/config/city";
import { distance, distanceToPolyline } from "@/utils/geometry";

describe("city plots — every map has room for the whole city, clear of play", () => {
  for (const layout of Object.values(MAP_LAYOUTS)) {
    it(layout.id, () => {
      const plots = getCityPlots(layout);
      expect(plots.map((p) => p.id)).toEqual(CITY_BUILDINGS.map((b) => b.id));
      const castle = fortressAnchorFor(layout.path).position;
      for (const plot of plots) {
        expect(distanceToPolyline(plot.position, layout.path)).toBeGreaterThan(30);
        for (const site of layout.sites) expect(distance(plot.position, site.position)).toBeGreaterThan(40);
        expect(Math.abs(plot.position.x - castle.x) < 118 && plot.position.y - castle.y > -190 && plot.position.y - castle.y < 70).toBe(false);
      }
    });
  }
});
