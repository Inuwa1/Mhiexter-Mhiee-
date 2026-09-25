const seed = Math.floor(Math.random() * 1000000);
const finalPrompt = "test prompt";
const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&seed=${seed}&nologo=true`;
console.log(imageUrl);
fetch(imageUrl, { signal: AbortSignal.timeout(10000) })
  .then(res => console.log(res.status))
  .catch(err => console.error(err));
