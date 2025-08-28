/**
 * 試作品　途中
 */
"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

/**
 * Drop this component into a Next.js App Router page (e.g., app/page.tsx)
 * TailwindCSS required. No external UI libs. Single-file, minimal, production-lean.
 */
export default function GLBEdgesSilhouette() {
  // UI state
  const [edgesEnabled, setEdgesEnabled] = useState(true);
  const [silhouetteEnabled, setSilhouetteEnabled] = useState(true);
  const [threshold, setThreshold] = useState(5); // degrees for EdgesGeometry
  //const [status, setStatus] = useState("Drop a .glb here or click to choose");

  // DOM & 3D refs
  const mountRef = useRef<HTMLDivElement | null>(null);
  const canvasOverlayRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);

  // Data structures for silhouette
  type Face = { a: number; b: number; c: number };
  type EdgeKey = string; // "minIndex_maxIndex"
  type AdjEdge = { v1: number; v2: number; f1: number; f2: number | null };
  type SilhouetteCache = {
    mesh: THREE.Mesh;
    geom: THREE.BufferGeometry;
    worldMatrix: THREE.Matrix4;
    faces: Face[]; // per-face vertex indices
    edges: AdjEdge[]; // adjacency edges
    posAttr: THREE.BufferAttribute; // position attribute (vec3)
    // pre-allocated buffers reused per-frame
    worldPositions: Float32Array; // length = posAttr.count * 3
    faceNormal: THREE.Vector3[]; // per-face normal (world space)
    faceCenter: THREE.Vector3[]; // per-face center (world space)
    lineSegments: THREE.LineSegments; // silhouette lines holder
    hardEdgeLines: THREE.LineSegments | null; // hard edges layer (EdgesGeometry)
  };
  const silhouetteCachesRef = useRef<SilhouetteCache[]>([]);

  // Helpers
  const disposeObject = (obj: THREE.Object3D) => {
    obj.traverse((o) => {
      const m = (o as any).material as
        | THREE.Material
        | THREE.Material[]
        | undefined;
      const g = (o as any).geometry as THREE.BufferGeometry | undefined;
      if (Array.isArray(m)) m.forEach((mm) => mm?.dispose());
      else m?.dispose?.();
      g?.dispose?.();
    });
  };

  // Init Three.js
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4f4f5);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      55,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      5000
    );
    camera.position.set(6, 4, 8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(
      mountRef.current.clientWidth,
      mountRef.current.clientHeight
    );
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 2000;
    controlsRef.current = controls;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    const grid = new THREE.GridHelper(50, 50, 0xaaaaaa, 0xdddddd);
    grid.position.y = -0.001; // avoid z-fighting
    scene.add(grid);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      // update silhouettes if enabled
      if (silhouetteEnabled) updateSilhouettes();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!rendererRef.current || !cameraRef.current || !mountRef.current)
        return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      rendererRef.current.setSize(w, h);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement && mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // File handling (drag & drop)
  useEffect(() => {
    const el = canvasOverlayRef.current;
    if (!el) return;
    const prevent = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const onDrop = (e: DragEvent) => {
      prevent(e);
      const file = e.dataTransfer?.files?.[0];
      if (file && file.name.toLowerCase().endsWith(".glb")) {
        loadGLBFile(file);
      } else {
        //setStatus("Please drop a .glb file");
      }
    };

    el.addEventListener("dragenter", prevent);
    el.addEventListener("dragover", prevent);
    el.addEventListener("drop", onDrop);

    return () => {
      el.removeEventListener("dragenter", prevent);
      el.removeEventListener("dragover", prevent);
      el.removeEventListener("drop", onDrop);
    };
  }, []);

  const onPickFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".glb";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) loadGLBFile(file);
    };
    input.click();
  };

  // Load GLB
  const loadGLBFile = (file: File) => {
    if (!sceneRef.current) return;
    //setStatus(`Loading: ${file.name}`);

    // Clear previous
    if (modelGroupRef.current) {
      sceneRef.current.remove(modelGroupRef.current);
      disposeObject(modelGroupRef.current);
      modelGroupRef.current = null;
    }
    silhouetteCachesRef.current.forEach((c) => {
      c.lineSegments.geometry.dispose();
      (c.lineSegments.material as THREE.Material).dispose();
      c.hardEdgeLines?.geometry.dispose();
      (c.hardEdgeLines?.material as THREE.Material | undefined)?.dispose?.();
    });
    silhouetteCachesRef.current = [];

    const url = URL.createObjectURL(file);
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        URL.revokeObjectURL(url);
        const group = new THREE.Group();
        group.name = "ModelRoot";
        group.add(gltf.scene);

        // normalize / frame camera
        const box = new THREE.Box3().setFromObject(group);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);
        group.position.sub(center);

        // push to scene
        sceneRef.current!.add(group);
        modelGroupRef.current = group;

        // prep caches per mesh
        group.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            const geom = mesh.geometry as THREE.BufferGeometry;

            // 元のマテリアルを半透明にする
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((mat) => {
                mat.transparent = true;
                mat.opacity = 0.3; // お好みの透過度
                mat.depthWrite = false; // Silhouetteの前面描画のため
              });
            } else {
              mesh.material.transparent = true;
              mesh.material.opacity = 0.3;
              mesh.material.depthWrite = false;
            }

            // Ensure index
            if (!geom.index)
              geom.setIndex([...Array(geom.attributes.position.count).keys()]);
            const index = geom.index!;
            const posAttr = geom.attributes.position as THREE.BufferAttribute;

            // Build faces
            const faces: Face[] = [];
            for (let i = 0; i < index.count; i += 3) {
              const a = index.getX(i);
              const b = index.getX(i + 1);
              const c = index.getX(i + 2);
              faces.push({ a, b, c });
            }

            // Build adjacency map (unique undirected edges)
            const edgeMap = new Map<EdgeKey, AdjEdge>();
            const addEdge = (i1: number, i2: number, f: number) => {
              const a = Math.min(i1, i2);
              const b = Math.max(i1, i2);
              const key = `${a}_${b}`;
              const ex = edgeMap.get(key);
              if (ex) {
                if (ex.f2 === null) ex.f2 = f; // second face
              } else {
                edgeMap.set(key, { v1: a, v2: b, f1: f, f2: null });
              }
            };
            faces.forEach((face, fi) => {
              addEdge(face.a, face.b, fi);
              addEdge(face.b, face.c, fi);
              addEdge(face.c, face.a, fi);
            });
            const edges = Array.from(edgeMap.values());

            // Allocate per-frame buffers
            const worldPositions = new Float32Array(posAttr.count * 3);
            const faceNormal: THREE.Vector3[] = new Array(faces.length);
            const faceCenter: THREE.Vector3[] = new Array(faces.length);
            for (let i = 0; i < faces.length; i++) {
              faceNormal[i] = new THREE.Vector3();
              faceCenter[i] = new THREE.Vector3();
            }

            // Hard Edges (EdgesGeometry)
            const hardEdgesGeom = new THREE.EdgesGeometry(geom, threshold);
            const hardEdgesMat = new THREE.LineBasicMaterial({
              color: 0x000000,
            });
            const hardEdgeLines = new THREE.LineSegments(
              hardEdgesGeom,
              hardEdgesMat
            );
            hardEdgeLines.visible = edgesEnabled;
            mesh.add(hardEdgeLines);

            // Silhouette holder (empty, to be filled each frame)
            const silGeo = new THREE.BufferGeometry();
            const silMat = new THREE.LineBasicMaterial({
              color: "#ff00ff",
              depthTest: false, // 深度テスト無効
              transparent: true,
              opacity: 1,
            });
            const lineSegments = new THREE.LineSegments(silGeo, silMat);
            lineSegments.frustumCulled = false; // generated every frame
            lineSegments.visible = silhouetteEnabled;
            mesh.add(lineSegments);

            silhouetteCachesRef.current.push({
              mesh,
              geom,
              worldMatrix: new THREE.Matrix4(),
              faces,
              edges,
              posAttr,
              worldPositions,
              faceNormal,
              faceCenter,
              lineSegments,
              hardEdgeLines,
            });
          }
        });

        // Fit camera
        if (cameraRef.current && controlsRef.current) {
          const radius = Math.max(size.x, size.y, size.z) * 0.6 || 1;
          const cam = cameraRef.current;
          controlsRef.current.target.set(0, 0, 0);
          cam.position.set(radius * 2.2, radius * 1.6, radius * 2.6);
          cam.near = radius / 1000;
          cam.far = radius * 1000;
          cam.updateProjectionMatrix();
          controlsRef.current.update();
        }

        //setStatus("Loaded. Toggle Edges/Silhouette as you like.");
      },
      undefined,
      (err) => {
        console.error(err);
        //setStatus("Failed to load GLB");
      }
    );
  };

  // Rebuild hard edges when threshold changes
  useEffect(() => {
    silhouetteCachesRef.current.forEach((c) => {
      // replace hard edges geometry
      if (c.hardEdgeLines) {
        c.hardEdgeLines.geometry.dispose();
        c.hardEdgeLines.geometry = new THREE.EdgesGeometry(c.geom, threshold);
        c.hardEdgeLines.visible = edgesEnabled;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold]);

  // Toggle visibility via UI
  useEffect(() => {
    silhouetteCachesRef.current.forEach((c) => {
      if (c.hardEdgeLines) c.hardEdgeLines.visible = edgesEnabled;
      c.lineSegments.visible = silhouetteEnabled;
    });
  }, [edgesEnabled, silhouetteEnabled]);

  // Silhouette update per-frame
  const updateSilhouettes = () => {
    if (!cameraRef.current) return;
    const cameraPos = cameraRef.current.position.clone();

    silhouetteCachesRef.current.forEach((c) => {
      const { mesh, posAttr, faces, edges } = c;

      // Update world matrix
      mesh.updateWorldMatrix(true, false);
      c.worldMatrix.copy(mesh.matrixWorld);

      // Transform all positions to world space once
      // worldPositions[idx*3 + k]
      const v = new THREE.Vector3();
      for (let i = 0; i < posAttr.count; i++) {
        v.fromBufferAttribute(posAttr, i);
        v.applyMatrix4(c.worldMatrix);
        const off = i * 3;
        c.worldPositions[off] = v.x;
        c.worldPositions[off + 1] = v.y;
        c.worldPositions[off + 2] = v.z;
      }

      // Compute per-face normals & centers (world space)
      const va = new THREE.Vector3();
      const vb = new THREE.Vector3();
      const vc = new THREE.Vector3();
      for (let i = 0; i < faces.length; i++) {
        const f = faces[i];
        const a = f.a * 3,
          b = f.b * 3,
          cidx = f.c * 3;
        va.set(
          c.worldPositions[a],
          c.worldPositions[a + 1],
          c.worldPositions[a + 2]
        );
        vb.set(
          c.worldPositions[b],
          c.worldPositions[b + 1],
          c.worldPositions[b + 2]
        );
        vc.set(
          c.worldPositions[cidx],
          c.worldPositions[cidx + 1],
          c.worldPositions[cidx + 2]
        );
        // normal
        const n = c.faceNormal[i];
        n.copy(vc).sub(vb).cross(va.clone().sub(vb)).normalize();
        // center
        const center = c.faceCenter[i];
        center
          .copy(va)
          .add(vb)
          .add(vc)
          .multiplyScalar(1 / 3);
      }

      // Determine which edges are silhouette: faces with opposite facing
      const positions: number[] = [];
      const view = new THREE.Vector3();
      for (let ei = 0; ei < edges.length; ei++) {
        const e = edges[ei];
        const f1 = e.f1;
        const f2 = e.f2; // may be null (boundary)

        // face -> facing sign
        // s1 = 面 f1 の法線がカメラ方向に対して表か裏か（+1 表 / -1 裏）
        const s1 = (() => {
          view.copy(cameraPos).sub(c.faceCenter[f1]).normalize();
          return Math.sign(c.faceNormal[f1].dot(view));
        })();
        // s2 = 隣接面 f2 の法線がカメラ方向に対して表か裏か（+1 表 / -1 裏 / null 境界）
        const s2 =
          f2 !== null
            ? (() => {
                view.copy(cameraPos).sub(c.faceCenter[f2!]).normalize();
                return Math.sign(c.faceNormal[f2!].dot(view));
              })()
            : null;

        // isSilhouette = 表裏の差や境界によって、その辺がシルエットになるかどうか
        //const isSilhouette = s2 === null ? s1 > 0 : s1 * (s2 as number) < 0;
        const EPSILON = 1e-6; // 法線がほぼ平行か判定

        const isSilhouette = (() => {
          if (f2 === null) {
            // 境界エッジは常に線
            return true;
          } else {
            const normal1 = c.faceNormal[f1];
            const normal2 = c.faceNormal[f2];

            // 法線がほぼ平行ならシルエットにしない
            const dotNormals = normal1.dot(normal2);
            if (Math.abs(dotNormals - 1) < EPSILON) return false;

            // 法線が90°以上離れていれば線を引く
            if (dotNormals < 0) return true;

            // 従来の正面・裏面の判定
            return s1 * s2 < 0;
          }
        })();
        if (!isSilhouette) continue;

        const o1 = e.v1 * 3;
        const o2 = e.v2 * 3;
        positions.push(
          c.worldPositions[o1],
          c.worldPositions[o1 + 1],
          c.worldPositions[o1 + 2],
          c.worldPositions[o2],
          c.worldPositions[o2 + 1],
          c.worldPositions[o2 + 2]
        );
      }

      // Update line segments geometry
      const g = new THREE.BufferGeometry();
      if (positions.length > 0) {
        g.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(positions, 3)
        );
      } else {
        // at least an empty attribute to avoid warnings
        g.setAttribute("position", new THREE.Float32BufferAttribute([], 3));
      }
      c.lineSegments.geometry.dispose();
      c.lineSegments.geometry = g;
    });
  };

  return (
    <div className="h-screen w-screen bg-zinc-50 flex flex-col">
      {/* Header / Controls */}
      <div className="px-4 py-2 border-b border-zinc-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">
            GLB Edges + Silhouette Viewer
          </h1>
          <button
            className="px-3 py-1.5 text-sm rounded-xl border border-zinc-300 hover:bg-zinc-100"
            onClick={onPickFile}
          >
            Choose GLB
          </button>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-black"
              checked={edgesEnabled}
              onChange={(e) => setEdgesEnabled(e.target.checked)}
            />
            <span>Hard Edges</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-black"
              checked={silhouetteEnabled}
              onChange={(e) => setSilhouetteEnabled(e.target.checked)}
            />
            <span>Silhouette</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span>Threshold</span>
            <input
              type="range"
              min={0}
              max={60}
              step={1}
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
            />
            <span className="tabular-nums w-8 text-right">{threshold}°</span>
          </label>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="relative flex-1" ref={mountRef}>
        {/* Drag & Drop overlay */}
        <div
          ref={canvasOverlayRef}
          className="pointer-events-none absolute inset-0 flex items-center justify-center border-2 border-dashed border-zinc-300 hover:border-zinc-400 transition-colors"
        >
          {/*
          <div className="backdrop-blur-sm bg-white/60 px-4 py-2 rounded-xl text-sm text-zinc-700">
            {status}
          </div>
          */}
        </div>
      </div>

      <div className="px-4 py-2 text-xs text-zinc-500 bg-white border-t border-zinc-200">
        Tip: Toggle on/off each layer. Silhouette updates as the camera moves
        (view-dependent).
      </div>
    </div>
  );
}
