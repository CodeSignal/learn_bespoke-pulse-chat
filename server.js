const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

let WebSocket = null;
let isWebSocketAvailable = false;
try {
  WebSocket = require('ws');
  isWebSocketAvailable = true;
  console.log('WebSocket support enabled');
} catch (error) {
  console.log('WebSocket support disabled (ws package not installed)');
}

const DIST_DIR = path.join(__dirname, 'dist');
const STATIC_DIR = process.env.SERVE_DIR
  ? path.join(__dirname, process.env.SERVE_DIR)
  : DIST_DIR;
const isProduction = process.env.IS_PRODUCTION === 'true';
if (isProduction && !fs.existsSync(STATIC_DIR)) {
  throw new Error(`Production mode enabled but serve directory does not exist: ${STATIC_DIR}`);
}
const PORT = process.env.PORT || 3000;
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');

const wsClients = new Set();

const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'events.jsonl');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const mimeTypes = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject'
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'text/plain';
}

function serveFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

async function handleChatRequest(req, res) {
  try {
    const data = await readBody(req);
    const { messages, persona } = data;

    if (!messages || !Array.isArray(messages)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'messages array is required' }));
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const fallback = generateFallbackResponse(persona);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ response: fallback }));
      return;
    }

    const systemMessage = {
      role: 'system',
      content: persona || 'You are a helpful coworker in a workplace chat. Keep responses brief, friendly, and conversational (1-3 sentences).'
    };

    const apiRes = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [systemMessage, ...messages],
        max_tokens: 200,
        temperature: 0.8
      })
    });

    if (!apiRes.ok) {
      const errBody = await apiRes.text();
      console.error('OpenAI API error:', apiRes.status, errBody);
      const fallback = generateFallbackResponse(persona);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ response: fallback }));
      return;
    }

    const result = await apiRes.json();
    const reply = result.choices?.[0]?.message?.content || 'Sorry, I didn\'t catch that.';

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ response: reply }));

  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

function generateFallbackResponse(persona) {
  const responses = [
    'Sounds good, let me look into that!',
    'Got it, thanks for the update!',
    'Makes sense. Let me know if you need anything else.',
    'Good point! I\'ll follow up on that.',
    'Sure thing, I\'ll get back to you shortly.',
    'That works for me. Talk soon!',
    'Interesting, I hadn\'t thought of it that way.',
    'Appreciate the heads up! I\'ll take care of it.'
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

async function handleLogRequest(req, res) {
  try {
    const data = await readBody(req);
    const entries = data.entries;
    if (!Array.isArray(entries) || entries.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'entries array is required' }));
      return;
    }
    const lines = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
    fs.appendFile(LOG_FILE, lines, (err) => {
      if (err) console.error('Failed to write log:', err);
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, count: entries.length }));
  } catch (error) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
  }
}

function handlePostRequest(req, res, parsedUrl) {
  if (parsedUrl.pathname === '/api/log') {
    handleLogRequest(req, res);
    return;
  }

  if (parsedUrl.pathname === '/api/chat') {
    handleChatRequest(req, res);
    return;
  }

  if (parsedUrl.pathname === '/message') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (!data.message) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Message is required' }));
          return;
        }
        if (!isWebSocketAvailable) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'WebSocket not available' }));
          return;
        }
        wsClients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'message', message: data.message }));
          }
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, clientCount: wsClients.size }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathName = parsedUrl.pathname === '/' ? '/index.html' : parsedUrl.pathname;

  if (req.method === 'POST') {
    handlePostRequest(req, res, parsedUrl);
    return;
  }

  if (isProduction) {
    let filePath = path.join(STATIC_DIR, pathName.replace(/^\/+/, ''));
    const resolvedStaticDir = path.resolve(STATIC_DIR);
    const resolvedFilePath = path.resolve(filePath);
    if (path.relative(resolvedStaticDir, resolvedFilePath).startsWith('..')) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }
    serveFile(filePath, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found (development mode - use Vite dev server)');
  }
});

if (isWebSocketAvailable) {
  const wss = new WebSocket.Server({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    wsClients.add(ws);
    ws.on('close', () => { wsClients.delete(ws); });
    ws.on('error', () => { wsClients.delete(ws); });
  });
}

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  if (isProduction) console.log(`Serving static files from: ${STATIC_DIR}`);
  else console.log('Development mode - static files served by Vite');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`Port ${PORT} is already in use.`);
  else console.error('Server error:', err);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => process.exit(0));
});
