"use client";

import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

export default function IfcViewer() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [glbUrls, setGlbUrls] = useState<string[]>([]);

  // Django APIからGLBリストを取得
  useEffect(() => {
    const fetchGlbList = async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/convert_ifc/`);
      const data = await res.json();
      setGlbUrls(data.glb_files); // Djangoから ["floor1.glb", "floor2.glb", ...]
    };
    fetchGlbList();
  }, []);

  // GLBを順にロードして統合表示
  useEffect(() => {
    if (glbUrls.length === 0 || !mountRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(10, 10, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.innerHTML = "";
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(10, 10, 10);
    scene.add(light);

    const loader = new GLTFLoader();

    // 各GLBファイルを順にロードしてシーンに追加
    glbUrls.forEach((url) => {
      loader.load(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}${url}`,
        (gltf) => {
          scene.add(gltf.scene);
        },
        undefined,
        (err) => console.error("Error loading GLB:", err)
      );
    });

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
  }, [glbUrls]);

  return <div ref={mountRef} style={{ width: "100%", height: "100vh" }} />;
}
