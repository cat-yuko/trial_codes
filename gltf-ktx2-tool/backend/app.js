const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// アップロード用ディレクトリ
const upload = multer({ dest: 'uploads/' });

// 静的ファイル配信
app.use(express.static(path.join(__dirname, '../frontend/public')));
app.use('/converted', express.static(path.join(__dirname, 'converted')));

// アップロードルート
app.post('/upload', upload.single('file'), (req, res) => {
  const inputPath = req.file.path;
  const originalName = req.file.originalname;
  const compression = req.body.compression === 'uastc' ? 'uastc' : 'etc1s'; // 安全確認
  const outputName = originalName.replace(/\.(glb|gltf)$/i, `_${compression}.glb`);
  const outputPath = path.join(__dirname, 'converted', outputName);

  const cmd = `gltf-transform ${compression} ${inputPath} ${outputPath}`;

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error(stderr);
      return res.status(500).json({ error: '変換に失敗しました。' });
    }

    return res.json({ message: '変換成功', output: `/converted/${outputName}` });
  });
});

// サーバ起動
app.listen(port, () => {
  console.log(`サーバ起動中: http://localhost:${port}`);
});
