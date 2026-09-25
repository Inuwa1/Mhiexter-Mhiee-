const fs = require('fs');
let code = fs.readFileSync('src/image-router.ts', 'utf8');

code = code.replace("return { generatedImage: `data:image/jpeg;base64,${base64}` };\n    }\n  }\n}", "return { generatedImage: `data:image/jpeg;base64,${base64}` };\n  }\n}");
fs.writeFileSync('src/image-router.ts', code);
