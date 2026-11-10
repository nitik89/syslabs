"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type * as THREE_NS from "three";
import { behaviorOf, type NodeKind, type NodeStatus } from "@/lib/sim";
import { SCENE_FPS, SCENE_THEME, lightRenderer, makeLabel, skip3D, whenNearAndIdle } from "./hero-scene";
import { useTheme } from "@/components/shell/use-theme";

export interface ArchNode {
  id: string;
  kind: NodeKind;
  label: string;
  /** Canvas position (React Flow pixels). */
  x: number;
  y: number;
}
export interface ArchEdge {
  id: string;
  source: string;
  target: string;
}
/** Live run state: drives tower height, colour and request flow. Omit for an idle preview. */
export interface ArchState {
  nodes: Record<string, { utilization: number; status: NodeStatus; droppedRps: number; load: number }>;
  edgeFlows: Record<string, number>;
}

const STATUS_COLOR: Record<NodeStatus, number> = { idle: 0x4b5568, ok: 0x3fdc98, warn: 0xf5c451, crit: 0xf2574d };
const KIND_COLOR: Partial<Record<string, number>> = {
  client: 0xa58bf7,
  cache: 0x5fd6f2,
  cdn: 0x5fd6f2,
  queue: 0xf5c451,
  stream: 0xf5c451,
  sqlDb: 0x3fdc98,
  nosqlDb: 0x3fdc98,
  objectStore: 0x3fdc98,
};
const DEFAULT_COLOR = 0x4ea3ff;

/** World units per canvas pixel. */
const SCALE = 1 / 70;

/**
 * Any design in 3D. Components are towers placed where they sit on the canvas; with `state`, a tower's
 * height is how busy it is, its colour its health, and requests flow along each link in proportion to
 * its traffic (red ones fall where requests are dropped). Lazy-loads three.js; pauses off-screen.
 */
export function ArchScene({
  nodes,
  edges,
  state,
  fallback,
  className,
}: {
  nodes: ArchNode[];
  edges: ArchEdge[];
  state?: ArchState | null;
  fallback?: ReactNode;
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const { theme } = useTheme();
  // Rebuild the scene only when the design's shape changes, not on every tick.
  const shape = JSON.stringify([nodes.map((n) => [n.id, n.kind, n.label, Math.round(n.x), Math.round(n.y)]), edges.map((e) => [e.id, e.source, e.target])]);

  // While a component is being dragged the shape changes every frame: rebuild once it settles.
  const [built, setBuilt] = useState(shape);
  useEffect(() => {
    if (shape === built) return;
    const t = window.setTimeout(() => setBuilt(shape), 250);
    return () => window.clearTimeout(t);
  }, [shape, built]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    if (skip3D()) {
      void Promise.resolve().then(() => setFailed(true));
      return;
    }
    const [shapeNodes, shapeEdges] = JSON.parse(built) as [[string, NodeKind, string, number, number][], [string, string, string][]];
    if (shapeNodes.length === 0) return;
    let disposed = false;
    let cleanup = () => {};

    const cancelGate = whenNearAndIdle(mount, () => void import("three").then((THREE) => {
      if (disposed) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const renderer = lightRenderer(THREE);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.style.display = "block";
      renderer.domElement.setAttribute("aria-hidden", "true");
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
      scene.add(new THREE.HemisphereLight(0xbcd2ff, 0x0b0f17, 1.1));
      const key = new THREE.DirectionalLight(0xffffff, 1.5);
      key.position.set(4, 10, 6);
      scene.add(key);

      const disposables: { dispose: () => void }[] = [renderer];
      const track = <T extends { dispose: () => void }>(x: T) => {
        disposables.push(x);
        return x;
      };

      // Centre the design on the origin.
      const xs = shapeNodes.map((n) => n[3]);
      const ys = shapeNodes.map((n) => n[4]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const spanX = (Math.max(...xs) - Math.min(...xs)) * SCALE + 2.5;
      const spanZ = (Math.max(...ys) - Math.min(...ys)) * SCALE + 2.5;
      const world = (x: number, y: number) => new THREE.Vector3((x - cx) * SCALE, 0, (y - cy) * SCALE);

      const pal = SCENE_THEME[theme];
      const grid = new THREE.GridHelper(Math.max(spanX, spanZ) + 8, Math.round(Math.max(spanX, spanZ) + 8), pal.grid[0], pal.grid[1]);
      grid.position.y = -0.01;
      scene.add(grid);
      track(grid.geometry);

      const boxGeo = track(new THREE.BoxGeometry(1.2, 1, 1.2));
      const edgeGeo = track(new THREE.EdgesGeometry(boxGeo));
      type Tower = { id: string; pos: THREE_NS.Vector3; body: THREE_NS.Mesh; mat: THREE_NS.MeshStandardMaterial; edge: THREE_NS.LineBasicMaterial; label: THREE_NS.Sprite; base: number; client: boolean };
      const towers = new Map<string, Tower>();
      for (const [id, kind, label] of shapeNodes) {
        const n = shapeNodes.find((x) => x[0] === id)!;
        const behavior = behaviorOf(kind);
        const base = KIND_COLOR[behavior] ?? DEFAULT_COLOR;
        const mat = track(new THREE.MeshStandardMaterial({ color: base, transparent: true, opacity: pal.glass, roughness: 0.35, metalness: 0.1, emissive: base, emissiveIntensity: 0.25 }));
        const body = new THREE.Mesh(boxGeo, mat);
        const edge = track(new THREE.LineBasicMaterial({ color: base, transparent: true, opacity: 0.95 }));
        body.add(new THREE.LineSegments(edgeGeo, edge));
        const lbl = makeLabel(THREE, label.length > 22 ? `${label.slice(0, 21)}…` : label, "", theme);
        lbl.scale.multiplyScalar(0.8);
        track(lbl.material);
        track((lbl.material as THREE_NS.SpriteMaterial).map!);
        const group = new THREE.Group();
        const pos = world(n[3], n[4]);
        group.position.copy(pos);
        group.add(body, lbl);
        scene.add(group);
        towers.set(id, { id, pos, body, mat, edge, label: lbl, base, client: behavior === "client" });
      }

      const linkMat = track(new THREE.LineBasicMaterial({ color: pal.link }));
      const links = shapeEdges
        .filter(([, s, t]) => towers.has(s) && towers.has(t))
        .map(([id, s, t]) => {
          const a = towers.get(s)!.pos.clone().setY(0.08);
          const b = towers.get(t)!.pos.clone().setY(0.08);
          scene.add(new THREE.Line(track(new THREE.BufferGeometry().setFromPoints([a, b])), linkMat));
          return { id, source: s, target: t, a: a.clone().setY(0.35), b: b.clone().setY(0.35), len: a.distanceTo(b), carry: 0 };
        });

      // Request packets, pooled.
      const packetGeo = track(new THREE.SphereGeometry(0.075, 10, 8));
      type Packet = { mesh: THREE_NS.Mesh; mat: THREE_NS.MeshBasicMaterial; link: (typeof links)[number] | null; u: number; drop: boolean; fall: number };
      const pool: Packet[] = Array.from({ length: 90 }, () => {
        const mat = track(new THREE.MeshBasicMaterial({ color: DEFAULT_COLOR, transparent: true }));
        const mesh = new THREE.Mesh(packetGeo, mat);
        mesh.visible = false;
        scene.add(mesh);
        return { mesh, mat, link: null, u: 0, drop: false, fall: 0 };
      });

      const resize = () => {
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        camera.aspect = w / h;
        // Fit the design's footprint: pull back until its width and depth are both in view.
        const vFov = (camera.fov * Math.PI) / 180;
        const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
        // Leave headroom for tall (overloaded) towers and their labels.
        const need = Math.max(spanX / 2 / Math.tan(hFov / 2), (spanZ + 5) / 2 / Math.tan(vFov / 2), 8);
        const dist = need * 1.15;
        camera.position.set(0, dist * 0.62, dist * 0.85);
        camera.lookAt(0, 0.9, 0);
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(mount);

      const tmp = new THREE.Color();
      let elapsed = 0;
      const frame = (dt: number) => {
        elapsed += dt;
        const st = stateRef.current;
        const maxFlow = st ? Math.max(1, ...Object.values(st.edgeFlows)) : 1;
        for (const tw of towers.values()) {
          const ns = st?.nodes[tw.id];
          const util = ns && !tw.client ? Math.min(ns.utilization, 2.5) : 0;
          const target = ns ? (tw.client ? 0.6 : 0.45 + util * 1.1) : tw.client ? 0.6 : 0.8;
          const h = THREE.MathUtils.lerp(tw.body.scale.y, target, Math.min(1, dt * 6) || 1);
          tw.body.scale.y = h;
          tw.body.position.y = h / 2;
          tw.label.position.y = h + 0.55;
          const color = ns && !tw.client && ns.status !== "idle" ? STATUS_COLOR[ns.status] : tw.base;
          tmp.setHex(color);
          tw.mat.color.copy(tmp);
          tw.mat.emissive.copy(tmp);
          const hot = ns?.status === "crit";
          tw.mat.emissiveIntensity = hot ? 0.45 + 0.3 * (0.5 + 0.5 * Math.sin(elapsed * 9)) : 0.25;
          tw.edge.color.copy(tmp);
          tw.body.position.x = hot && !reduced ? Math.sin(elapsed * 40) * 0.02 : 0;
        }
        if (dt > 0) {
          for (const l of links) {
            const flow = st ? (st.edgeFlows[l.id] ?? 0) : 1;
            if (flow <= 0) continue;
            // Packets per second: a log scale so a 100× busier link looks busier but doesn't flood.
            const rate = st ? 0.6 + 5 * Math.log10(1 + (9 * flow) / maxFlow) : 1.6;
            l.carry += rate * dt;
            while (l.carry >= 1) {
              l.carry -= 1;
              const p = pool.find((x) => !x.link);
              if (!p) break;
              const ts = st?.nodes[l.target];
              const dropShare = ts && ts.load > 0 ? Math.min(1, ts.droppedRps / ts.load) : 0;
              p.link = l;
              p.u = 0;
              p.fall = 0;
              p.drop = Math.random() < dropShare;
              p.mat.color.setHex(towers.get(l.target)?.base === 0x5fd6f2 ? 0x5fd6f2 : DEFAULT_COLOR);
              p.mat.opacity = 1;
              p.mesh.visible = true;
            }
          }
          for (const p of pool) {
            if (!p.link) continue;
            if (p.fall > 0) {
              p.fall += dt;
              p.mesh.position.y -= dt * 2.2;
              p.mat.opacity = Math.max(0, 1 - p.fall * 1.5);
              if (p.fall > 0.7) {
                p.link = null;
                p.mesh.visible = false;
              }
              continue;
            }
            p.u += (dt * 3) / Math.max(0.5, p.link.len);
            if (p.u >= 1) {
              p.link = null;
              p.mesh.visible = false;
              continue;
            }
            p.mesh.position.lerpVectors(p.link.a, p.link.b, p.u);
            p.mesh.position.y += Math.sin(p.u * Math.PI) * 0.15;
            if (p.drop && p.u > 0.8) {
              p.mat.color.setHex(STATUS_COLOR.crit);
              p.fall = 0.0001;
            }
          }
        }
        renderer.render(scene, camera);
      };

      let raf = 0;
      let visible = true;
      let last = performance.now();
      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        if (now - last < 1000 / SCENE_FPS - 2) return;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        frame(dt);
      };
      const start = () => {
        if (raf || !visible || document.hidden) return;
        last = performance.now();
        raf = requestAnimationFrame(tick);
      };
      const stop = () => {
        cancelAnimationFrame(raf);
        raf = 0;
      };
      // Reduced motion: no packets, but towers still follow the run (redrawn a few times a second).
      const slow = reduced ? window.setInterval(() => frame(0), 250) : 0;
      const io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible && !reduced) start();
        else stop();
      });
      io.observe(mount);
      const onVis = () => (document.hidden ? stop() : !reduced && start());
      document.addEventListener("visibilitychange", onVis);
      frame(0);
      if (!reduced) start();
      setReady(true);

      cleanup = () => {
        stop();
        window.clearInterval(slow);
        io.disconnect();
        ro.disconnect();
        document.removeEventListener("visibilitychange", onVis);
        for (const d of disposables) d.dispose();
        renderer.domElement.remove();
      };
    }, () => setFailed(true)));

    return () => {
      disposed = true;
      cancelGate();
      cleanup();
    };
  }, [built, theme]);

  // Skipped (phone, low-power device, no WebGL) and nothing to show instead: take no space.
  if (failed && !fallback) return null;
  return (
    <div className={className} style={{ position: "relative" }}>
      <div ref={mountRef} className="absolute inset-0" />
      {(!ready || failed) && fallback && <div className="absolute inset-0">{fallback}</div>}
    </div>
  );
}

/** Scene input from a saved design (graph plus canvas positions). */
export function archFromGraph(
  graph: { nodes: { id: string; kind: NodeKind; label?: string }[]; edges: { id: string; source: string; target: string }[] },
  positions: Record<string, { x: number; y: number }> | undefined,
): { nodes: ArchNode[]; edges: ArchEdge[] } {
  return {
    nodes: graph.nodes.map((n, i) => ({
      id: n.id,
      kind: n.kind,
      label: n.label?.trim() || n.id,
      x: positions?.[n.id]?.x ?? i * 260,
      y: positions?.[n.id]?.y ?? 0,
    })),
    edges: graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}
