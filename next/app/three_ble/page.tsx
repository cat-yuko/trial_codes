"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";

export default function Page() {
  // DOM & 3D refs
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);

  // 選択状態管理
  const selectedMeshRef = useRef<THREE.Mesh | null>(null);

  // Raycaster
  const raycaster = useRef(new THREE.Raycaster()).current;
  const mouse = useRef(new THREE.Vector2()).current;

  // Init Three.js
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    // 背景をBlender風グラデーションに
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, "#b9cbe9");
    gradient.addColorStop(1, "#e8e8e8");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 16, 256);
    scene.background = new THREE.CanvasTexture(canvas);

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
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = false;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.6;
    controls.zoomSpeed = 0.9;
    controls.enablePan = true;
    controls.screenSpacePanning = false;
    controlsRef.current = controls;

    // ライト
    const envLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(envLight);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xaaaaaa, 1.1);
    scene.add(hemi);

    const dir1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dir1.position.set(5, 10, 5);
    scene.add(dir1);

    const dir2 = new THREE.DirectionalLight(0xffffff, 0.5);
    dir2.position.set(-5, 3, -5);
    scene.add(dir2);

    // 床
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshBasicMaterial({
        color: 0xdddddd,
        opacity: 0.3,
        transparent: true,
      })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.001;
    //scene.add(plane);

    // グリッドと軸
    const grid = new THREE.GridHelper(100, 100, 0xaaaaaa, 0xcccccc);
    grid.position.y = -0.001;
    scene.add(grid);

    // 軸ヘルパー
    const axes = new THREE.AxesHelper(2);
    scene.add(axes);

    // アニメーションループ
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // ウィンドウリサイズ対応
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

    // クリック選択
    const onClick = (event: MouseEvent) => {
      if (!cameraRef.current || !sceneRef.current) return;

      mouse.x = (event.clientX / mountRef.current!.clientWidth) * 2 - 1;
      mouse.y = -(event.clientY / mountRef.current!.clientHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);

      const intersects = raycaster.intersectObjects(
        modelGroupRef.current ? [modelGroupRef.current] : [],
        true
      );

      if (intersects.length > 0) {
        const selected = intersects[0].object as THREE.Mesh;
        highlightMesh(selected);
      }
    };
    mountRef.current.addEventListener("click", onClick);

    return () => {
      window.removeEventListener("resize", onResize);
      mountRef.current?.removeEventListener("click", onClick);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement && mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // 選択ハイライト
  const highlightMesh = (mesh: THREE.Mesh) => {
    // 以前の選択解除
    if (selectedMeshRef.current) {
      selectedMeshRef.current.traverse((child: any) => {
        if (child.isLineSegments) child.parent?.remove(child);
      });
    }
    selectedMeshRef.current = mesh;

    // エッジを赤く太く
    const edges = new THREE.EdgesGeometry(mesh.geometry);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 })
    );
    mesh.add(line);
  };

  // File handling (drag & drop)
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
      if (
        file &&
        (file.name.toLowerCase().endsWith(".glb") ||
          file.name.toLowerCase().endsWith(".gltf"))
      ) {
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
    input.accept = ".glb,.gltf";
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

    // 前のモデルを削除
    if (modelGroupRef.current) {
      sceneRef.current.remove(modelGroupRef.current);
      modelGroupRef.current.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material))
            obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    }

    const url = URL.createObjectURL(file);
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        URL.revokeObjectURL(url);
        const group = new THREE.Group();
        group.name = "ModelRoot";
        group.add(gltf.scene);

        gltf.scene.traverse((child: any) => {
          if (child.isMesh) {
            child.geometry.computeVertexNormals();
            const mat = child.material;
            if (mat) {
              mat.flatShading = true;
              mat.needsUpdate = true;
            }

            /*
            // エッジ（輪郭線）追加
            const edges = new THREE.EdgesGeometry(child.geometry);
            const line = new THREE.LineSegments(
              edges,
              new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 })
            );
            child.add(line);
            */
          }
        });

        // モデルを中央に
        const box = new THREE.Box3().setFromObject(group);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);
        group.position.sub(center);

        // push to scene
        sceneRef.current!.add(group);
        modelGroupRef.current = group;

        // 読み込んだモデルにカメラを合わせて初期表示
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

  return (
    <div className="h-screen w-screen bg-zinc-50 flex flex-col">
      {/* Header / Controls */}
      <div className="px-4 py-2 border-b border-zinc-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">GLB Viewer</h1>
          <button
            className="px-3 py-1.5 text-sm rounded-xl border border-zinc-300 hover:bg-zinc-100"
            onClick={onPickFile}
          >
            Choose GLB
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="relative flex-1" ref={mountRef}>
        {/* Drag & Drop overlay */}
      </div>
    </div>
  );
}
