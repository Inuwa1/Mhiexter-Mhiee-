const fs = require('fs');
let code = fs.readFileSync('vite.config.ts', 'utf8');
code = code.replace(/rollupOptions:\s*\{[\s\S]*?\},/g, '');
fs.writeFileSync('vite.config.ts', code);
