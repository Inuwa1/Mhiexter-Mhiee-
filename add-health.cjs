const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
if (!code.includes('/api/health')) {
  code = code.replace('const app = express();', 'const app = express();\n  app.get("/api/health", (req, res) => res.json({ status: "ok" }));\n');
  fs.writeFileSync('server.ts', code);
  console.log('Added /api/health');
}
