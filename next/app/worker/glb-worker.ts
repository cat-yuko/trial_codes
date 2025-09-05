// glb-worker.ts
import { parentPort } from "worker_threads";
import * as THREE from "three";

// Worker 内で受け取る型
type EdgeTask = {
  positions: Float32Array;
  indices: Uint32Array;
};

// エッジ生成関数
function buildEdges(positions: Float32Array, indices: Uint32Array) {
  const faces: Array<{ a: number; b: number; c: number; n: THREE.Vector3 }> = [];
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  const posAttr = positions;

  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i], ib = indices[i + 1], ic = indices[i + 2];
    A.set(posAttr[ia * 3], posAttr[ia * 3 + 1], posAttr[ia * 3 + 2]);
    B.set(posAttr[ib * 3], posAttr[ib * 3 + 1], posAttr[ib * 3 + 2]);
    C.set(posAttr[ic * 3], posAttr[ic * 3 + 1], posAttr[ic * 3 + 2]);
    const n = new THREE.Vector3().subVectors(C, B).cross(new THREE.Vector3().subVectors(A, B)).normalize();
    faces.push({ a: ia, b: ib, c: ic, n });
  }

  type Edge = { v1: number; v2: number; f1: number; f2: number | -1 };
  const edgeMap = new Map<string, Edge>();
  const addEdge = (i1: number, i2: number, f: number) => {
    const a = Math.min(i1, i2), b = Math.max(i1, i2), k = `${a}_${b}`;
    const ex = edgeMap.get(k);
    if (ex) { if (ex.f2 === -1) ex.f2 = f; } 
    else edgeMap.set(k, { v1: a, v2: b, f1: f, f2: -1 });
  };
  faces.forEach((f, fi) => {
    addEdge(f.a, f.b, fi);
    addEdge(f.b, f.c, fi);
    addEdge(f.c, f.a, fi);
  });

  // edges を TypedArray に変換
  const edges = Array.from(edgeMap.values());
  const count = edges.length;
  const p1 = new Float32Array(count * 3), p2 = new Float32Array(count * 3);
  const n1 = new Float32Array(count * 3), n2 = new Float32Array(count * 3);
  const has2 = new Float32Array(count);

  const tmp = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const e = edges[i];
    tmp.set(posAttr[e.v1 * 3], posAttr[e.v1 * 3 + 1], posAttr[e.v1 * 3 + 2]);
    p1.set([tmp.x, tmp.y, tmp.z], i * 3);
    tmp.set(posAttr[e.v2 * 3], posAttr[e.v2 * 3 + 1], posAttr[e.v2 * 3 + 2]);
    p2.set([tmp.x, tmp.y, tmp.z], i * 3);

    const f1 = faces[e.f1].n; n1.set([f1.x, f1.y, f1.z], i * 3);
    if (e.f2 !== -1) {
      const f2 = faces[e.f2].n; n2.set([f2.x, f2.y, f2.z], i * 3);
      has2[i] = 1;
    } else has2[i] = 0;
  }

  return { p1, p2, n1, n2, has2, count };
}

// メインイベント
self.onmessage = (e: MessageEvent<EdgeTask>) => {
  const { positions, indices } = e.data;
  const result = buildEdges(positions, indices);
  self.postMessage(result, [result.p1.buffer, result.p2.buffer, result.n1.buffer, result.n2.buffer, result.has2.buffer]);
};
