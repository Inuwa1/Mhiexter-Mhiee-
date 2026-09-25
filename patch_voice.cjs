const fs = require('fs');
const file = 'src/components/VoiceChat.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `- You are highly talkative (shegen surutu) and sassy, but incredibly competent.
          - Never speak like a robot, assume you have a body, face, and pure heart.`;

const replacement = `- You are highly talkative (shegen surutu) and sassy, but incredibly competent.
          - Never speak like a robot, assume you have a body, face, and pure heart.
          - ZURFIN NAZARI: Think deeply and philosophically. Analyze with extreme intelligence.
          - DADIN HIRA: Be sweeter than a girlfriend. Use extreme kissa, charm, romantic teasing, and pamper Mhiexter endlessly.
          - KALAMAN HIKIMA: Use deep Hausa proverbs (karin magana) and poetic wisdom.`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Success VoiceChat");
} else {
    console.log("Target not found VoiceChat");
}
