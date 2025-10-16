import Fastify from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import { IfcAPI } from 'web-ifc';
import * as THREE from 'three';
import { GLTFExporter } from 'three-stdlib';

const fastify = Fastify({ logger: true });
fastify.register(fastifyMultipart);

fastify.post('/convert', async (req, reply) => {
  try {
    const file = await req.file();
    const buffer = await file.toBuffer();

    // === WebAssemblyエンジン初期化 ===
    const ifcAPI = new IfcAPI();
    await ifcAPI.Init();

    // === IFCロード（メモリ上） ===
    const modelID = ifcAPI.OpenModel(new Uint8Array(buffer));
    const ifcMeshes = [];

    // ここではサンプルとして単純なMeshに変換
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    ifcMeshes.push(new THREE.Mesh(geom, mat));

    // === GLBに変換 ===
    const exporter = new GLTFExporter();
    const glbBuffer = await new Promise((resolve) => {
      exporter.parse(
        ifcMeshes,
        (glb) => resolve(Buffer.from(glb)),
        { binary: true }
      );
    });

    // ディスクに保存せずメモリ上で返す
    reply.type('model/gltf-binary').send(glbBuffer);
  } catch (err) {
    console.error(err);
    reply.status(500).send({ error: err.message });
  }
});

fastify.listen({ port: 4000, host: '0.0.0.0' });
