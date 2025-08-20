"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

export default function Home() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const cameraRef = useRef<THREE.OrthographicCamera>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const controlsRef = useRef<OrbitControls>();
  const modelRef = useRef<THREE.Object3D>();

  const [materials, setMaterials] = useState<string[]>([]);
  const [materialVisibleMap, setMaterialVisibleMap] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // --- シーン ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // --- カメラ（正投影） ---
    const aspect = width / height;
    const d = 2.5;
    const camera = new THREE.OrthographicCamera(
      -d * aspect,
      d * aspect,
      d,
      -d,
      0.1,
      100
    );
    camera.position.set(3, 3, 3);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // --- レンダラー ---
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0xffffff);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- コントロール ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;

    // --- 光源 ---
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7.5);
    scene.add(dirLight);

    // --- アニメーション ---
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // --- リサイズ ---
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current)
        return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      const aspect = width / height;
      camera.left = -d * aspect;
      camera.right = d * aspect;
      camera.top = d;
      camera.bottom = -d;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    // --- ドラッグ＆ドロップ ---
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      if (!e.dataTransfer?.files.length) return;

      const file = e.dataTransfer.files[0];
      if (!file.name.toLowerCase().endsWith(".glb")) {
        alert("GLBファイルをドロップしてください");
        return;
      }

      const reader = new FileReader();
      reader.onload = function (event) {
        if (!event.target?.result) return;
        const arrayBuffer = event.target.result as ArrayBuffer;

        const loader = new GLTFLoader();
        loader.parse(arrayBuffer, "", (gltf) => {
          // --- 以前のモデル削除 ---
          if (modelRef.current) {
            scene.remove(modelRef.current);
            setMaterials([]);
            setMaterialVisibleMap({});
          }

          const model = gltf.scene;

          // --- スケール調整 ---
          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2 / maxDim;
          model.scale.set(scale, scale, scale);

          // --- マテリアル一覧取得 & 元マテリアル保持 ---
          const materialSet = new Set<string>();
          model.traverse((child: any) => {
            if (child.isMesh) {
              if (Array.isArray(child.material)) {
                child.material.forEach((m: any, idx: number) => {
                  if (!m.name)
                    m.name = "Material_" + materialSet.size + "_" + idx;
                  materialSet.add(m.name);
                });
                child.userData.originalMaterial = child.material.map((m: any) =>
                  m.clone()
                );
              } else {
                if (!child.material.name)
                  child.material.name = "Material_" + materialSet.size;
                materialSet.add(child.material.name);
                child.userData.originalMaterial = child.material.clone();
              }
            }
          });

          const materialArray = Array.from(materialSet);
          setMaterials(materialArray);
          const visibilityMap: Record<string, boolean> = {};
          materialArray.forEach((m) => (visibilityMap[m] = false));
          setMaterialVisibleMap(visibilityMap);

          scene.add(model);
          modelRef.current = model;
        });
      };
      reader.readAsArrayBuffer(file);
    };

    mountRef.current.addEventListener("dragover", handleDragOver);
    mountRef.current.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("resize", handleResize);
      mountRef.current?.removeChild(renderer.domElement);
      mountRef.current?.removeEventListener("dragover", handleDragOver);
      mountRef.current?.removeEventListener("drop", handleDrop);
    };
  }, []);

  // --- チェックボックス切替 ---
  const toggleMaterial = (materialName: string, visible: boolean) => {
    setMaterialVisibleMap((prev) => ({ ...prev, [materialName]: visible }));
    if (!modelRef.current) return;

    modelRef.current.traverse((child: any) => {
      if (child.isMesh) {
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        const originalMats = Array.isArray(child.userData.originalMaterial)
          ? child.userData.originalMaterial
          : [child.userData.originalMaterial];

        mats.forEach((m, idx) => {
          if (m.name === materialName) {
            // 線削除
            child.children = child.children.filter(
              (c) => !(c instanceof THREE.LineSegments)
            );

            if (visible) {
              // 線追加
              const edges = new THREE.EdgesGeometry(child.geometry, 10);
              const line = new THREE.LineSegments(
                edges,
                new THREE.LineBasicMaterial({
                  color: 0x000000,
                  depthTest: true,
                })
              );
              child.add(line);

              // 面を白色に
              if (Array.isArray(child.material)) {
                child.material[idx] = new THREE.MeshBasicMaterial({
                  color: 0xffffff,
                });
              } else {
                child.material = new THREE.MeshBasicMaterial({
                  color: 0xffffff,
                });
              }
            } else {
              // OFFなら元マテリアルに戻す
              if (Array.isArray(child.material)) {
                child.material[idx] = originalMats[idx].clone();
              } else {
                child.material = originalMats[0].clone();
              }
            }
          }
        });
      }
    });
  };

  return (
    <>
      <div
        ref={mountRef}
        className="w-screen h-screen border-2 border-dashed border-gray-400 relative"
      >
        <p className="absolute top-2 left-2 text-black z-10">
          ここに GLB ファイルをドラッグ＆ドロップしてください
        </p>

        {materials.length > 0 && (
          <div className="absolute top-12 left-2 bg-white p-2 border border-gray-400 z-10 max-h-[80vh] overflow-y-auto">
            <p className="mb-2 font-semibold">枠線を表示するマテリアル:</p>
            {materials.map((m) => (
              <label key={m} className="block cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!materialVisibleMap[m]}
                  onChange={(e) => toggleMaterial(m, e.target.checked)}
                  className="mr-2"
                />
                {m}
              </label>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
