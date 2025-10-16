"use client";
import { useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

export default function Home() {
  const [scene, setScene] = useState<THREE.Scene | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("http://localhost:4000/convert", {
      method: "POST",
      body: formData,
    });
    const arrayBuffer = await res.arrayBuffer();

    const blob = new Blob([arrayBuffer], { type: "model/gltf-binary" });
    const url = URL.createObjectURL(blob);

    const loader = new GLTFLoader();
    loader.load(url, (gltf) => {
      const scene = new THREE.Scene();
      scene.add(gltf.scene);
      setScene(scene);
    });
  };

  return (
    <main className="p-4">
      <input type="file" onChange={handleUpload} />
      <div id="viewer" className="w-full h-[80vh] bg-gray-200 mt-4" />
    </main>
  );
}
