"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

export default function Page() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const controlsRef = useRef<OrbitControls>();
  const [worker] = useState(() => new Worker(new URL("./glb-worker.ts", import.meta.url)));

  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4f4f5);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    camera.position.set(5,5,5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8); dir.position.set(5,10,7); scene.add(dir);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); };
  }, []);

  const onDropFile = (file: File) => {
    const loader = new GLTFLoader();
    loader.load(URL.createObjectURL(file), gltf => {
      const mesh = gltf.scene.children.find(c => (c as THREE.Mesh).isMesh) as THREE.Mesh;
      if (!mesh) return;
      const geom = mesh.geometry as THREE.BufferGeometry;
      const pos = geom.getAttribute("position").array as Float32Array;
      const index = (geom.index?.array || new Uint32Array([])) as Uint32Array;

      worker.postMessage({ positions: pos, indices: index }, [pos.buffer, index.buffer]);

      worker.onmessage = (e: MessageEvent<any>) => {
        const { p1, p2, n1, n2, has2, count } = e.data;

        const base = new THREE.BufferGeometry();
        base.setAttribute("position", new THREE.Float32BufferAttribute([0,0,0,0,0,0],3));

        const inst = new THREE.InstancedBufferGeometry();
        inst.index = null;
        inst.attributes = base.attributes;
        inst.setAttribute("instanceP1", new THREE.InstancedBufferAttribute(p1,3));
        inst.setAttribute("instanceP2", new THREE.InstancedBufferAttribute(p2,3));
        inst.setAttribute("instanceN1", new THREE.InstancedBufferAttribute(n1,3));
        inst.setAttribute("instanceN2", new THREE.InstancedBufferAttribute(n2,3));
        inst.setAttribute("instanceHasN2", new THREE.InstancedBufferAttribute(has2,1));
        inst.instanceCount = count;

        const mat = new THREE.RawShaderMaterial({
          glslVersion: THREE.GLSL3,
          uniforms: { uCameraPos: { value: new THREE.Vector3() } },
          vertexShader: `
            precision highp float;
            layout(location=0) in vec3 position;
            in vec3 instanceP1;
            in vec3 instanceP2;
            out float vVisible;
            uniform mat4 projectionMatrix;
            uniform mat4 viewMatrix;
            void main(){
              vec3 P = (gl_VertexID==0)?instanceP1:instanceP2;
              gl_Position = projectionMatrix*viewMatrix*vec4(P,1.0);
              vVisible = 1.0;
            }
          `,
          fragmentShader: `
            precision highp float;
            in float vVisible;
            out vec4 outColor;
            void main(){ if(vVisible<0.5) discard; outColor=vec4(1.0,0.0,0.0,1.0);}
          `,
          transparent:true
        });

        const lineMesh = new THREE.Mesh(inst, mat);
        sceneRef.current?.add(lineMesh);
      };
    });
  };

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const prevent = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    const onDrop = (e: DragEvent) => {
      prevent(e);
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      if (file.name.toLowerCase().endsWith(".glb") || file.name.toLowerCase().endsWith(".gltf")) onDropFile(file);
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

  return <div ref={mountRef} className="w-screen h-screen bg-gray-100"/>;
}
