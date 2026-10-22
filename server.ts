import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API endpoint: Run extraction via Python CLI / module
  app.post('/api/extract', async (req, res) => {
    try {
      const { text, type = 'invoice', mock = true, model, enableRepair = true } = req.body;

      if (!text || typeof text !== 'string') {
        return res.status(400).json({ success: false, errors: ['No document text provided.'] });
      }

      // Write temp file to pass to python runner
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.txt`;
      const tempPath = path.join(__dirname, 'outputs', tempId);
      const outPath = path.join(__dirname, 'outputs', `${tempId}.json`);

      fs.writeFileSync(tempPath, text, 'utf-8');

      const mockFlag = mock ? '--mock' : '';
      const repairFlag = !enableRepair ? '--no-repair' : '';
      const modelFlag = model ? `--model "${model}"` : '';
      
      const cmd = `python3 run.py --input "${tempPath}" --type "${type}" --output "${outPath}" --pretty ${mockFlag} ${repairFlag} ${modelFlag}`;

      exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
        // Clean up temp input file
        try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}

        if (error && !fs.existsSync(outPath)) {
          return res.status(200).json({
            success: false,
            errors: [stderr.trim() || stdout.trim() || 'Extraction failed.'],
            stdout,
            stderr
          });
        }

        if (fs.existsSync(outPath)) {
          try {
            const raw = fs.readFileSync(outPath, 'utf-8');
            const data = JSON.parse(raw);
            fs.unlinkSync(outPath); // Clean up output
            return res.json({
              success: true,
              document_type: type,
              data,
              stdout,
              stderr
            });
          } catch (pe) {
            return res.status(200).json({
              success: false,
              errors: [`Failed to parse generated output JSON: ${pe}`],
              stdout,
              stderr
            });
          }
        }

        return res.status(200).json({
          success: false,
          errors: [stderr || stdout || 'Unknown extraction error.'],
          stdout,
          stderr
        });
      });
    } catch (e: any) {
      res.status(500).json({ success: false, errors: [e.message] });
    }
  });

  // API endpoint: Execute PyTest and stream results
  app.post('/api/run-tests', (req, res) => {
    exec('python3 -m pytest tests -v', { cwd: __dirname }, (error, stdout, stderr) => {
      res.json({
        success: !error,
        exitCode: error ? error.code : 0,
        output: stdout || stderr,
        summary: stdout.includes('passed') ? stdout.split('=').slice(-2)[0]?.trim() : 'Test run completed'
      });
    });
  });

  // API endpoint: Read project files for the in-app file browser
  app.get('/api/file-content', (req, res) => {
    const filename = req.query.path as string;
    const allowedPrefixes = ['src/', 'tests/', 'examples/', 'run.py', 'README.md', 'requirements.txt', '.env.example'];

    if (!filename || !allowedPrefixes.some(p => filename === p || filename.startsWith(p))) {
      return res.status(400).json({ error: 'Unauthorized or invalid file path.' });
    }

    const fullPath = path.join(__dirname, filename);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found.' });
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      res.json({ path: filename, content });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API endpoint: Download structured project zip archive
  app.get('/api/download-zip', (req, res) => {
    const zipPath = path.join(__dirname, 'structured-llm-json-extractor.zip');
    if (!fs.existsSync(zipPath)) {
      return res.status(404).send('Archive not found');
    }
    res.download(zipPath, 'Python-Generative-AI-LangChain-Internship-Task1.zip');
  });

  // Mount Vite development server as middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Structured LLM Extractor server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
