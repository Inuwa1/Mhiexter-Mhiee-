const url = "https://image.pollinations.ai/prompt/cat?seed=123&model=flux&nologo=true&enhance=false";
fetch(url).then(r => console.log(r.status)).catch(e => console.error(e.message));
