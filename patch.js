const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /app\.post\("\/api\/generate-image"[\s\S]*?Failed to generate image"\s*\}\);\s*\}\);/m;

const replacement = `app.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt, action, base64ImageData, mimeType, aspectRatio = "1:1", imageSize = "1K" } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY environment variable is not configured." });
      }
      
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      
      const modelName = 'gemini-3.1-flash-image';
      
      if (action === "edit" && base64ImageData && mimeType) {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              {
                inlineData: {
                  data: base64ImageData,
                  mimeType: mimeType,
                },
              },
              {
                text: \`\${prompt}. IMPORTANT: Ensure the editing looks completely natural and not like AI editing.\`,
              },
            ],
          },
          config: {
            imageConfig: {
              aspectRatio,
              imageSize
            }
          }
        });
        
        let base64Bytes = null;
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            base64Bytes = part.inlineData.data;
            break;
          }
        }

        if (base64Bytes) {
          res.json({ generatedImage: \`data:image/jpeg;base64,\${base64Bytes}\` });
        } else {
          res.status(500).json({ error: "Failed to generate image bytes" });
        }
      } else {
         const mandatoryDescriptors = "Photorealistic, 8k resolution, cinematic lighting (Ray Tracing), HDR, micro-details (skin pores, water reflections, realistic textures, weave/grain), sharp focus, professional high-end photography. No digital art, no painting.";
         const finalPrompt = \`\${mandatoryDescriptors} - Subject: \${prompt}\`;
         
         const response = await ai.models.generateContent({
           model: modelName,
           contents: {
             parts: [{ text: finalPrompt }]
           },
           config: {
             imageConfig: {
               aspectRatio,
               imageSize
             }
           }
         });
         
         let base64Bytes = null;
         for (const part of response.candidates?.[0]?.content?.parts || []) {
           if (part.inlineData) {
             base64Bytes = part.inlineData.data;
             break;
           }
         }

         if (base64Bytes) {
           res.json({ generatedImage: \`data:image/jpeg;base64,\${base64Bytes}\` });
         } else {
           res.status(500).json({ error: "Failed to generate image bytes" });
         }
      }
    } catch (e: any) {
      console.error("[Image Generation API] Error:", e);
      res.status(500).json({ error: e.message || "Failed to generate image" });
    }
  });`;

if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('server.ts', code, 'utf8');
    console.log("Success");
} else {
    console.log("Regex not found");
}
