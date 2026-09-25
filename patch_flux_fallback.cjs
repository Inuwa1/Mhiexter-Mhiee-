const fs = require('fs');
let code = fs.readFileSync('src/image-router.ts', 'utf8');

const regex = /if \(apiKey\) \{([\s\S]*?)\} else \{\s*\/\/ Fallback to Pollinations/m;
const match = code.match(regex);

if (match) {
  let replacement = `if (apiKey) {
      try {
${match[1]}
      } catch (e: any) {
        console.error(\`[FluxProvider] API failed with key, falling back to Pollinations: \${e.message}\`);
      }
    }
    
    // Fallback to Pollinations`;
    
  code = code.replace(regex, replacement);
  fs.writeFileSync('src/image-router.ts', code);
  console.log("Patched FluxProvider fallback");
} else {
  console.log("Could not find regex match");
}
