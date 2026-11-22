import { GEO } from "./data";
import type { Pt } from "./types";

/* ======================================================================
   Walking routes on the real street + walkway network (Dijkstra).
   ====================================================================== */
const G = {
  n: GEO.graph.n,
  adj: GEO.graph.n.map(() => [] as [number, number, number][]),
  edges: GEO.graph.e,
  names: GEO.graph.names,
  main: [] as [number, number, number][],
};
for (const [a, b, k] of G.edges) {
  const w = Math.hypot(G.n[a][0] - G.n[b][0], G.n[a][1] - G.n[b][1]);
  G.adj[a].push([b, w, k]);
  G.adj[b].push([a, w, k]);
}
/* keep only the largest connected street network, so every place can reach every other */
{
  const comp = new Int32Array(G.n.length).fill(-1);
  let best = -1, bestN = 0;
  for (let i = 0; i < G.n.length; i++) {
    if (comp[i] >= 0) continue;
    const st = [i];
    comp[i] = i;
    let n = 0;
    while (st.length) {
      const u = st.pop()!;
      n++;
      for (const [v] of G.adj[u]) if (comp[v] < 0) { comp[v] = i; st.push(v); }
    }
    if (n > bestN) { bestN = n; best = i; }
  }
  G.main = G.edges.filter(([A]) => comp[A] === best);
}

interface Snap { d: number; q: [number, number]; A: number; B: number; k: number }
function snap(pt: Pt): Snap {
  let best: Snap | null = null;
  for (const [A, B, k] of G.main) {
    const a = G.n[A], b = G.n[B];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = dx * dx + dy * dy;
    let t = L ? ((pt.x - a[0]) * dx + (pt.y - a[1]) * dy) / L : 0;
    t = Math.max(0, Math.min(1, t));
    const q: [number, number] = [a[0] + dx * t, a[1] + dy * t];
    const d = Math.hypot(pt.x - q[0], pt.y - q[1]);
    if (!best || d < best.d) best = { d, q, A, B, k };
  }
  return best!;
}
const snapCache = new Map<string, Snap>();
const snapOf = (p: Pt) => {
  const key = p.id || p.x + "," + p.y;
  if (!p.id || !snapCache.has(key)) snapCache.set(key, snap(p));
  return snapCache.get(key)!;
};

export interface Route {
  pts: [number, number][];
  meters: number;
  steps: { k: number; m: number }[];
}

export function route(from: Pt, to: Pt): Route | null {
  const s = snapOf(from), e = snapOf(to);
  const N = G.n.length, S = N, E = N + 1;
  const pos = (i: number): [number, number] => (i === S ? s.q : i === E ? e.q : G.n[i]);
  const ex = new Map<number, [number, number, number][]>();
  const add = (u: number, v: number, w: number, k: number) => {
    if (!ex.has(u)) ex.set(u, []);
    ex.get(u)!.push([v, w, k]);
  };
  for (const nd of [s.A, s.B]) add(S, nd, Math.hypot(s.q[0] - G.n[nd][0], s.q[1] - G.n[nd][1]), s.k);
  for (const nd of [e.A, e.B]) add(nd, E, Math.hypot(e.q[0] - G.n[nd][0], e.q[1] - G.n[nd][1]), e.k);
  if ((s.A === e.A && s.B === e.B) || (s.A === e.B && s.B === e.A)) add(S, E, Math.hypot(s.q[0] - e.q[0], s.q[1] - e.q[1]), s.k);

  const dist = new Map<number, number>([[S, 0]]);
  const prev = new Map<number, [number, number]>();
  const heap: [number, number][] = [[0, S]];
  const push = (x: [number, number]) => {
    heap.push(x);
    let i = heap.length - 1;
    while (i) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const done = new Set<number>();
  while (heap.length) {
    const [d, u] = pop();
    if (done.has(u)) continue;
    done.add(u);
    if (u === E) break;
    const nb = (u < N ? G.adj[u] : []).concat(ex.get(u) || []);
    for (const [v, w, k] of nb) {
      const nd = d + w;
      if (nd < (dist.get(v) ?? 1e15)) { dist.set(v, nd); prev.set(v, [u, k]); push([nd, v]); }
    }
  }
  if (!dist.has(E)) return null;
  const path: [number, number][] = [], legs: number[] = [];
  let c = E;
  while (c !== S) {
    const [u, k] = prev.get(c)!;
    path.push(pos(c));
    legs.push(k);
    c = u;
  }
  path.push(pos(S));
  path.reverse();
  legs.reverse();
  const steps: { k: number; m: number }[] = [];
  for (let i = 0; i < legs.length; i++) {
    const a = path[i], b = path[i + 1];
    const len = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const last = steps[steps.length - 1];
    if (last && last.k === legs[i]) last.m += len;
    else steps.push({ k: legs[i], m: len });
  }
  return { pts: [[from.x, from.y], ...path, [to.x, to.y]], meters: dist.get(E)! + s.d + e.d, steps: steps.filter((x) => x.m > 6) };
}

const walkCache = new Map<string, number>();
export const clearWalkCache = () => walkCache.clear();
/** Walking metres between two points (falls back to 1.3× straight line). */
export function walkM(a: Pt, b: Pt) {
  const key = (a.id || a.x + "," + a.y) + ">" + (b.id || b.x + "," + b.y);
  if (walkCache.has(key)) return walkCache.get(key)!;
  const r = route(a, b);
  const m = r ? r.meters : Math.hypot(a.x - b.x, a.y - b.y) * 1.3;
  if (a.id && b.id) walkCache.set(key, m);
  return m;
}

/** Nearest by walking distance among the 5 closest by straight line. */
export function nearest<T extends Pt>(from: Pt, list: T[]): { p: T; m: number } | null {
  const cand = list
    .filter((p) => p !== from)
    .map((p) => ({ p, d: Math.hypot(p.x - from.x, p.y - from.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 5);
  let best: { p: T; m: number } | null = null;
  for (const { p } of cand) {
    const m = walkM(from, p);
    if (!best || m < best.m) best = { p, m };
  }
  return best;
}

export const stepName = (k: number) => {
  const n = G.names[k] || "street";
  return n === "walkway" ? "the walkway" : n === "service road" ? "the side street" : n === "steps" ? "the steps" : n.replace(/^(East|West|North|South) /, (m) => m[0] + " ");
};
