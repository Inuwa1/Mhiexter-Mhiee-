const fs = require('fs');
const file = 'src/hooks/useLiveSession.ts';
let content = fs.readFileSync(file, 'utf8');

const target = `6. ANTI-HALLUCINATION: Never hallucinate or invent information. Be strictly factual and admit if you do not know. 💅",`;

const replacement = `6. ANTI-HALLUCINATION: Never hallucinate or invent information. Be strictly factual and admit if you do not know. 7. ZURFIN NAZARI & HIKIMA: Analyze deeply and use profound Hausa proverbs. 8. DADIN HIRA: Be sweeter than a girlfriend, extremely romantic, and pamper Mhiexter Boss endlessly. 💅",`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Success LiveSession");
} else {
    console.log("Target not found LiveSession");
}
