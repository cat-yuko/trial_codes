import Fastify from "fastify";
import fastifyMultipart from "@fastify/multipart";
import { IfcAPI } from "web-ifc";
import * as THREE from "three";
import { GLTFExporter } from "three-stdlib";

const fastify = Fastify({ logger: true });
fastify.register(fastifyMultipart);

fastify.post("/convert", async (req, reply) => {
  try {
    const file = await req.file();
    const buffer = await file.toBuffer();

    // === WebIFC初期化 ===
    const ifcAPI = new IfcAPI();
    await ifcAPI.Init();

    // === IFCロード ===
    const modelID = ifcAPI.OpenModel(new Uint8Array(buffer));

    // === IFC要素取得（Wall, Slab, Beamなどを例として取得） ===
    const elementTypes = [
      ifcAPI.types.IFCWALL,
      ifcAPI.types.IFCSLAB,
      ifcAPI.types.IFCBEAM,
      ifcAPI.types.IFCCOLUMN,
    ];

    const meshes = [];

    for (const type of elementTypes) {
      const ids = ifcAPI.GetAllItemsOfType(modelID, type, false);

      for (const id of ids) {
        const geom = ifcAPI.GetGeometry(modelID, id);

        if (!geom || !geom.vertices || geom.vertices.length === 0) continue;

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(new Float32Array(geom.vertices), 3)
        );
        if (geom.indices) {
          geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(geom.indices), 1));
        }

        // === スタイル情報取得 ===
        let color = 0x00ff00;
        let transparency = 0;

        const styledItems = ifcAPI.GetLineIDsWithType(modelID, ifcAPI.types.IFCSTYLEDITEM);
        for (const styleID of styledItems) {
          const styleItem = ifcAPI.GetLine(modelID, styleID);
          if (!styleItem.Styles) continue;

          for (const style of styleItem.Styles) {
            if (style.RepresentationItems && style.RepresentationItems.length > 0) {
              const rep = style.RepresentationItems[0];
              if (rep.Colour) {
                const [r, g, b] = rep.Colour.map((v) => v || 0);
                color = new THREE.Color(r, g, b).getHex();
              }
              if (rep.Transparency) transparency = rep.Transparency;
            }
          }
        }

        const material = new THREE.MeshStandardMaterial({
          color,
          transparent: transparency > 0,
          opacity: 1 - transparency,
        });

        const mesh = new THREE.Mesh(geometry, material);
        meshes.push(mesh);
      }
    }

    // === GLBに変換 ===
    const exporter = new GLTFExporter();
    const glbBuffer = await new Promise((resolve) => {
      exporter.parse(meshes, (glb) => resolve(Buffer.from(glb)), { binary: true });
    });

    reply.type("model/gltf-binary").send(glbBuffer);
  } catch (err) {
    console.error(err);
    reply.status(500).send({ error: err.message });
  }
});

fastify.listen({ port: 4000, host: "0.0.0.0" });
