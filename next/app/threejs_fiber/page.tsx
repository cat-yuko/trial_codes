"use client";

import {
  useEffect,
  useRef,
  useState,
  Suspense,
  useImperativeHandle,
  forwardRef,
} from "react";
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
  const modelRef = useRef<any>(null);

  const handleReset = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }

    // ★ リセット時も強制フィット
    if (modelRef.current?.fit) {
      modelRef.current.fit();
    }
  };

  return (
    <div className="p-4">
      <button
        className="px-3 py-2 bg-blue-500 text-white rounded mb-3"
        onClick={() => setIsFullscreen(!isFullscreen)}
      >
        {isFullscreen ? "縮小" : "全画面"}
      </button>

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
            <Model
              ref={modelRef}
              showMaterialA={showMaterialA}
              controlsRef={controlsRef}
            />
          </Suspense>
        </Canvas>

        <button
          onClick={handleReset}
          className="absolute top-3 right-3 bg-white/80 text-black px-3 py-1 rounded"
        >
          リセット
        </button>

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
   モデル（Fit機能を外から呼べるようにする）
========================================================= */
const Model = forwardRef(function Model(
  { showMaterialA, controlsRef }: { showMaterialA: boolean; controlsRef: any },
  ref
) {
  const gltf = useGLTF("/models/Test/cube2.glb");
  const { camera, size } = useThree();

  // ===== FIT 関数本体 =====
  const fitModelToScreen = () => {
    const scene = gltf.scene;

    const box = new THREE.Box3().setFromObject(scene);
    const sizeVec = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // モデル中心へ移動
    scene.position.x += scene.position.x - center.x;
    scene.position.y += scene.position.y - center.y;
    scene.position.z += scene.position.z - center.z;

    // 完璧フィット距離
    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
    const fitDistance = maxDim / (2 * Math.tan((camera.fov * Math.PI) / 360));

    // カメラアニメーション
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

  // ★ 外部から fit() を呼べるように expose
  useImperativeHandle(ref, () => ({
    fit: fitModelToScreen,
  }));

  // ロード時
  useEffect(() => {
    fitModelToScreen();
  }, [gltf]);

  // リサイズ時
  useEffect(() => {
    fitModelToScreen();
  }, [size.width, size.height]);

  // マテリアル表示切替
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
});

useGLTF.preload("/models/Test/cube2.glb");

/* =========================================================
   イージング
========================================================= */
function easeOutCubic(x: number) {
  return 1 - Math.pow(1 - x, 3);
}
