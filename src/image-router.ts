import { GoogleGenAI } from "@google/genai";

export interface ImageRouterRequest {
  prompt: string;
  action: string;
  images?: string[];
  apiKey?: string;
  preferred_provider?: "gemini" | "openai" | "flux";
}

export interface ImageRouterResponse {
  generatedImage?: string;
  textResponse?: string;
  error?: string;
}

export interface StructuredImageInstruction {
  task: "IMAGE_GENERATION" | "IMAGE_EDIT" | "IMAGE_VARIATION" | "IMAGE_EXTENSION" | "IMAGE_ENHANCEMENT" | "IMAGE_ANALYSIS";
  enhanced_prompt: string;
  preserve_identity: boolean;
  preserve_face: boolean;
  preserve_style: boolean;
  pose?: string;
  framing?: string;
  unwanted_changes: string[];
  preferred_provider: "gemini" | "openai" | "flux";
}

interface ImageProvider {
  name: string;
  isAvailable(): boolean;
  process(req: ImageRouterRequest, instruction: StructuredImageInstruction): Promise<ImageRouterResponse>;
}

// Global cache for providers to check environment
const getEnv = (key: string) => process.env[key];

class GeminiProvider implements ImageProvider {
  name = "gemini";
  
  isAvailable(): boolean {
    return !!getEnv("GEMINI_API_KEY");
  }

  async process(req: ImageRouterRequest, instruction: StructuredImageInstruction): Promise<ImageRouterResponse> {
    let apiKey = req.apiKey || getEnv("GEMINI_API_KEY");
    if (req.apiKey && !req.apiKey.startsWith("AIza")) {
      apiKey = getEnv("GEMINI_API_KEY");
    }
    if (!apiKey) throw new Error("Gemini API key missing");

    console.log("IMAGE GEN KEY:", apiKey ? apiKey.substring(0, 4) + "..." + apiKey.length : "undefined");
    const ai = new GoogleGenAI({ 
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    if (instruction.task === "IMAGE_ANALYSIS") {
      const parts: any[] = [{ text: instruction.enhanced_prompt }];
      if (req.images && req.images.length > 0) {
        for (const img of req.images) {
          const match = img.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
          if (match) {
            parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
          }
        }
      }
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: { parts },
        config: { responseMimeType: "application/json" }
      });
      return { textResponse: response.text };
    } else {
      const parts: any[] = [{ text: instruction.enhanced_prompt }];
      if (instruction.task !== "IMAGE_GENERATION" && req.images && req.images.length > 0) {
          const img = req.images[req.images.length - 1];
          const match = img.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
          if (match) {
            parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
          }
      }
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image',
        contents: { parts },
        config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } }
      });
      
      let base64Bytes = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          base64Bytes = part.inlineData.data;
          break;
        }
      }
      
      if (base64Bytes) {
        return { generatedImage: `data:image/jpeg;base64,${base64Bytes}` };
      }
      throw new Error("Gemini returned empty image data");
    }
  }
}

class OpenAIProvider implements ImageProvider {
  name = "openai";
  
  isAvailable(): boolean {
    return !!getEnv("OPENAI_API_KEY");
  }

  async process(req: ImageRouterRequest, instruction: StructuredImageInstruction): Promise<ImageRouterResponse> {
    const apiKey = getEnv("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OpenAI API key missing");

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: instruction.enhanced_prompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json"
      })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI API Error: ${res.status} ${err}`);
    }

    const data = await res.json();
    if (data.data && data.data[0] && data.data[0].b64_json) {
        return { generatedImage: `data:image/png;base64,${data.data[0].b64_json}` };
    }
    throw new Error("OpenAI generation failed");
  }
}

class FluxProvider implements ImageProvider {
  name = "flux";
  
  isAvailable(): boolean {
    return true;
  }

  async process(req: ImageRouterRequest, instruction: StructuredImageInstruction): Promise<ImageRouterResponse> {
    let apiKey = getEnv("FLUX_API_KEY") || getEnv("REPLICATE_API_TOKEN");
    if (req.apiKey && !req.apiKey.startsWith("AIza") && req.apiKey !== "fake") {
        apiKey = req.apiKey;
    }
    
    if (apiKey) {
      try {
        if (apiKey.startsWith("r8_")) {
            const replicateUrl = 'https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions';
            const createRes = await fetch(replicateUrl, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "Prefer": "wait"
              },
              body: JSON.stringify({
                input: {
                  prompt: instruction.enhanced_prompt,
                  aspect_ratio: "1:1",
                  output_format: "jpg"
                }
              })
            });

            if (!createRes.ok) throw new Error(`Flux (Replicate) API Error: ${createRes.status}`);
            let prediction = await createRes.json();
            
            let attempts = 0;
            while (prediction.status !== "succeeded" && prediction.status !== "failed" && attempts < 30) {
              await new Promise(r => setTimeout(r, 2000));
              const pollRes = await fetch(prediction.urls.get, { headers: { "Authorization": `Bearer ${apiKey}` } });
              prediction = await pollRes.json();
              attempts++;
            }

            if (prediction.status === "succeeded" && prediction.output) {
              const imageUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
              const imgRes = await fetch(imageUrl);
              const arrayBuffer = await imgRes.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString('base64');
              return { generatedImage: `data:image/jpeg;base64,${base64}` };
            }
            throw new Error("Flux generation failed or timed out");
        } else {
            const bflUrl = 'https://api.bfl.ai/v1/flux-pro-1.1-ultra';
            const createRes = await fetch(bflUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-key': apiKey },
                body: JSON.stringify({ prompt: instruction.enhanced_prompt, aspect_ratio: "1:1" })
            });
            if (!createRes.ok) throw new Error(`Flux (BFL) API Error: ${createRes.status}`);
            const { id } = await createRes.json();
            
            let attempts = 0;
            while (attempts < 30) {
                await new Promise(r => setTimeout(r, 2000));
                const pollRes = await fetch(`https://api.bfl.ai/v1/get_result?id=${id}`, {
                    headers: { 'x-key': apiKey }
                });
                const pollData = await pollRes.json();
                if (pollData.status === 'Ready') {
                    const imgRes = await fetch(pollData.result.sample);
                    const arrayBuffer = await imgRes.arrayBuffer();
                    const base64 = Buffer.from(arrayBuffer).toString('base64');
                    return { generatedImage: `data:image/jpeg;base64,${base64}` };
                } else if (pollData.status === 'Failed') {
                    throw new Error("Flux (BFL) generation failed");
                }
                attempts++;
            }
            throw new Error("Flux generation timed out");
        }
       
      } catch (e: any) {
        console.log(`[FluxProvider] API failed with key, falling back to Pollinations: ${e.message}`);
      }
    }
    
    console.log("[ImageRouter] Using Pollinations Flux fallback...");
    const seed = Math.floor(Math.random() * 1000000);
    const encodedPrompt = encodeURIComponent(instruction.enhanced_prompt);
    const imgUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&model=flux&nologo=true&enhance=false`;
       
    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) throw new Error("Pollinations Flux failed");
       
    const arrayBuffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return { generatedImage: `data:image/jpeg;base64,${base64}` };
  }
}

export class ImageRouter {
  providers: ImageProvider[];
  
  constructor() {
    this.providers = [new GeminiProvider(), new FluxProvider(), new OpenAIProvider()];
  }
  
  async route(req: ImageRouterRequest): Promise<ImageRouterResponse> {
    let apiKey = req.apiKey || getEnv("GEMINI_API_KEY");
    if (req.apiKey && !req.apiKey.startsWith("AIza")) {
      apiKey = getEnv("GEMINI_API_KEY");
    }
    let instruction: StructuredImageInstruction;
    if (!apiKey) {
      console.log("No Gemini API key available for intent detection, bypassing and using basic instructions.");
      instruction = {
        task: req.action === "edit" || req.action === "face_replace" || req.action === "edit_object" ? "IMAGE_EDIT" : (req.action === "identify_objects" ? "IMAGE_ANALYSIS" : "IMAGE_GENERATION"),
        enhanced_prompt: req.prompt,
        preserve_identity: true,
        preserve_face: true,
        preserve_style: true,
        unwanted_changes: [],
        preferred_provider: (req.preferred_provider || "flux") as any
      };
    } else {
      try {
        console.log("INTENT DETECTION KEY:", apiKey ? apiKey.substring(0, 4) + "..." + apiKey.length : "undefined");
        const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });

        const systemPrompt = `You are the Mhiee Brain Image Router. Analyze the user's prompt: "${req.prompt}". 
        The user is asking to do an image action (currently requested action: ${req.action}).
        Classify the task into: IMAGE_GENERATION, IMAGE_EDIT, IMAGE_VARIATION, IMAGE_EXTENSION, IMAGE_ENHANCEMENT, or IMAGE_ANALYSIS.
        Create a highly detailed, professional image prompt based on the user's request. 
        If it's an edit, add preservation instructions for identity, face, style.
        Choose the preferred_provider: gemini, openai, or flux. (If req.preferred_provider is specified by the system, you MUST use that exact provider). \n      Requested explicit provider: ${req.preferred_provider || "None (choose automatically based on request: prefer flux for ultra-photorealism, gemini otherwise)"}
        Return ONLY a JSON object matching this schema:
        {
          "task": "IMAGE_GENERATION | IMAGE_EDIT | IMAGE_VARIATION | IMAGE_EXTENSION | IMAGE_ENHANCEMENT | IMAGE_ANALYSIS",
          "enhanced_prompt": "string",
          "preserve_identity": boolean,
          "preserve_face": boolean,
          "preserve_style": boolean,
          "pose": "string (optional)",
          "framing": "string (optional)",
          "unwanted_changes": ["string"],
          "preferred_provider": "gemini | openai | flux"
        }`;

        console.log("[ImageRouter] Analyzing intent...");
        const intentResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: { parts: [{ text: systemPrompt }] },
          config: { responseMimeType: "application/json" }
        });

        let rawText = intentResponse.text || "{}";
        rawText = rawText.replace(/^\s*```json/i, '').replace(/```\s*$/, '').trim();
        instruction = JSON.parse(rawText);
      } catch (e) {
        console.warn("[ImageRouter] Intent detection failed (bad key or parse error), falling back to Flux directly:", e);
        instruction = {
          task: req.action === "edit" || req.action === "face_replace" || req.action === "edit_object" ? "IMAGE_EDIT" : (req.action === "identify_objects" ? "IMAGE_ANALYSIS" : "IMAGE_GENERATION"),
          enhanced_prompt: req.prompt + " - Photorealistic, 8k resolution, professional high-end photography.",
          preserve_identity: true,
          preserve_face: true,
          preserve_style: true,
          unwanted_changes: [],
          preferred_provider: (req.preferred_provider || "flux") as any
        };
      }
    }
    
    console.log("[ImageRouter] Structured Instruction:", instruction);
    
    const isEditTask = instruction.task !== "IMAGE_GENERATION" && instruction.task !== "IMAGE_ANALYSIS";
    const hasInputImages = !!(req.images && req.images.length > 0);
    
    let selectedProvider: ImageProvider | undefined;
    
    if (isEditTask && hasInputImages) {
      // Only Gemini can actually see and edit an uploaded/previous image.
      // Flux/Pollinations and OpenAI in this codebase ignore input images entirely,
      // which causes them to silently generate an unrelated new image.
      selectedProvider = this.providers.find(p => p.name === "gemini" && p.isAvailable());
      if (!selectedProvider) {
        throw new Error("Editing an existing image requires a working Gemini API key. Please configure GEMINI_API_KEY.");
      }
      console.log("[ImageRouter] Edit task with input images detected — forcing Gemini provider.");
    } else {
      selectedProvider = this.providers.find(p => p.name === instruction.preferred_provider && p.isAvailable());
      if (!selectedProvider) {
        console.log(`[ImageRouter] Preferred provider ${instruction.preferred_provider} unavailable, falling back.`);
        selectedProvider = this.providers.find(p => p.isAvailable());
      }
    }
    
    if (!selectedProvider) {
      throw new Error("No image providers are configured. Please add GEMINI_API_KEY, OPENAI_API_KEY, or FLUX_API_KEY.");
    }
    
    console.log(`[ImageRouter] Routing to ${selectedProvider.name}...`);
    
    try {
      return await selectedProvider.process(req, instruction);
    } catch (e: any) {
      console.warn(`[ImageRouter] Provider ${selectedProvider.name} failed: ${e.message}`);
      
      if (isEditTask && hasInputImages) {
        // Don't fall back to Flux/OpenAI for edits — they'd silently produce
        // a completely unrelated image instead of a clear error.
        throw e;
      }
      
      for (const p of this.providers) {
        if (p !== selectedProvider && p.isAvailable()) {
           console.log(`[ImageRouter] Falling back to ${p.name}...`);
           try {
             return await p.process(req, instruction);
           } catch (fallbackError) {
             console.warn(`[ImageRouter] Fallback provider ${p.name} failed.`);
           }
        }
      }
      throw e;
    }
  }
}
