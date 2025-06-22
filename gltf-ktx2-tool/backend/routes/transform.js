const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');

const upload = multer({ dest: 'uploads/' });

function transformRouter(io) {
  const router = express.Router();

  router.post('/', upload.single('file'), async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      const authRes = await axios.get('http://django-api:8000/api/auth/me/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (authRes.status !== 200) return res.status(401).send('Unauthorized');

      const inputPath = req.file.path;
      const outputPath = `converted/${req.file.filename}.glb`;
      const format = req.body.format || 'uastc';
      const socketId = req.body.socketId;

      if (socketId) io.to(socketId).emit('progress', 'Starting transformation...');

      const args = [
        'etc1s',
        inputPath,
        outputPath,
        '--target', 'webp',
        '--encoder', 'toktx',
        '--format', format
      ];

      const process = spawn('gltf-transform', args);

      process.stdout.on('data', (data) => {
        if (socketId) io.to(socketId).emit('progress', data.toString());
      });

      process.stderr.on('data', (data) => {
        if (socketId) io.to(socketId).emit('progress', data.toString());
      });

      process.on('close', (code) => {
        if (code === 0) {
          if (socketId) io.to(socketId).emit('done', 'Transformation complete');
          res.download(outputPath, () => {
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
          });
        } else {
          if (socketId) io.to(socketId).emit('error', 'Transform failed');
          res.status(500).send('Transform failed');
        }
      });
    } catch (err) {
      res.status(500).send('Error: ' + err.message);
    }
  });

  return router;
}

module.exports = transformRouter;
