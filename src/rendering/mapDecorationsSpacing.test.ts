import { describe, expect, it } from "vitest";
import { drawnRadius, FREE_GROUND_GAP, getMapDecorations, getStrayBakedDecorations, touchesPlayArea } from "./mapDecorations";
import { BAKED_DECORATIONS, BAKED_KINDS } from "./bakedDecorations";
import { getBiome } from "./biomes";
import { getMapLayout, MAP_LAYOUTS } from "@/data/mapLayouts";
import { distance } from "@/utils/geometry";
import { CITY_PLOT_RADIUS, getCityPlots } from "@/data/cityPlots";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Owner's call (Nov 2026): "coloca as coisas no mapa sem encostar em rocha… tudo realista de um só padrão". */
describe("map scenery — one spacing standard", () => {
  for (const id of Object.keys(MAP_LAYOUTS)) {
    it(`${id}: nothing placed live touches the road, a site, the castle, the painted scenery or anything else`, () => {
      const decos = getMapDecorations(getBiome(id));
      const baked = new Set(BAKED_DECORATIONS[id] ?? []);
      const layout = getMapLayout(id);
      for (const d of decos) {
        if (baked.has(d)) continue; // painted into the ground image: fixed
        expect(touchesPlayArea(d.position, drawnRadius(d), layout), `${d.kind} @${d.position.x | 0},${d.position.y | 0}`).toBe(false);
        for (const o of decos) {
          if (o === d) continue;
          expect(distance(d.position, o.position), `${d.kind}/${o.kind}`).toBeGreaterThanOrEqual(drawnRadius(d) + drawnRadius(o) + FREE_GROUND_GAP - 1e-6);
        }
      }
    });
  }

  it("the city's buildings never stand on scenery, and nothing is placed on the city's ground (its buildings rise there later)", () => {
    for (const id of Object.keys(MAP_LAYOUTS)) {
      const plots = getCityPlots(getMapLayout(id));
      for (const d of getMapDecorations(getBiome(id)))
        for (const p of plots) expect(distance(d.position, p.position), `${id} ${p.id} / ${d.kind}`).toBeGreaterThanOrEqual(CITY_PLOT_RADIUS + drawnRadius(d) + FREE_GROUND_GAP - 1e-6);
    }
  });

  it("painted scenery that a road, site or castle now sits on is taken off the map (and painted over), never kept", () => {
    for (const id of Object.keys(MAP_LAYOUTS)) {
      const stray = new Set(getStrayBakedDecorations(id));
      for (const d of getMapDecorations(getBiome(id))) expect(stray.has(d)).toBe(false);
    }
  });

  it("the baked-scenery record lists the same kinds as the ground bakes", () => {
    const src = readFileSync(resolve(process.cwd(), "src/rendering/groundBakes.ts"), "utf8");
    for (const [id, kinds] of Object.entries(BAKED_KINDS)) {
      const m = src.match(new RegExp(`${id}: bake\\("\\w+", \\[([^\\]]*)\\]`));
      expect(m, id).toBeTruthy();
      expect([...m![1]!.matchAll(/"(\w+)"/g)].map((x) => x[1])).toEqual([...kinds]);
    }
  });
});
