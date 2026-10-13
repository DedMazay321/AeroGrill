// Локальный просмотр интерфейса в браузере: node tools/serve.js → http://localhost:5173
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'www');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
http.createServer((req, res) => {
  const file = path.join(root, path.normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^([/\\]|\.\.)+/, '') || 'index.html');
  fs.readFile(file.startsWith(root) ? file : root, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(5173, () => console.log('http://localhost:5173'));
