"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GeoJSONSource, Map as GlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type CaseMark = { id: string; name: string; count: number; lon: number; lat: number; level: string };

/* OpenFreeMap serves OpenStreetMap vector tiles without a key or quota. Only map tiles are requested; no case data leaves the browser. */
const STYLE = "https://tiles.openfreemap.org/styles/positron";
const EGYPT: [number, number, number, number] = [24, 22, 37, 33];
const DOT = "#183e2e";
const HALO = "#17a04a";

function collection(marks: CaseMark[]) {
  return { type: "FeatureCollection" as const, features: marks.map((mark) => ({ type: "Feature" as const, properties: { id: mark.id, name: mark.name, count: mark.count, level: mark.level }, geometry: { type: "Point" as const, coordinates: [mark.lon, mark.lat] } })) };
}

/** Interactive basemap with one sized marker per recorded place. Renders `fallback` when the basemap cannot load. */
export function CaseMap({ marks, world, onPick, label, fallback }: { marks: CaseMark[]; world: boolean; onPick: (id: string) => void; label: string; fallback: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<GlMap | null>(null);
  const pick = useRef(onPick);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  useEffect(() => { pick.current = onPick; }, [onPick]);

  useEffect(() => {
    let cancelled = false;
    let instance: GlMap | undefined;
    let styled = false;
    const giveUp = () => { if (!cancelled && !styled) setState("failed"); };
    const timer = window.setTimeout(giveUp, 10000);
    import("maplibre-gl").then(({ default: gl }) => {
      if (cancelled || !box.current) return;
      try {
        instance = new gl.Map({ container: box.current, style: STYLE, bounds: EGYPT, fitBoundsOptions: { padding: 40 }, dragRotate: false, pitchWithRotate: false, cooperativeGestures: true, attributionControl: { compact: true }, canvasContextAttributes: { preserveDrawingBuffer: true } });
      } catch { giveUp(); return; }
      const created = instance;
      created.touchZoomRotate.disableRotation();
      created.addControl(new gl.NavigationControl({ showCompass: false }), "top-right");
      created.on("error", giveUp);
      created.on("style.load", () => {
        styled = true;
        created.addSource("cases", { type: "geojson", data: collection([]) });
        const radius = ["+", 7, ["*", 3, ["sqrt", ["get", "count"]]]] as unknown as number;
        created.addLayer({ id: "case-halo", type: "circle", source: "cases", paint: { "circle-radius": ["*", 2.3, radius] as unknown as number, "circle-color": HALO, "circle-opacity": 0.16, "circle-blur": 0.6 } });
        created.addLayer({ id: "case-dot", type: "circle", source: "cases", layout: { "circle-sort-key": ["-", 0, ["get", "count"]] }, paint: { "circle-radius": radius, "circle-color": DOT, "circle-opacity": 0.92, "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } });
        created.addLayer({ id: "case-count", type: "symbol", source: "cases", layout: { "text-field": ["to-string", ["get", "count"]], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-allow-overlap": true, "text-ignore-placement": true }, paint: { "text-color": "#fff" } });
        const tip = new gl.Popup({ closeButton: false, closeOnClick: false, offset: 14, className: "ov-map-tip" });
        created.on("mousemove", "case-dot", (event) => {
          const feature = event.features?.[0]; if (!feature) return;
          created.getCanvas().style.cursor = "pointer";
          const { name, count, level } = feature.properties as { name: string; count: number; level: string };
          const body = document.createElement("div"); const title = document.createElement("b"); title.dir = "auto"; title.textContent = name;
          const line = document.createElement("span"); line.textContent = `${Number(count).toLocaleString()} case${Number(count) === 1 ? "" : "s"} · ${level} reference`;
          body.append(title, line);
          tip.setLngLat((feature.geometry as unknown as { coordinates: [number, number] }).coordinates).setDOMContent(body).addTo(created);
        });
        created.on("mouseleave", "case-dot", () => { created.getCanvas().style.cursor = ""; tip.remove(); });
        created.on("click", "case-dot", (event) => { const id = event.features?.[0]?.properties?.id; if (id !== undefined) pick.current(String(id)); });
        map.current = created;
        if (!cancelled) setState("ready");
      });
    }).catch(giveUp);
    return () => { cancelled = true; window.clearTimeout(timer); map.current = null; instance?.remove(); };
  }, []);

  useEffect(() => {
    const current = map.current;
    if (state !== "ready" || !current) return;
    (current.getSource("cases") as GeoJSONSource | undefined)?.setData(collection(marks));
    const lon = marks.map((mark) => mark.lon), lat = marks.map((mark) => mark.lat);
    const bounds: [number, number, number, number] = world ? [-150, -50, 170, 72] : [Math.min(EGYPT[0], ...lon) - 1.5, Math.min(EGYPT[1], ...lat) - 1, Math.max(EGYPT[2], ...lon) + 1.5, Math.max(EGYPT[3], ...lat) + 1];
    current.fitBounds(bounds, { padding: 40, maxZoom: 7, duration: 600 });
  }, [marks, world, state]);

  if (state === "failed") return <>{fallback}</>;
  return <div className="ov-map-gl" data-state={state} role="group" aria-label={label}><div ref={box} className="ov-map-gl-canvas" />{state === "loading" && <p className="ov-map-gl-wait">Loading map…</p>}</div>;
}
