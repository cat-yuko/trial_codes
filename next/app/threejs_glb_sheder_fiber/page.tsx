"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, useProgress, Html } from "@react-three/drei";

type MaterialMode = "hidden" | "solid" | "dashed";
type BaseMode = "original" | "transparent" | "white" | "hidden";

export default function GLBShaderSilhouetteEdges() {
  // === UI state ===
  const [silhouetteEnabled, setSilhouetteEnabled] = useState(true);
  const [threshold, setThreshold] = useState(30); // degrees for hard edges

  type MaterialControl = {
    id: string; // material.uuid
    name: string;
    edgeMode: MaterialMode;
    baseMode: BaseMode;
  };
  const [materialControls, setMaterialControls] = useState<MaterialControl[]>(
    []
  );

  // DnD container ref (外側 div). Canvas はこの中に入れる
  const containerRef = useRef<HTMLDivElement | null>(null);

  // マップ等の保持（imperative objects）
  const materialToMeshesRef = useRef<Map<string, THREE.Mesh[]>>(new Map());
  const whiteMaterialCache = useRef<Map<string, THREE.Material>>(new Map());
  const edgePassesRef = useRef<
    {
      parentMesh: THREE.Mesh;
      geom: THREE.InstancedBufferGeometry;
      mesh: THREE.LineSegments;
      count: number;
      uniforms: Record<string, THREE.IUniform>;
    }[]
  >([]);

  // GLTF file -> load and build passes (we call from UI)
  const handleFileLoad = useCallback(
    (file: File, scene: THREE.Scene, camera: THREE.Camera) => {
      // This function mirrors original loadGLBFile but is adapted to R3F usage.
      // Clear previous
      if (!scene) return;

      // dispose previous group & passes
      const prevGroup = scene.getObjectByName("gltf_group") as
        | THREE.Group
        | undefined;
      if (prevGroup) {
        scene.remove(prevGroup);
        disposeObject(prevGroup);
      }
      for (const ep of edgePassesRef.current) {
        try {
          ep.geom.dispose();
          (ep.mesh.material as THREE.Material).dispose();
          scene.remove(ep.mesh);
        } catch (e) {}
      }
      edgePassesRef.current = [];
      materialToMeshesRef.current.clear();
      setMaterialControls([]);
      whiteMaterialCache.current.forEach((mat) => mat.dispose());
      whiteMaterialCache.current.clear();

      const url = URL.createObjectURL(file);
      const loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => {
          URL.revokeObjectURL(url);
          const group = new THREE.Group();
          group.name = "gltf_group";
          group.add(gltf.scene);
          scene.add(group);

          // frame camera similar to original
          const box = new THREE.Box3().setFromObject(group);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);
          group.position.sub(center);

          // adjust camera framing (caller passes camera)
          if (
            camera &&
            (camera as THREE.PerspectiveCamera).isPerspectiveCamera
          ) {
            const cam = camera as THREE.PerspectiveCamera;
            const radius = Math.max(size.x, size.y, size.z) * 0.6 || 1;
            cam.position.set(radius * 2.2, radius * 1.6, radius * 2.6);
            cam.near = radius / 1000;
            cam.far = radius * 1000;
            cam.updateProjectionMatrix();
          }

          const mats: MaterialControl[] = [];
          const seen = new Set<string>();

          group.traverse((o) => {
            const m = o as THREE.Mesh;
            if (!m.isMesh) return;

            const matArray = Array.isArray(m.material)
              ? (m.material as THREE.Material[])
              : [m.material as THREE.Material];

            matArray.forEach((mat) => {
              if (!mat) return;
              if (!seen.has(mat.uuid)) {
                seen.add(mat.uuid);
                mats.push({
                  id: mat.uuid,
                  name:
                    (mat as any).name || `${(mat as any).type || "Material"}`,
                  edgeMode: "solid",
                  baseMode: "original",
                });
                materialToMeshesRef.current.set(mat.uuid, [m]);
              } else {
                // add mesh to mapping
                const arr = materialToMeshesRef.current.get(mat.uuid);
                if (arr) arr.push(m);
              }
            });
          });

          setMaterialControls(mats);

          // build edge passes for each mesh
          group.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh) return;
            if (!mesh.geometry) return;

            const pass = buildEdgePassForMesh(
              mesh,
              silhouetteEnabled,
              threshold
            );
            if (pass) {
              edgePassesRef.current.push(pass);
              scene.add(pass.mesh);
              (mesh as any).userData.edgeLine = pass.mesh;
            }
          });
        },
        undefined,
        (err) => console.error(err)
      );
    },
    [silhouetteEnabled, threshold]
  );

  // DnD handlers
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onDrop = (e: DragEvent) => {
      prevent(e);
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      if (
        file.name.toLowerCase().endsWith(".glb") ||
        file.name.toLowerCase().endsWith(".gltf")
      ) {
        // we cannot call handleFileLoad here because we don't have scene/camera; instead user will click choose file or use file input
        // but we still forward the event into a hidden file input approach:
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".glb,.gltf";
        input.onchange = () => {
          const f = input.files?.[0];
          if (f) {
            // try to find canvas scene via document query: use a custom event dispatched to Canvas component
            const ev = new CustomEvent("glb-drop-file", { detail: f });
            window.dispatchEvent(ev);
          }
        };
        // create a DataTransfer to set file (works in modern browsers)
        // fallback: if we already have file, dispatch event directly
        const ev = new CustomEvent("glb-drop-file", { detail: file });
        window.dispatchEvent(ev);
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

  // file picker
  const onPickFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".glb,.gltf";
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) {
        const ev = new CustomEvent("glb-drop-file", { detail: f });
        window.dispatchEvent(ev);
      }
    };
    input.click();
  };

  // Apply material controls -> this needs to modify meshes already in the scene.
  // We listen to materialControls changes and update meshes in materialToMeshesRef.
  useEffect(() => {
    // if no meshes loaded yet just return
    if (!materialToMeshesRef.current.size) return;

    // For each material control, adjust baseMode and edge visibility similar to original
    materialToMeshesRef.current.forEach((meshes, matUuid) => {
      const ctrl = materialControls.find((c) => c.id === matUuid);
      if (!ctrl) {
        // default restore
        meshes.forEach((mesh) => {
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          mats.forEach((mat) => {
            if ((mat as any).__origOpacity != null) {
              (mat as any).opacity = (mat as any).__origOpacity;
              (mat as any).transparent =
                (mat as any).__origTransparent || false;
              (mat as any).depthWrite = (mat as any).__origDepthWrite ?? true;
            }
            (mat as any).needsUpdate = true;
            (mat as any).visible = true;
            if (
              (mesh as any).userData.whiteOverlays &&
              (mesh as any).userData.whiteOverlays[mat.uuid]
            ) {
              (mesh as any).userData.whiteOverlays[mat.uuid].visible = false;
            }
          });
        });
        return;
      }

      meshes.forEach((mesh) => {
        const matArray = Array.isArray(mesh.material)
          ? (mesh.material as THREE.Material[])
          : [mesh.material as THREE.Material];
        matArray.forEach((mat) => {
          if (!mat) return;
          switch (ctrl.baseMode) {
            case "original":
              if ((mat as any).__origOpacity != null) {
                (mat as any).opacity = (mat as any).__origOpacity;
                (mat as any).transparent =
                  (mat as any).__origTransparent || false;
                (mat as any).depthWrite = (mat as any).__origDepthWrite ?? true;
              }
              mat.visible = true;
              (mat as any).needsUpdate = true;
              if (
                (mesh as any).userData.whiteOverlays &&
                (mesh as any).userData.whiteOverlays[mat.uuid]
              ) {
                (mesh as any).userData.whiteOverlays[mat.uuid].visible = false;
              }
              break;
            case "transparent":
              if ((mat as any).__origOpacity == null) {
                (mat as any).__origOpacity = (mat as any).opacity ?? 1.0;
                (mat as any).__origTransparent =
                  (mat as any).transparent ?? false;
                (mat as any).__origDepthWrite = (mat as any).depthWrite ?? true;
              }
              mat.visible = true;
              (mat as any).transparent = true;
              (mat as any).opacity = 0.25;
              (mat as any).depthWrite = false;
              (mat as any).needsUpdate = true;
              if (
                (mesh as any).userData.whiteOverlays &&
                (mesh as any).userData.whiteOverlays[mat.uuid]
              ) {
                (mesh as any).userData.whiteOverlays[mat.uuid].visible = false;
              }
              break;
            case "hidden":
              mat.visible = false;
              (mat as any).needsUpdate = true;
              if (
                (mesh as any).userData.whiteOverlays &&
                (mesh as any).userData.whiteOverlays[mat.uuid]
              ) {
                (mesh as any).userData.whiteOverlays[mat.uuid].visible = false;
              }
              break;
            case "white":
              mat.visible = true;
              (mat as any).needsUpdate = true;
              if (!(mesh as any).userData.whiteOverlays)
                (mesh as any).userData.whiteOverlays = {};
              if (!(mesh as any).userData.whiteOverlays[mat.uuid]) {
                // create overlay (as in original)
                let whiteMat = whiteMaterialCache.current.get(mat.uuid);
                if (!whiteMat) {
                  whiteMat = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.6,
                    depthTest: false,
                    depthWrite: false,
                  });
                  whiteMaterialCache.current.set(mat.uuid, whiteMat);
                }
                const geomOrig = mesh.geometry as THREE.BufferGeometry;
                const overlayGeom = geomOrig.clone();
                overlayGeom.deleteAttribute?.("normal");
                overlayGeom.deleteAttribute?.("uv");
                overlayGeom.computeBoundingSphere?.();

                // compute drawRange like original (groups)
                const groups = (geomOrig as any).groups as
                  | { start: number; count: number; materialIndex?: number }[]
                  | undefined;
                let materialIndex = -1;
                if (Array.isArray(mesh.material)) {
                  materialIndex = (mesh.material as THREE.Material[]).findIndex(
                    (mm) => mm && (mm as any).uuid === mat.uuid
                  );
                } else {
                  materialIndex = 0;
                }
                if (groups && groups.length > 0) {
                  let start = Infinity;
                  let end = -Infinity;
                  let any = false;
                  for (const g of groups) {
                    const gMatIndex =
                      g.materialIndex != null
                        ? g.materialIndex
                        : groups.indexOf(g);
                    if (gMatIndex === materialIndex) {
                      any = true;
                      start = Math.min(start, g.start);
                      end = Math.max(end, g.start + g.count);
                    }
                  }
                  if (any) {
                    overlayGeom.setDrawRange(start, Math.max(0, end - start));
                  } else {
                    const idxCount =
                      geomOrig.getIndex()?.count ??
                      geomOrig.getAttribute("position").count;
                    overlayGeom.setDrawRange(0, idxCount);
                  }
                } else {
                  const idxCount =
                    geomOrig.getIndex()?.count ??
                    geomOrig.getAttribute("position").count;
                  overlayGeom.setDrawRange(0, idxCount);
                }

                const overlay = new THREE.Mesh(overlayGeom, whiteMat);
                overlay.frustumCulled = false;
                overlay.visible = false;
                overlay.renderOrder = 999;
                (overlay.material as THREE.Material).depthTest = false;
                (overlay.material as THREE.Material).depthWrite = false;
                mesh.add(overlay);
                (mesh as any).userData.whiteOverlays[mat.uuid] = overlay;
              }
              (mesh as any).userData.whiteOverlays[mat.uuid].visible = true;
              break;
          }
        });
      });
    });

    // EDGE: toggle edge passes that belong to meshes using the material
    const ctrlMap = new Map<string, { show: boolean; dashed: boolean }>();
    for (const c of materialControls) {
      ctrlMap.set(c.id, {
        show: c.edgeMode !== "hidden",
        dashed: c.edgeMode === "dashed",
      });
    }
    for (const ep of edgePassesRef.current) {
      const mesh = ep.parentMesh;
      const matArray = Array.isArray(mesh.material)
        ? (mesh.material as THREE.Material[])
        : [mesh.material as THREE.Material];

      let show = false;
      let dashed = false;
      for (const mat of matArray) {
        const v = ctrlMap.get(mat.uuid);
        if (v) {
          if (v.show) show = true;
          if (v.dashed) dashed = true;
        }
      }
      ep.mesh.visible = show;
      if (ep.uniforms.uDashed) ep.uniforms.uDashed.value = dashed ? 1.0 : 0.0;
    }
  }, [materialControls, silhouetteEnabled, threshold]);

  // Render UI + R3F Canvas
  return (
    <div className="h-screen w-screen bg-zinc-50 flex flex-col">
      {/* Header / Controls */}
      <div className="px-4 py-2 border-b border-zinc-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">
            GLB Shader Silhouette (WebGL2) — R3F Version
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

      <div className="flex h-screen overflow-hidden" ref={containerRef}>
        {/* Sidebar */}
        <div className="w-72 shrink-0 border-r border-zinc-200 bg-white overflow-y-auto p-4">
          <h2 className="font-semibold mb-2">Materials</h2>
          {materialControls.length === 0 && (
            <div className="text-sm text-zinc-500">No materials loaded</div>
          )}
          {materialControls.map((mat, i) => (
            <div key={mat.id} className="mb-4 p-2 border rounded-lg">
              <div className="font-medium text-sm mb-1">{mat.name}</div>

              <div className="text-xs text-zinc-600 mb-1">Edge</div>
              <div className="flex gap-2 flex-wrap">
                {(["hidden", "solid", "dashed"] as const).map((mode) => (
                  <label key={mode} className="flex items-center gap-1 text-sm">
                    <input
                      type="radio"
                      name={`edge-${mat.id}`}
                      checked={mat.edgeMode === mode}
                      onChange={() =>
                        setMaterialControls((prev) =>
                          prev.map((m, j) =>
                            j === i ? { ...m, edgeMode: mode } : m
                          )
                        )
                      }
                    />
                    {mode}
                  </label>
                ))}
              </div>

              <div className="text-xs text-zinc-600 mt-2 mb-1">Base</div>
              <div className="flex flex-col gap-1">
                {(["original", "transparent", "white", "hidden"] as const).map(
                  (mode) => (
                    <label
                      key={mode}
                      className="flex items-center gap-1 text-sm"
                    >
                      <input
                        type="radio"
                        name={`base-${mat.id}`}
                        checked={mat.baseMode === mode}
                        onChange={() =>
                          setMaterialControls((prev) =>
                            prev.map((m, j) =>
                              j === i ? { ...m, baseMode: mode } : m
                            )
                          )
                        }
                      />
                      {mode}
                    </label>
                  )
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Canvas area (react-three-fiber) */}
        <div className="relative flex-1">
          <R3FCanvas
            onFileLoad={handleFileLoad}
            silhouetteEnabled={silhouetteEnabled}
            threshold={threshold}
            edgePassesRef={edgePassesRef}
            containerRef={containerRef}
          />
        </div>
      </div>

      <div className="px-4 py-2 text-xs text-zinc-500 bg-white border-t border-zinc-200">
        GPUシェーダーで視点依存のシルエットとハードエッジを判定・描画しています。
      </div>
    </div>
  );
}

/**
 * Canvas wrapper component
 * - sets up lights, grid, orbitcontrols
 * - listens to global "glb-drop-file" event to receive File objects from UI
 * - calls onFileLoad(file, scene, camera) when a file arrives
 */
function R3FCanvas({
  onFileLoad,
  silhouetteEnabled,
  threshold,
  edgePassesRef,
  containerRef,
}: {
  onFileLoad: (file: File, scene: THREE.Scene, camera: THREE.Camera) => void;
  silhouetteEnabled: boolean;
  threshold: number;
  edgePassesRef: any;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  // we set gl={{ antialias:true, powerPreference:"high-performance" }} and request WebGL2 if available
  // react-three-fiber creates WebGLRenderer; we check gl.getContext().getParameter to confirm version optionally.
  return (
    <Canvas
      frameloop="always"
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [6, 4, 8], fov: 55 }}
      onCreated={({ gl, scene, camera }) => {
        // optional: warn if not WebGL2
        try {
          const ctx = gl.getContext();
          // @ts-ignore
          const isWebGL2 =
            !!ctx &&
            typeof (ctx as any).getParameter === "function" &&
            (ctx as any).VERSION?.includes?.("WebGL 2");
          // we won't forcibly abort if not WebGL2, but keep user aware
          // console.info("WebGL2 available:", isWebGL2);
        } catch (e) {}
        // subscribe to file drop event
        const handler = (ev: Event) => {
          const f = (ev as CustomEvent).detail as File | undefined;
          if (f) onFileLoad(f, scene, camera);
        };
        window.addEventListener("glb-drop-file", handler as EventListener);
        return () =>
          window.removeEventListener("glb-drop-file", handler as EventListener);
      }}
    >
      <SceneContent
        silhouetteEnabled={silhouetteEnabled}
        threshold={threshold}
        edgePassesRef={edgePassesRef}
        containerRef={containerRef}
        onFileLoad={onFileLoad}
      />
    </Canvas>
  );
}

/** Scene content: lights, grid, orbit controls, and frame updater */
function SceneContent({
  silhouetteEnabled,
  threshold,
  edgePassesRef,
  containerRef,
  onFileLoad,
}: {
  silhouetteEnabled: boolean;
  threshold: number;
  edgePassesRef: any;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onFileLoad: (file: File, scene: THREE.Scene, camera: THREE.Camera) => void;
}) {
  const { scene, camera, gl } = useThree();

  // lights + grid
  useEffect(() => {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 7);
    scene.add(dir);
    const grid = new THREE.GridHelper(50, 50, 0xaaaaaa, 0xdddddd);
    grid.position.y = -0.001;
    scene.add(grid);

    return () => {
      scene.remove(hemi);
      scene.remove(dir);
      scene.remove(grid);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // orbit controls (drei)
  return (
    <>
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        screenSpacePanning={false}
        minDistance={1}
        maxDistance={2000}
      />
      <SceneFrameUpdater
        silhouetteEnabled={silhouetteEnabled}
        threshold={threshold}
        edgePassesRef={edgePassesRef}
      />
      <DropFileListener onFileLoad={onFileLoad} />
    </>
  );
}

/** listens to the global event to receive dropped/selected files in window scope,
 * then finds the current scene/camera via useThree and calls onFileLoad */
function DropFileListener({
  onFileLoad,
}: {
  onFileLoad: (file: File, scene: THREE.Scene, camera: THREE.Camera) => void;
}) {
  const { scene, camera } = useThree();
  useEffect(() => {
    const handler = (ev: Event) => {
      const f = (ev as CustomEvent).detail as File | undefined;
      if (f) onFileLoad(f, scene, camera);
    };
    window.addEventListener("glb-drop-file", handler as EventListener);
    return () =>
      window.removeEventListener("glb-drop-file", handler as EventListener);
  }, [onFileLoad, scene, camera]);
  return null;
}

/** Update loop: sync uniforms each frame (camera pos, modelMatrix, normalMatrix, UI state) */
function SceneFrameUpdater({
  silhouetteEnabled,
  threshold,
  edgePassesRef,
}: {
  silhouetteEnabled: boolean;
  threshold: number;
  edgePassesRef: any;
}) {
  const { camera } = useThree();

  useFrame(() => {
    if (!camera) return;
    if (edgePassesRef.current && edgePassesRef.current.length) {
      for (const ep of edgePassesRef.current) {
        if (!ep || !ep.parentMesh) continue;
        if (ep.uniforms.uCameraPosition)
          ep.uniforms.uCameraPosition.value.copy(camera.position);
        ep.parentMesh.updateWorldMatrix(true, false);
        if (ep.uniforms.uModelMatrix)
          ep.uniforms.uModelMatrix.value.copy(ep.parentMesh.matrixWorld);
        if (ep.uniforms.uNormalMatrix)
          ep.uniforms.uNormalMatrix.value.getNormalMatrix(
            ep.parentMesh.matrixWorld
          );
        if (ep.uniforms.uSilhouetteEnabled)
          ep.uniforms.uSilhouetteEnabled.value = silhouetteEnabled ? 1 : 0;
        if (ep.uniforms.uHardCos)
          ep.uniforms.uHardCos.value = Math.cos((threshold * Math.PI) / 180);
      }
    }
  });

  return null;
}

/* ---------- Utility functions (converted from original) ---------- */

/** Build edge pass for a single mesh (largely same as original implementation) */
function buildEdgePassForMesh(
  parentMesh: THREE.Mesh,
  silhouetteEnabled: boolean,
  threshold: number
) {
  let src = parentMesh.geometry as THREE.BufferGeometry;
  let g = src.clone().toNonIndexed();
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  g = BufferGeometryUtils.mergeVertices(g, 1e-6);

  if (!g.index) {
    const count = g.attributes.position.count;
    g.setIndex([...Array(count).keys()]);
  }

  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const index = g.getIndex()!;

  const faces: Array<{ a: number; b: number; c: number; n: THREE.Vector3 }> =
    [];
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const C = new THREE.Vector3();
  for (let i = 0; i < index.count; i += 3) {
    const ia = index.getX(i),
      ib = index.getX(i + 1),
      ic = index.getX(i + 2);
    A.fromBufferAttribute(pos, ia);
    B.fromBufferAttribute(pos, ib);
    C.fromBufferAttribute(pos, ic);
    const n = new THREE.Vector3()
      .subVectors(C, B)
      .cross(new THREE.Vector3().subVectors(A, B))
      .normalize();
    faces.push({ a: ia, b: ib, c: ic, n });
  }

  type Edge = { v1: number; v2: number; f1: number; f2: number | -1 };
  const edgeMap = new Map<string, Edge>();
  const addEdge = (i1: number, i2: number, f: number) => {
    const a = Math.min(i1, i2),
      b = Math.max(i1, i2);
    const k = `${a}_${b}`;
    const ex = edgeMap.get(k);
    if (ex) {
      if (ex.f2 === -1) ex.f2 = f;
    } else {
      edgeMap.set(k, { v1: a, v2: b, f1: f, f2: -1 });
    }
  };
  faces.forEach((f, fi) => {
    addEdge(f.a, f.b, fi);
    addEdge(f.b, f.c, fi);
    addEdge(f.c, f.a, fi);
  });

  const edges = Array.from(edgeMap.values());
  if (edges.length === 0) return null;

  // Instanced geometry
  const base = new THREE.BufferGeometry();
  base.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(new Float32Array([0, 0, 0, 0, 0, 0]), 3)
  );

  const geom = new THREE.InstancedBufferGeometry();
  geom.index = null;
  geom.attributes = base.attributes;

  const count = edges.length;
  const p1 = new Float32Array(count * 3);
  const p2 = new Float32Array(count * 3);
  const n1 = new Float32Array(count * 3);
  const n2 = new Float32Array(count * 3);
  const has2 = new Float32Array(count);

  const tmp = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const e = edges[i];
    const off3 = i * 3;
    tmp.fromBufferAttribute(pos, e.v1);
    p1[off3 + 0] = tmp.x;
    p1[off3 + 1] = tmp.y;
    p1[off3 + 2] = tmp.z;
    tmp.fromBufferAttribute(pos, e.v2);
    p2[off3 + 0] = tmp.x;
    p2[off3 + 1] = tmp.y;
    p2[off3 + 2] = tmp.z;

    const f1 = faces[e.f1].n;
    n1[off3 + 0] = f1.x;
    n1[off3 + 1] = f1.y;
    n1[off3 + 2] = f1.z;

    if (e.f2 !== -1) {
      const f2 = faces[e.f2].n;
      n2[off3 + 0] = f2.x;
      n2[off3 + 1] = f2.y;
      n2[off3 + 2] = f2.z;
      has2[i] = 1;
    } else {
      has2[i] = 0;
    }
  }

  geom.setAttribute("instanceP1", new THREE.InstancedBufferAttribute(p1, 3));
  geom.setAttribute("instanceP2", new THREE.InstancedBufferAttribute(p2, 3));
  geom.setAttribute("instanceN1", new THREE.InstancedBufferAttribute(n1, 3));
  geom.setAttribute("instanceN2", new THREE.InstancedBufferAttribute(n2, 3));
  geom.setAttribute(
    "instanceHasN2",
    new THREE.InstancedBufferAttribute(has2, 1)
  );
  geom.instanceCount = count;

  const materialId = (parentMesh.material as any).uuid;

  const uniforms: Record<string, THREE.IUniform> = {
    uCameraPosition: { value: new THREE.Vector3() },
    uModelMatrix: { value: new THREE.Matrix4() },
    uNormalMatrix: { value: new THREE.Matrix3() },
    uColor: { value: new THREE.Color(0xff00ff) },
    uSilhouetteEnabled: { value: silhouetteEnabled ? 1 : 0 },
    uHardCos: { value: Math.cos((threshold * Math.PI) / 180) },
    uMaterialId: { value: materialId },
    uDashed: { value: 0.0 },
    uLineWidth: { value: 0.02 },
    uDashSize: { value: 0.1 },
  };

  const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms,
    depthTest: true,
    depthWrite: false,
    transparent: true,
    vertexShader: `
      precision highp float;
      layout(location = 0) in vec3 position;
      in vec3 instanceP1;
      in vec3 instanceP2;
      in vec3 instanceN1;
      in vec3 instanceN2;
      in float instanceHasN2;

      uniform mat4 projectionMatrix;
      uniform mat4 viewMatrix;
      uniform mat4 uModelMatrix;
      uniform mat3 uNormalMatrix;
      uniform vec3 uCameraPosition;
      uniform float uHardCos;
      uniform int uSilhouetteEnabled;
      uniform float uLineWidth;
      uniform float uDashSize;

      out float vVisible;
      out float vLineLength;
      out float vLineU;

      void main() {
        vec3 P = (gl_VertexID == 0) ? instanceP1 : instanceP2;
        vec3 mid = (instanceP1 + instanceP2) * 0.5;
        vec4 midW = uModelMatrix * vec4(mid, 1.0);
        vec3 V = normalize(uCameraPosition - midW.xyz);
        vec3 n1w = normalize(uNormalMatrix * instanceN1);
        float visibleSil = 0.0;
        if (uSilhouetteEnabled == 1) {
          if (instanceHasN2 < 0.5) {
            visibleSil = 1.0;
          } else {
            vec3 n2w = normalize(uNormalMatrix * instanceN2);
            float dotNormals = dot(n1w, n2w);
            float s1 = sign(dot(n1w, V));
            float s2 = sign(dot(n2w, V));
            bool orth = abs(dotNormals) < 1e-3;
            bool anti = (dotNormals <= uHardCos);
            bool facingOpp = (s1 * s2 < 0.0);
            visibleSil = (orth || anti || facingOpp) ? 1.0 : 0.0;
          }
        }
        vVisible = visibleSil;
        vec4 Pw = uModelMatrix * vec4(P, 1.0);

        vLineLength = length(instanceP2 - instanceP1);
        vLineU = gl_VertexID==0?0.0:1.0;

        gl_Position = projectionMatrix * viewMatrix * Pw;
      }
    `,
    fragmentShader: `
      precision highp float;

      uniform vec3 uColor;
      uniform float uDashed;
      uniform float uLineWidth;
      uniform float uDashSize;

      in float vVisible;
      in float vLineU;
      out vec4 outColor;

      void main() {
        if (vVisible < 0.5) discard;

        if (uDashed > 0.5) {
          float pattern = mod(vLineU, uDashSize * 2.0) / uDashSize;
          if(pattern>1.0) discard;
        }
        float alpha = 1.0;
        outColor = vec4(uColor, alpha);
      }
    `,
  });

  const lineMesh = new THREE.LineSegments(geom, material);
  lineMesh.frustumCulled = false;

  return { parentMesh, geom, mesh: lineMesh, count, uniforms };
}

/** Dispose object tree (geometry/materials) */
function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if ((child as any).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) {
        try {
          mesh.geometry.dispose();
        } catch (e) {}
      }
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat) => {
          try {
            mat.dispose();
          } catch (e) {}
        });
      } else if (mesh.material) {
        try {
          mesh.material.dispose();
        } catch (e) {}
      }
      if ((mesh as any).overlay) {
        const overlay = (mesh as any).overlay as THREE.LineSegments;
        mesh.remove(overlay);
        if (overlay.geometry) {
          try {
            overlay.geometry.dispose();
          } catch (e) {}
        }
      }
    }
  });
}
