import express from 'express';
import multer from 'multer';
import { NodeIO } from '@gltf-transform/core';
import { KHRTextureBasisu } from '@gltf-transform/extensions';
import { textureCompress, reorder, dedup, prune, flatten } from '@gltf-transform/functions';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const app = express();
const port = 3000;
const upload = multer({ dest: 'uploads/' });

app.use(express.json());

app.post('/convert', upload.single('model'), async (req, res) => {
  try {
    const { format } = req.body; // 'uastc' or 'etc1s'
    const inputPath = req.file.path;
    const outputPath = `uploads/converted_${Date.now()}.glb`;

    const io = new NodeIO()
      .registerExtensions([KHRTextureBasisu])
      .registerDependencies({ 'toktx': execFileSync });

    const doc = await io.read(inputPath);

    await doc.transform(
      optimize(), // 以下の内容をまとめて最適化
      /*以下のようにfalseにして一部を無効かすることも可能
      optimize({
        prune: true,
        dedup: true,
        flatten: false,  // 階層保持、Node名/Transform情報/アニメーションに重要
        reorder: true
      })
      */
      //reorder(),      // 頂点順序最適化
      //dedup(),        // 重複削除
      //flatten(),      // 階層平坦化
      //prune(),        // 未使用ノード削除
      textureCompress({
        encoder: 'toktx',
        targetFormat: format || 'uastc',
        slots: ['baseColorTexture', 'normalTexture', 'metallicRoughnessTexture']
      })
    );

    await io.write(outputPath, doc);

    res.download(outputPath, 'converted.glb', () => {
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('変換中にエラーが発生しました');
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
