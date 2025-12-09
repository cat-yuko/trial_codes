"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import clsx from "clsx";

/* =========================================================
   メインページ
========================================================= */
export default function Page() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMaterialA, setShowMaterialA] = useState(true);
  const controlsRef = useRef<any>(null);

  const handleReset = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  return (
    <div className="p-4">
      {/* 全画面ボタン */}
      <button
        className="px-3 py-2 bg-blue-500 text-white rounded mb-3"
        onClick={() => setIsFullscreen(!isFullscreen)}
      >
        {isFullscreen ? "縮小" : "全画面"}
      </button>

      {/* モデル領域 */}
      <div
        className={clsx(
          "relative bg-gray-900 rounded overflow-hidden transition-all",
          isFullscreen
            ? "fixed inset-0 z-50"
            : "w-[400px] h-[300px] border mx-auto"
        )}
      >
        <Canvas camera={{ position: [3, 3, 3], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[8, 10, 5]} intensity={1} />

          <Suspense fallback={null}>
            <Model showMaterialA={showMaterialA} controlsRef={controlsRef} />
          </Suspense>
        </Canvas>

        {/* リセット */}
        <button
          onClick={handleReset}
          className="absolute top-3 right-3 bg-white/80 text-black px-3 py-1 rounded"
        >
          リセット
        </button>

        {/* マテリアル表示切替 */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/80 px-4 py-2 rounded">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showMaterialA}
              onChange={(e) => setShowMaterialA(e.target.checked)}
            />
            MaterialA を表示
          </label>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   GLBモデル ＋ 画面フィット機能
========================================================= */
function Model({
  showMaterialA,
  controlsRef,
}: {
  showMaterialA: boolean;
  controlsRef: any;
}) {
  const gltf = useGLTF("/models/Test/cube2.glb");
  const { camera, size } = useThree();

  const fitModelToScreen = () => {
    const scene = gltf.scene;

    // 1) Bounding Box
    const box = new THREE.Box3().setFromObject(scene);
    const sizeVec = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // 2) モデルを中心へ移動
    scene.position.x += scene.position.x - center.x;
    scene.position.y += scene.position.y - center.y;
    scene.position.z += scene.position.z - center.z;

    // 3) 完璧フィット距離
    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
    const fitDistance = maxDim / (2 * Math.tan((camera.fov * Math.PI) / 360)); // 見切れない最適距離

    // 4) カメラアニメーション
    const start = camera.position.clone();
    const target = new THREE.Vector3(fitDistance, fitDistance, fitDistance);

    let t = 0;
    const animate = () => {
      t += 0.04;
      if (t > 1) t = 1;

      camera.position.lerpVectors(start, target, easeOutCubic(t));
      camera.lookAt(0, 0, 0);

      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
      }

      if (t < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  };

  // ✨ モデルロード時にフィット
  useEffect(() => {
    fitModelToScreen();
  }, [gltf]);

  // ✨ 画面リサイズ時もフィット
  useEffect(() => {
    fitModelToScreen();
  }, [size.width, size.height]);

  // ✨ マテリアル表示/非表示
  const TARGET_MATERIAL = "MaterialA";
  gltf.scene.traverse((obj: any) => {
    if (obj.isMesh && obj.material?.name === TARGET_MATERIAL) {
      obj.visible = showMaterialA;
    }
  });

  return (
    <>
      <OrbitControls ref={controlsRef} />
      <primitive object={gltf.scene} />
    </>
  );
}

useGLTF.preload("/model.glb");

/* =========================================================
   イージング関数（アニメーション用）
========================================================= */
function easeOutCubic(x: number) {
  return 1 - Math.pow(1 - x, 3);
}
