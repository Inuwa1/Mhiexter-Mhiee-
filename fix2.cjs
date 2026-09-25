const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "  try {\n    const ytModule = await import('youtubei.js');\n    Innertube = ytModule.Innertube;\n    UniversalCache = ytModule.UniversalCache;\n  try {\n    yt = await Innertube.create",
  "  try {\n    const ytModule = await import('youtubei.js');\n    Innertube = ytModule.Innertube;\n    UniversalCache = ytModule.UniversalCache;\n    yt = await Innertube.create"
);

fs.writeFileSync('server.ts', code);
console.log('fixed');
