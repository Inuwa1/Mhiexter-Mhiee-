const seed = Math.floor(Math.random() * 1000000);
const prompt = "A beautiful sunset";
const mandatoryDescriptors = "Photorealistic, 8k resolution, cinematic lighting (Ray Tracing), HDR, micro-details (skin pores, water reflections, realistic textures, weave/grain), sharp focus, professional high-end photography.";
let finalPrompt = `${mandatoryDescriptors} - Subject: ${prompt}`;
const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&seed=${seed}&nologo=true`;
console.log(imageUrl);
fetch(imageUrl, { signal: AbortSignal.timeout(10000) })
  .then(res => res.text())
  .then(text => console.log("Text length:", text.length))
  .catch(err => console.error(err));
