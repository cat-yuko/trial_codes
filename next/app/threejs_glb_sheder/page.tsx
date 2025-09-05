"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

/**
 * WebGL2 + custom ShaderMaterial edge pass (instanced).
 * - CPU: 一度だけメッシュから隣接エッジと面法線(ローカル空間)を構築
 * - GPU: カメラ毎フレーム、視点依存のシルエット判定 + ハードエッジ判定をシェーダーで実行
 *
 * 注意: WebGL2 にはジオメトリシェーダーはありません。代替として「エッジごとのインスタンシング +
 *       gl_VertexID で両端点を出力する」方式を採用しています。
 *
 * 使い方: Next.js App Router のページにそのまま配置。Tailwind 前提。
 */
export default function GLBShaderSilhouetteEdges() {
  // === UI state ===
  const [edgesEnabled, setEdgesEnabled] = useState(true);
  const [silhouetteEnabled, setSilhouetteEnabled] = useState(true);
  const [threshold, setThreshold] = useState(5); // degrees for hard edges

  // === Refs ===
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);

  // エッジ描画用パス(複数メッシュ対応)。各メッシュごとに InstancedBufferGeometry + ShaderMaterial を保持
  type EdgePass = {
    parentMesh: THREE.Mesh;
    geom: THREE.InstancedBufferGeometry;
    mesh: THREE.Mesh;
    count: number; // instances
    uniforms: Record<string, THREE.IUniform>;
  };
  const edgePassesRef = useRef<EdgePass[]>([]);

  // === Init three ===
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
    // WebGL2 前提 (three は自動で WebGL2 を使います)。
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
    grid.position.y = -0.001;
    scene.add(grid);

    // === Animation loop ===
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();

      // カメラ・モデル行列をシェーダーへ更新
      if (cameraRef.current && edgePassesRef.current.length) {
        for (const ep of edgePassesRef.current) {
          ep.uniforms.uCameraPosition.value.copy(cameraRef.current.position);
          // メッシュのワールド行列
          ep.parentMesh.updateWorldMatrix(true, false);
          ep.uniforms.uModelMatrix.value.copy(ep.parentMesh.matrixWorld);
          // 法線行列 (uniform scale 前提なら modelMatrix でOKだが、ここでは正確に)
          ep.uniforms.uNormalMatrix.value.getNormalMatrix(
            ep.parentMesh.matrixWorld as any
          );
          // UI 状態
          ep.uniforms.uEdgesEnabled.value = edgesEnabled ? 1 : 0;
          ep.uniforms.uSilhouetteEnabled.value = silhouetteEnabled ? 1 : 0;
          ep.uniforms.uHardCos.value = Math.cos((threshold * Math.PI) / 180);
        }
      }

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

  // === File D&D ===
  useEffect(() => {
    const el = mountRef.current;
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
        loadGLBFile(file);
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
    input.accept = ".glb,.gltf";
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) loadGLBFile(f);
    };
    input.click();
  };

  // === Load GLB & build edge pass ===
  const loadGLBFile = (file: File) => {
    if (!sceneRef.current) return;

    // clear previous
    if (modelGroupRef.current) {
      sceneRef.current.remove(modelGroupRef.current);
      disposeObject(modelGroupRef.current);
      modelGroupRef.current = null;
    }
    for (const ep of edgePassesRef.current) {
      ep.geom.dispose();
      (ep.mesh.material as THREE.Material).dispose();
      sceneRef.current.remove(ep.mesh);
    }
    edgePassesRef.current = [];

    const url = URL.createObjectURL(file);
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        URL.revokeObjectURL(url);
        const group = new THREE.Group();
        group.add(gltf.scene);
        modelGroupRef.current = group;
        sceneRef.current!.add(group);

        // frame camera
        const box = new THREE.Box3().setFromObject(group);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        group.position.sub(center);

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

        // 半透明で本体を軽く表示（シルエットが見やすいように）
        group.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            const mat = m.material as THREE.Material | THREE.Material[];
            const makeTrans = (mm: THREE.Material) => {
              (mm as any).transparent = true;
              (mm as any).opacity = 0.3;
              (mm as any).depthWrite = false;
            };
            if (Array.isArray(mat)) mat.forEach(makeTrans);
            else if (mat) makeTrans(mat);
          }
        });

        // 各 Mesh からエッジパスを生成
        group.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          if (!mesh.geometry) return;

          const pass = buildEdgePassForMesh(mesh);
          if (pass) {
            edgePassesRef.current.push(pass);
            sceneRef.current!.add(pass.mesh);
          }
        });
      },
      undefined,
      (err) => console.error(err)
    );
  };

  // === Build edge pass for single mesh ===
  function buildEdgePassForMesh(parentMesh: THREE.Mesh): EdgePass | null {
    // (1) シルエット抽出用に頂点マージして共有エッジを復元
    let src = parentMesh.geometry as THREE.BufferGeometry;
    let g = src.clone().toNonIndexed();
    g.deleteAttribute("normal");
    g.deleteAttribute("uv");
    g = BufferGeometryUtils.mergeVertices(g, 1e-6);

    if (!g.index) {
      // 強制的に index 化（mergeVertices で index 付きになるが保険）
      const count = g.attributes.position.count;
      g.setIndex([...Array(count).keys()]);
    }

    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    const index = g.getIndex()!;

    // (2) 面と法線(ローカル空間)の配列を作る
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

    // (3) 隣接エッジ表を構築 (v1<v2 をキー)
    type Edge = {
      v1: number;
      v2: number;
      f1: number;
      f2: number | -1; // -1 = 境界
    };
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

    // (4) InstancedBufferGeometry 準備
    // ベースはダミーの2頂点（位置は使わず gl_VertexID だけ使う）
    const base = new THREE.BufferGeometry();
    base.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Float32Array([0, 0, 0, 0, 0, 0]), 3)
    );

    const geom = new THREE.InstancedBufferGeometry();
    geom.index = null; // 使わない
    geom.attributes = base.attributes; // 2頂点

    const count = edges.length; // instance 数 = エッジ数

    const p1 = new Float32Array(count * 3);
    const p2 = new Float32Array(count * 3);
    const n1 = new Float32Array(count * 3);
    const n2 = new Float32Array(count * 3);
    const has2 = new Float32Array(count);

    const tmp = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      const e = edges[i];
      const off3 = i * 3;

      // 頂点座標（ローカル）
      tmp.fromBufferAttribute(pos, e.v1);
      p1[off3 + 0] = tmp.x;
      p1[off3 + 1] = tmp.y;
      p1[off3 + 2] = tmp.z;
      tmp.fromBufferAttribute(pos, e.v2);
      p2[off3 + 0] = tmp.x;
      p2[off3 + 1] = tmp.y;
      p2[off3 + 2] = tmp.z;

      // 隣接面の法線（ローカル）
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
        // 境界: n2 は未使用
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

    // (5) ShaderMaterial
    const uniforms: Record<string, THREE.IUniform> = {
      uCameraPosition: { value: new THREE.Vector3() },
      uModelMatrix: { value: new THREE.Matrix4() },
      uNormalMatrix: { value: new THREE.Matrix3() },
      uColor: { value: new THREE.Color(0x000000) },
      uEdgesEnabled: { value: edgesEnabled ? 1 : 0 },
      uSilhouetteEnabled: { value: silhouetteEnabled ? 1 : 0 },
      uHardCos: { value: Math.cos((threshold * Math.PI) / 180) },
    };

    const material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms,
      depthTest: true,
      depthWrite: false,
      transparent: true,
      vertexShader: `
      precision highp float;
      layout(location = 0) in vec3 position; // dummy (2 verts)
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
      uniform float uHardCos; // cos(threshold)
      uniform int uEdgesEnabled;
      uniform int uSilhouetteEnabled;

      out float vVisible;

      void main() {
        // gl_VertexID: 0 -> P1, 1 -> P2
        vec3 P = (gl_VertexID == 0) ? instanceP1 : instanceP2;

        // 視点依存の判定: エッジ中点
        vec3 mid = (instanceP1 + instanceP2) * 0.5;
        vec4 midW = uModelMatrix * vec4(mid, 1.0);
        vec3 V = normalize(uCameraPosition - midW.xyz);

        // 法線をワールドへ
        vec3 n1w = normalize(uNormalMatrix * instanceN1);

        float visibleSil = 0.0;
        if (uSilhouetteEnabled == 1) {
          if (instanceHasN2 < 0.5) {
            visibleSil = 1.0; // 境界
          } else {
            vec3 n2w = normalize(uNormalMatrix * instanceN2);
            float dotNormals = dot(n1w, n2w);
            float s1 = sign(dot(n1w, V));
            float s2 = sign(dot(n2w, V));
            bool orth = abs(dotNormals) < 1e-3;  // 直交 ≒ 稜線
            bool anti = (dotNormals < 0.0);      // 90°超
            bool facingOpp = (s1 * s2 < 0.0);    // 片面表・片面裏
            visibleSil = (orth || anti || facingOpp) ? 1.0 : 0.0;
          }
        }

        // TODO ここの判定を見直す
        float visibleHard = 0.0;
        /*
        if (uEdgesEnabled == 1) {
          if (instanceHasN2 < 0.5) {
            visibleHard = 1.0; // 境界は常に
          } else {
            vec3 n2w = normalize(uNormalMatrix * instanceN2);
            float dotNormals = dot(n1w, n2w);
            // ハードエッジ判定: 法線角度 >= threshold
            visibleHard = (dotNormals <= uHardCos) ? 1.0 : 0.0;
          }
        }
          */

        vVisible = max(visibleSil, visibleHard);

        vec4 Pw = uModelMatrix * vec4(P, 1.0);
        gl_Position = projectionMatrix * viewMatrix * Pw;
      }
      `,
      fragmentShader: `
      precision highp float;
      uniform vec3 uColor;
      in float vVisible;
      out vec4 outColor;
      void main() {
        if (vVisible < 0.5) discard;
        outColor = vec4(1.0, 0.0, 0.0, 1.0);  // 強制的に赤で描画
      }
      `,
    });

    // 注意: WebGL の lineWidth は環境依存。必要ならクアッド拡張で画面空間太線にする実装へ拡張可。

    // 2頂点×instance の Line 構造として描画するため Mesh を使う（RawShaderMaterial が custom なので ok）
    //const mesh = new THREE.Mesh(geom, material);
    const mesh = new THREE.LineSegments(geom, material);
    mesh.frustumCulled = false;

    return { parentMesh, geom, mesh, count, uniforms };
  }

  // === utils ===
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

  return (
    <div className="h-screen w-screen bg-zinc-50 flex flex-col">
      {/* Header / Controls */}
      <div className="px-4 py-2 border-b border-zinc-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">
            GLB Shader Silhouette + Hard Edges (WebGL2)
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

      {/* Canvas */}
      <div className="relative flex-1" ref={mountRef} />

      <div className="px-4 py-2 text-xs text-zinc-500 bg-white border-t border-zinc-200">
        GPUシェーダーで視点依存のシルエットとハードエッジを判定・描画しています。
      </div>
    </div>
  );
}
