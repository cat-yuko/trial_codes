"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

type NodeInfo = {
  id: string;
  name: string;
  children: NodeInfo[];
};

type MaterialInfo = {
  name: string;
  visible: boolean;
};

type Props = {
  glbUrl: string | null;
  controlParams: {
    hiddenNodes: string[]; // 非表示ノード名
    hiddenMaterials: string[]; // 透過マテリアル名
    outlinedMaterials: string[]; // 枠線表示対象マテリアル名
    displayMode: "edges" | "wireframe"; // EdgesGeometry と WireframeGeometry 切り替え
  };
  onNodesLoaded?: (nodes: NodeInfo[]) => void;
  onMaterialsLoaded?: (materials: MaterialInfo[]) => void;
};

export default function BuildingViewer({
  glbUrl,
  controlParams,
  onNodesLoaded,
  onMaterialsLoaded,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const controlsRef = useRef<OrbitControls>();
  const modelRef = useRef<THREE.Group>();

  // アウトライン管理
  const outlineMeshes = useRef<Map<THREE.Mesh, THREE.LineSegments>>(new Map());

  // 初期セットアップ
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      2000
    );
    // 斜め上から見る
    camera.position.set(10, 10, 10);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
      mountRef.current.clientWidth,
      mountRef.current.clientHeight
    );
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 環境光
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    // ライト
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 10, 10);
    camera.add(directionalLight);
    scene.add(camera);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    // アニメーション（マウス操作時のみ）
    let animationId: number | null = null;
    const render = () => {
      controls.update();
      renderer.render(scene, camera);
    };

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      render();
    };

    const startAnimation = () => {
      if (animationId === null) animate();
    };

    const stopAnimation = () => {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    };

    // マウス操作開始時にアニメーション開始
    controls.addEventListener("start", startAnimation);
    // マウス操作終了時にアニメーション停止
    controls.addEventListener("end", stopAnimation);

    // 最初は静止画レンダリングだけ
    render();

    // リサイズ対応
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current)
        return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      rendererRef.current.setSize(width, height);
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      render();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      controls.removeEventListener("start", startAnimation);
      controls.removeEventListener("end", stopAnimation);
      if (animationId !== null) cancelAnimationFrame(animationId);
      renderer.dispose();
      if (mountRef.current) mountRef.current.removeChild(renderer.domElement);
    };
  }, []);

  // GLBロード
  useEffect(() => {
    if (!sceneRef.current) return;

    if (!glbUrl) {
      if (modelRef.current) {
        sceneRef.current.remove(modelRef.current);
        disposeModel(modelRef.current);
        modelRef.current = undefined;
      }
      return;
    }
    const loader = new GLTFLoader();

    // 既存モデルがあれば削除・dispose
    if (modelRef.current) {
      sceneRef.current.remove(modelRef.current);
      disposeModel(modelRef.current);
      modelRef.current = undefined;
    }

    loader.load(
      glbUrl,
      (gltf) => {
        // モデル
        const model = gltf.scene;
        modelRef.current = model;

        // アウトラインクリア
        outlineMeshes.current.forEach((outline) => {
          outline.parent?.remove(outline);
          outline.geometry.dispose();
          (outline.material as THREE.Material).dispose();
        });
        outlineMeshes.current.clear();

        // バウンディングボックス
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3()).length();
        // モデルを原点に移動
        model.position.sub(center);
        // Groupに追加
        sceneRef.current!.add(model);

        // アウトラインメッシュ生成
        model.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;

            let outlineGeom: THREE.BufferGeometry;
            if (controlParams.displayMode === "edges") {
              // 表面の境界線だけ

              // しきい値角度
              const threshold = THREE.MathUtils.degToRad(60);
              outlineGeom = new THREE.EdgesGeometry(mesh.geometry, threshold);
            } else {
              // 全ポリゴンのワイヤーフレーム
              outlineGeom = new THREE.WireframeGeometry(mesh.geometry);
            }

            const outlineMat = new THREE.LineBasicMaterial({
              color: 0x000000,
            });
            const outlineMesh = new THREE.LineSegments(outlineGeom, outlineMat);

            outlineMesh.visible = false;
            mesh.add(outlineMesh);
            outlineMeshes.current.set(mesh, outlineMesh);
          }
        });

        // カメラをモデルに合わせる
        if (cameraRef.current && controlsRef.current) {
          const cameraZ = size * 1.5;
          cameraRef.current.position.set(0, 0, cameraZ);
          cameraRef.current.lookAt(0, 0, 0);
          controlsRef.current.target.set(0, 0, 0);
          controlsRef.current.update();
        }

        // ノードツリー取得
        if (onNodesLoaded) {
          const buildTree = (obj: THREE.Object3D): NodeInfo => ({
            id: obj.uuid,
            name: obj.name || "(no name)",
            children: obj.children.map(buildTree),
          });
          onNodesLoaded([buildTree(model)]);
        }

        // マテリアル一覧取得
        if (onMaterialsLoaded) {
          const mats: Record<string, boolean> = {};
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              const matList = Array.isArray(mesh.material)
                ? mesh.material
                : [mesh.material];
              matList.forEach((m) => {
                mats[m.name || "(no name)"] = true;
              });
            }
          });
          onMaterialsLoaded(
            Object.keys(mats).map((name) => ({ name, visible: true }))
          );
        }
        // レンダリング
        renderOnce();
      },
      undefined,
      (error) => {
        console.error("GLB load error:", error);
      }
    );
  }, [glbUrl]);

  // ノード表示制御
  useEffect(() => {
    if (!modelRef.current) return;

    modelRef.current.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;

        // ノード名による表示・非表示
        const nodeVisible = !controlParams.hiddenNodes.includes(mesh.name);
        mesh.visible = nodeVisible;

        // アウトラインもノードに合わせる
        const outlineMesh = outlineMeshes.current.get(mesh);
        if (outlineMesh)
          outlineMesh.visible = outlineMesh.visible && nodeVisible;
      }
    });

    // レンダリング
    renderOnce();
  }, [controlParams.hiddenNodes]);

  // メッシュ透過制御
  useEffect(() => {
    if (!modelRef.current) return;

    // マテリアルが重複しているかチェック用
    const processedMaterials = new Set<THREE.Material>();

    modelRef.current.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;

        // マテリアル配列化
        const matList = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];

        // 透過マテリアル
        matList.forEach((m) => {
          // マテリアル処理済みの場合
          if (processedMaterials.has(m)) return;
          processedMaterials.add(m);

          // 色を持たないマテリアルはスキップ
          if (!("color" in m)) return;

          // 元の色を保存
          if (!m.userData.originalColor) {
            m.userData.originalColor = (m as any).color.clone();
            m.userData.originalOpacity = m.opacity;
          }

          // マテリアルを表示
          m.visible = true;

          // 選択したマテリアルの場合
          if (controlParams.hiddenMaterials.includes(m.name)) {
            // 透過
            m.opacity = 0.3;
            m.transparent = true;
            m.depthWrite = false;
          } else {
            // 元の色に戻す
            if (m.userData.originalColor) {
              (m as any).color.copy(m.userData.originalColor);
            }
            m.opacity = m.userData.originalOpacity ?? 1.0;
            m.transparent = m.opacity < 1.0;
            m.depthWrite = true;
          }

          // GPU上のデータを更新
          m.needsUpdate = true;
        });
      }
    });

    // レンダリング
    renderOnce();
  }, [controlParams.hiddenMaterials]);

  // アウトライン制御
  useEffect(() => {
    if (!modelRef.current) return;

    modelRef.current.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;

        // ノード名による表示・非表示
        const nodeVisible = !controlParams.hiddenNodes.includes(mesh.name);

        // マテリアル配列化
        const matList = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];

        // アウトライン表示
        const outlineMesh = outlineMeshes.current.get(mesh);
        if (!outlineMesh) return;

        // 対象マテリアルが含まれる場合のみアウトライン表示
        let shouldOutline = false;
        matList.forEach((m) => {
          // 選択したマテリアルの場合
          if (controlParams.outlinedMaterials.includes(m.name)) {
            // アウトライン表示
            shouldOutline = true;
            // 透過マテリアルの場合は非表示にしない
            if (!controlParams.hiddenMaterials.includes(m.name)) {
              m.visible = false;
            }
          } else {
            // アウトライン非表示
            m.visible = true;
          }
        });
        outlineMesh.visible = shouldOutline && nodeVisible;
      }
    });

    // レンダリング
    renderOnce();
  }, [
    controlParams.outlinedMaterials,
    controlParams.hiddenNodes,
    controlParams.hiddenMaterials,
  ]);

  // レンダリング
  const renderOnce = () => {
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      controlsRef.current?.update();
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };

  return <div ref={mountRef} className="w-full h-full" />;
}

// モデルのジオメトリとマテリアルを安全にdisposeする関数
function disposeModel(model?: THREE.Object3D) {
  if (!model) return;
  model.traverse((obj) => {
    if ((obj as THREE.Mesh).geometry) {
      (obj as THREE.Mesh).geometry.dispose();
    }
    const material = (obj as THREE.Mesh).material;
    if (Array.isArray(material)) {
      material.forEach((mat) => mat.dispose());
    } else if (material) {
      material.dispose();
    }
  });
}
