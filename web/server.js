/**
 * Figural Proxy Server
 * Proxies requests to Anthropic API to avoid CORS issues
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// Load environment variables from .env file
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        if (key && value) {
          process.env[key.trim()] = value.trim();
        }
      }
    });
    console.log('✓ Loaded API keys from .env file');
  } catch (err) {
    console.warn('⚠ No .env file found. API keys must be provided in requests.');
  }
}

loadEnv();

// API Keys from environment
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// API Configuration
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const NVIDIA_ASR_URL = 'https://integrate.api.nvidia.com/v1/audio/transcriptions';

function serveStaticFile(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath.split('?')[0]);
  
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

function proxyToAnthropic(req, res, body) {
  const parsedBody = JSON.parse(body);
  // Use server-side API key (ignore any client-provided key)
  delete parsedBody.apiKey;
  
  if (!ANTHROPIC_API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Anthropic API key not configured on server' }));
    return;
  }
  
  const postData = JSON.stringify(parsedBody);
  
  const options = {
    hostname: 'api.anthropic.com',
    port: 443,
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    }
  };
  
  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', (e) => {
    console.error('Proxy error:', e.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  });
  
  proxyReq.write(postData);
  proxyReq.end();
}

function proxyToNvidia(req, res, body, boundary) {
  if (!NVIDIA_API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'NVIDIA API key not configured on server' }));
    return;
  }
  
  const options = {
    hostname: 'integrate.api.nvidia.com',
    port: 443,
    path: '/v1/audio/transcriptions',
    method: 'POST',
    headers: {
      'Content-Type': req.headers['content-type'],
      'Content-Length': Buffer.byteLength(body),
      'Authorization': `Bearer ${NVIDIA_API_KEY}`
    }
  };
  
  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', (e) => {
    console.error('NVIDIA proxy error:', e.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  });
  
  proxyReq.write(body);
  proxyReq.end();
}

const server = http.createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  
  // API proxy endpoints
  if (req.method === 'POST' && req.url === '/api/generate') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      proxyToAnthropic(req, res, body);
    });
    return;
  }
  
  if (req.method === 'POST' && req.url === '/api/transcribe') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      proxyToNvidia(req, res, body);
    });
    return;
  }
  
  // Serve static files
  if (req.method === 'GET') {
    serveStaticFile(req, res);
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                     Figural Server                         ║
╠════════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                  ║
║                                                            ║
║  This server:                                              ║
║  • Serves the web app                                      ║
║  • Proxies API requests to avoid CORS issues               ║
║                                                            ║
║  Press Ctrl+C to stop                                      ║
╚════════════════════════════════════════════════════════════╝
`);
});
