import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

document.getElementById('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const formData = new FormData();
  formData.append('file', file);
  formData.append('format', document.getElementById('format').value);

  const token = localStorage.getItem('token');
  const res = await fetch('http://localhost:4000/transform', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  const loader = new GLTFLoader();
  loader.load(url, (gltf) => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    document.body.appendChild(renderer.domElement);
    renderer.setSize(window.innerWidth, window.innerHeight);
    scene.add(gltf.scene);
    camera.position.z = 5;
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();
  });
});
