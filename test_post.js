fetch("http://localhost:3000/api/image-router", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: "A beautiful cat", action: "generate" })
}).then(res => res.json()).then(console.log).catch(console.error);
