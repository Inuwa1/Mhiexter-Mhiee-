const { GoogleGenAI, RawReferenceImage } = require('@google/genai');

const raw = new RawReferenceImage();
raw.referenceId = 1;
raw.referenceImage = { imageBytes: 'base64', mimeType: 'image/jpeg' };

console.log(raw.toReferenceImageAPI());
