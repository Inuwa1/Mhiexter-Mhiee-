const fs = require('fs');
let content = fs.readFileSync('src/components/MhieeBrowser.tsx', 'utf-8');

const target1 = `                   } else if (file.name.endsWith('.pdf') || file.name.endsWith('.docx') || file.name.endsWith('.zip') || file.type === 'application/pdf' || file.type === 'application/zip' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {`;
const replacement1 = `                   } else if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/')) {`;

// Replace all occurrences of target1
content = content.split(target1).join(replacement1);

const target2 = `                          if (file.name.endsWith('.pdf') || file.name.endsWith('.docx') || file.name.endsWith('.zip')) {`;
const replacement2 = `                          if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/') && !file.type.startsWith('text/') && file.type !== 'application/json' && !file.name.match(/\\.(js|ts|tsx|py)$/)) {`;
content = content.split(target2).join(replacement2);


// Also update the text file check in handleDrop and handleFileUpload to cover more extensions just in case
const textCheckTarget = `if (file.type.startsWith('text/') || file.type === 'application/json' || file.name.endsWith('.js') || file.name.endsWith('.ts') || file.name.endsWith('.tsx') || file.name.endsWith('.py')) {`;
const textCheckReplacement = `if (file.type.startsWith('text/') || file.type === 'application/json' || file.name.match(/\\.(js|jsx|ts|tsx|py|css|html|xml|csv|sh|bat|md)$/i) || file.name.startsWith('.')) {`;
content = content.split(textCheckTarget).join(textCheckReplacement);


fs.writeFileSync('src/components/MhieeBrowser.tsx', content, 'utf-8');
console.log('Successfully patched fallback conditions in MhieeBrowser');
