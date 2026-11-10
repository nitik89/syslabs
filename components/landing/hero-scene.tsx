"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type * as THREE_NS from "three";
import type { Theme } from "@/lib/theme";
import { useTheme } from "@/components/shell/use-theme";

export type HeroPhase = "broken" | "fixed";

/** Seconds in one loop: the database melts down, a cache drops in, traffic recovers. */
const LOOP = 16;
const FIX_AT = 7.5;
const CACHE_LANDED = 8.6;
const LIFT_AT = 15.2;

const COLOR = {
  blue: 0x4ea3ff,
  cyan: 0x5fd6f2,
  violet: 0xa58bf7,
  ok: 0x3fdc98,
  crit: 0xf2574d,
  dim: 0x2a3446,
  label: "rgba(235,240,250,0.92)",
  sub: "rgba(160,172,192,0.85)",
};

type Vec = [number, number, number];

const NODES: { id: string; label: string; sub: string; pos: Vec; color: number; h: number }[] = [
  { id: "users", label: "Shoppers", sub: "5,000 req/s", pos: [-4.8, 0, 0], color: COLOR.violet, h: 0.7 },
  { id: "lb", label: "Load Balancer", sub: "", pos: [-1.6, 0, 0], color: COLOR.blue, h: 0.7 },
  { id: "api", label: "Catalog API", sub: "", pos: [1.6, 0, 0], color: COLOR.blue, h: 0.9 },
  { id: "db", label: "Products DB", sub: "max 1,000 req/s", pos: [4.8, 0, 0], color: COLOR.ok, h: 1 },
];
const CACHE_POS: Vec = [3.2, 0, -3.4];

/** A text label drawn to a canvas and shown as a sprite that always faces the camera. */
/** Scene colours that change with the light/dark theme. */
export const SCENE_THEME = {
  dark: { label: "rgba(235,240,250,0.92)", sub: "rgba(160,172,192,0.85)", grid: [0x1d2636, 0x141b27] as const, fog: 0x07090d, link: 0x2a3446, glass: 0.32 },
  light: { label: "rgba(28,36,52,0.92)", sub: "rgba(88,99,118,0.9)", grid: [0xc3ccda, 0xdfe5ee] as const, fog: 0xf4f6f9, link: 0xb3bfd0, glass: 0.5 },
};

export function makeLabel(THREE: typeof THREE_NS, text: string, sub: string, theme: Theme = "dark"): THREE_NS.Sprite {
  const pal = SCENE_THEME[theme];
  const scale = 4;
  const w = 220 * scale;
  const h = 64 * scale;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.fillStyle = pal.label;
  ctx.font = `600 ${24 * scale}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(text, w / 2, 26 * scale);
  if (sub) {
    ctx.fillStyle = pal.sub;
    ctx.font = `500 ${15 * scale}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillText(sub, w / 2, 50 * scale);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(3.1, 0.9, 1);
  return sprite;
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}


/**
 * True when 3D should be skipped for a lighter page: no WebGL, a phone-sized screen, a low-power device
 * (4 or fewer cores, or 4 GB or less memory), or Data Saver on. Those visitors get the 2D fallback.
 */
export function skip3D(): boolean {
  if (typeof window === "undefined" || !webglAvailable()) return true;
  if (window.matchMedia("(max-width: 767px)").matches) return true;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if ((nav.hardwareConcurrency ?? 8) <= 4) return true;
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 4) return true;
  return nav.connection?.saveData === true;
}

/** Run `cb` once `el` is near the viewport and the browser is idle, so three.js never competes with page load. */
export function whenNearAndIdle(el: Element, cb: () => void): () => void {
  let idle = 0;
  let timer = 0;
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      if ("requestIdleCallback" in window) idle = window.requestIdleCallback(cb, { timeout: 2000 });
      else timer = globalThis.setTimeout(cb, 300) as unknown as number;
    },
    { rootMargin: "200px" },
  );
  io.observe(el);
  return () => {
    io.disconnect();
    if (idle) window.cancelIdleCallback(idle);
    window.clearTimeout(timer);
  };
}

/** Frames per second for the 3D scenes: smooth enough for drifting packets, half the GPU work of 60. */
export const SCENE_FPS = 30;

/** A renderer tuned for light pages: pixel density capped at 1.5, antialiasing only on standard screens. */
export function lightRenderer(THREE: typeof THREE_NS): THREE_NS.WebGLRenderer {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const renderer = new THREE.WebGLRenderer({ antialias: dpr < 1.5, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(dpr);
  return renderer;
}

/**
 * The landing page's 3D hero: an overloaded database turns red and drops requests, then a cache lands
 * beside the API and traffic recovers. Loops, pauses off-screen, and holds still for reduced motion.
 * Renders `fallback` until three.js has loaded, and keeps it if WebGL isn't available.
 */
export function HeroScene({ onPhase, fallback, className }: { onPhase?: (p: HeroPhase) => void; fallback?: ReactNode; className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(onPhase);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // Rebuilt when the theme changes, so labels and the floor match the page.
  const { theme } = useTheme();

  useEffect(() => {
    phaseRef.current = onPhase;
  }, [onPhase]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    if (skip3D()) {
      void Promise.resolve().then(() => setFailed(true));
      return;
    }
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
      const pal = SCENE_THEME[theme];
      scene.fog = new THREE.Fog(pal.fog, 14, 26);
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);

      scene.add(new THREE.HemisphereLight(0xbcd2ff, 0x0b0f17, 1.1));
      const key = new THREE.DirectionalLight(0xffffff, 1.6);
      key.position.set(4, 9, 6);
      scene.add(key);

      // Floor: a faint grid on a dark plate.
      const grid = new THREE.GridHelper(22, 22, pal.grid[0], pal.grid[1]);
      grid.position.y = -0.01;
      scene.add(grid);

      const disposables: { dispose: () => void }[] = [renderer];
      const track = <T extends { dispose: () => void }>(x: T) => {
        disposables.push(x);
        return x;
      };

      // Components: glassy boxes with bright edges, height = how hard they're working.
      const boxGeo = track(new THREE.BoxGeometry(1.5, 1, 1.5));
      const edgeGeo = track(new THREE.EdgesGeometry(boxGeo));
      type NodeMesh = { group: THREE_NS.Group; body: THREE_NS.Mesh; mat: THREE_NS.MeshStandardMaterial; edge: THREE_NS.LineBasicMaterial; label: THREE_NS.Sprite };
      const makeNode = (color: number, label: string, sub: string): NodeMesh => {
        const group = new THREE.Group();
        const mat = track(new THREE.MeshStandardMaterial({ color, transparent: true, opacity: pal.glass, roughness: 0.35, metalness: 0.1, emissive: color, emissiveIntensity: 0.25 }));
        const body = new THREE.Mesh(boxGeo, mat);
        const edge = track(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }));
        body.add(new THREE.LineSegments(edgeGeo, edge));
        group.add(body);
        const lbl = makeLabel(THREE, label, sub, theme);
        track(lbl.material);
        track((lbl.material as THREE_NS.SpriteMaterial).map!);
        group.add(lbl);
        scene.add(group);
        return { group, body, mat, edge, label: lbl };
      };
      const nodes = Object.fromEntries(NODES.map((n) => [n.id, { ...makeNode(n.color, n.label, n.sub), spec: n }]));
      for (const n of NODES) nodes[n.id].group.position.set(...n.pos);
      const cache = makeNode(COLOR.cyan, "Redis Cache", "90% hit ratio");
      cache.group.position.set(...CACHE_POS);

      const setHeight = (m: NodeMesh, h: number) => {
        m.body.scale.y = h;
        m.body.position.y = h / 2;
        m.label.position.y = h + 0.7;
      };

      // Links between components.
      const linkMat = track(new THREE.LineBasicMaterial({ color: pal.link, transparent: true, opacity: 0.9 }));
      const link = (a: Vec, b: Vec) => {
        const g = track(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a[0], 0.08, a[2]), new THREE.Vector3(b[0], 0.08, b[2])]));
        const line = new THREE.Line(g, linkMat);
        scene.add(line);
        return line;
      };
      link(NODES[0].pos, NODES[1].pos);
      link(NODES[1].pos, NODES[2].pos);
      link(NODES[2].pos, NODES[3].pos);
      const cacheLinkMat = track(new THREE.LineBasicMaterial({ color: COLOR.cyan, transparent: true, opacity: 0 }));
      const cacheLinkGeo = track(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(NODES[2].pos[0], 0.08, 0), new THREE.Vector3(CACHE_POS[0], 0.08, CACHE_POS[2])]));
      scene.add(new THREE.Line(cacheLinkGeo, cacheLinkMat));

      // Requests: small glowing packets riding the links.
      const packetGeo = track(new THREE.SphereGeometry(0.09, 12, 8));
      type Packet = { mesh: THREE_NS.Mesh; mat: THREE_NS.MeshBasicMaterial; path: THREE_NS.Vector3[]; seg: number; u: number; drop: boolean; fall: number; live: boolean };
      const pool: Packet[] = [];
      for (let i = 0; i < 50; i++) {
        const mat = track(new THREE.MeshBasicMaterial({ color: COLOR.blue, transparent: true }));
        const mesh = new THREE.Mesh(packetGeo, mat);
        mesh.visible = false;
        scene.add(mesh);
        pool.push({ mesh, mat, path: [], seg: 0, u: 0, drop: false, fall: 0, live: false });
      }
      const at = (p: Vec, y = 0.35) => new THREE.Vector3(p[0], y, p[2]);
      const spawn = (fixed: boolean) => {
        const p = pool.find((x) => !x.live);
        if (!p) return;
        const toCache = fixed && Math.random() < 0.88;
        const jitter = (Math.random() - 0.5) * 0.5;
        p.path = [at(NODES[0].pos), at(NODES[1].pos), at(NODES[2].pos), toCache ? at(CACHE_POS) : at(NODES[3].pos)].map((v) => v.add(new THREE.Vector3(0, 0, jitter)));
        p.seg = 0;
        p.u = 0;
        p.fall = 0;
        // Before the fix most requests to the database are rejected: it can take 1,000 of 5,000 a second.
        p.drop = !fixed && Math.random() < 0.8;
        p.live = true;
        p.mat.color.setHex(toCache ? COLOR.cyan : COLOR.blue);
        p.mat.opacity = 1;
        p.mesh.visible = true;
      };

      const resize = () => {
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        camera.aspect = w / h;
        // Narrow cards: pull the camera back so the whole pipeline fits.
        const dist = w / h < 1.3 ? 15.5 : 12.5;
        camera.position.set(-1.2, dist * 0.62, dist);
        camera.lookAt(0.4, 0.4, -0.6);
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(mount);

      const red = new THREE.Color(COLOR.crit);
      const green = new THREE.Color(COLOR.ok);
      const tmp = new THREE.Color();
      let lastPhase: HeroPhase | null = null;

      /** Draw the scene at loop time `t` (seconds), advancing packets by `dt`. */
      const frame = (t: number, dt: number) => {
        const fixed = t >= FIX_AT && t < LIFT_AT + 0.6;
        const phase: HeroPhase = t >= FIX_AT && t < LIFT_AT ? "fixed" : "broken";
        if (phase !== lastPhase) {
          lastPhase = phase;
          phaseRef.current?.(phase);
        }

        // The database: tall, red and shaking while overloaded; calm and green once the cache takes the reads.
        const k = THREE.MathUtils.smoothstep(t, FIX_AT, CACHE_LANDED) * (1 - THREE.MathUtils.smoothstep(t, LIFT_AT, LOOP));
        const db = nodes.db;
        const pulse = 0.5 + 0.5 * Math.sin(t * 9);
        setHeight(db, THREE.MathUtils.lerp(2.3 + pulse * 0.12, 1.05, k));
        tmp.copy(red).lerp(green, k);
        db.mat.color.copy(tmp);
        db.mat.emissive.copy(tmp);
        db.mat.emissiveIntensity = THREE.MathUtils.lerp(0.45 + pulse * 0.35, 0.25, k);
        db.edge.color.copy(tmp);
        db.body.position.x = (1 - k) * Math.sin(t * 40) * 0.025;
        setHeight(nodes.api, THREE.MathUtils.lerp(1.5, 1.05, k));
        setHeight(nodes.lb, 0.8);
        setHeight(nodes.users, 0.6);

        // The cache drops in from above, and lifts away as the loop restarts.
        const land = THREE.MathUtils.smoothstep(t, FIX_AT, CACHE_LANDED);
        const lift = THREE.MathUtils.smoothstep(t, LIFT_AT, LOOP);
        cache.group.position.y = (1 - land) * 5 + lift * 5;
        cache.group.visible = t > FIX_AT - 0.1;
        cache.mat.opacity = pal.glass * (1 - lift);
        cache.edge.opacity = 0.95 * (1 - lift);
        (cache.label.material as THREE_NS.SpriteMaterial).opacity = land * (1 - lift);
        setHeight(cache, 1.1);
        cacheLinkMat.opacity = 0.9 * land * (1 - lift);

        // Traffic.
        if (dt > 0) {
          const rate = 8;
          if (Math.random() < rate * dt) spawn(fixed && land > 0.95);
          for (const p of pool) {
            if (!p.live) continue;
            if (p.fall > 0) {
              p.fall += dt;
              p.mesh.position.y -= dt * 2.4;
              p.mesh.position.x += dt * 0.6;
              p.mat.opacity = Math.max(0, 1 - p.fall * 1.4);
              if (p.fall > 0.75) {
                p.live = false;
                p.mesh.visible = false;
              }
              continue;
            }
            const a = p.path[p.seg];
            const b = p.path[p.seg + 1];
            const len = a.distanceTo(b);
            p.u += (dt * 3.6) / len;
            if (p.u >= 1) {
              p.seg += 1;
              p.u = 0;
              if (p.seg >= p.path.length - 1) {
                p.live = false;
                p.mesh.visible = false;
                continue;
              }
            }
            p.mesh.position.lerpVectors(p.path[p.seg], p.path[p.seg + 1], p.u);
            p.mesh.position.y += Math.sin(p.u * Math.PI) * 0.18;
            // Rejected at the database's door: turn red and fall.
            if (p.drop && !fixed && p.seg === p.path.length - 2 && p.u > 0.72) {
              p.mat.color.setHex(COLOR.crit);
              p.fall = 0.0001;
            }
          }
        }

        // A gentle camera sway so the scene reads as 3D.
        if (!reduced) {
          const sway = Math.sin(t * ((2 * Math.PI) / LOOP)) * 0.9;
          camera.position.x = -1.2 + sway;
          camera.lookAt(0.4, 0.4, -0.6);
        }
        renderer.render(scene, camera);
      };

      // Animation: only while visible on screen and the tab is in the foreground.
      let raf = 0;
      let visible = true;
      let last = performance.now();
      let t = 0;
      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        if (now - last < 1000 / SCENE_FPS - 2) return;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        t = (t + dt) % LOOP;
        frame(t, dt);
      };
      const start = () => {
        if (raf || reduced || !visible || document.hidden) return;
        last = performance.now();
        raf = requestAnimationFrame(tick);
      };
      const stop = () => {
        cancelAnimationFrame(raf);
        raf = 0;
      };
      const io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible) start();
        else stop();
      });
      io.observe(mount);
      const onVis = () => (document.hidden ? stop() : start());
      document.addEventListener("visibilitychange", onVis);

      if (reduced) {
        // A still frame of the recovered system.
        frame(12, 0);
      } else {
        frame(0, 0);
        start();
      }
      setReady(true);

      cleanup = () => {
        stop();
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
  }, [theme]);

  // Skipped (phone, low-power device, no WebGL) and nothing to show instead: take no space.
  if (failed && !fallback) return null;
  return (
    <div className={className} style={{ position: "relative" }}>
      <div ref={mountRef} className="absolute inset-0" />
      {(!ready || failed) && <div className="absolute inset-0">{fallback}</div>}
    </div>
  );
}
