const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');
const target = `  app.post("/api/parse-document", async (req, res) => {
    try {
      const { name, data, type } = req.body;
      if (!data) return res.status(400).json({ error: "Missing file data" });

      const base64Data = data.split(',')[1] || data;
      const buffer = Buffer.from(base64Data, 'base64');
      
      let textContent = '';

      if (name.endsWith('.pdf') || type === 'application/pdf') {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        const pdfData = await parser.getText();
        textContent = pdfData.text;
      } else if (name.endsWith('.docx') || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        textContent = result.value;
      } else if (name.endsWith('.zip') || type === 'application/zip' || type === 'application/x-zip-compressed') {
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(buffer);
        const files: string[] = [];
        
        for (const [filename, zipEntry] of Object.entries(zip.files)) {
          if (!zipEntry.dir) {
            // Only extract text from known text-based extensions
            if (filename.match(/\\.(txt|md|json|js|ts|jsx|tsx|py|csv|xml|html|css)$/i)) {
              try {
                const content = await zipEntry.async("text");
                files.push(\`--- File: \${filename} ---\\n\${content}\\n\`);
              } catch (e) {
                files.push(\`--- File: \${filename} (Could not parse text) ---\\n\`);
              }
            } else {
              files.push(\`--- File: \${filename} (Skipped non-text file) ---\\n\`);
            }
          }
        }
        textContent = files.join('\\n');
      } else {
        // Try parsing as raw text as fallback
        textContent = buffer.toString('utf-8');
      }

      res.json({ textContent });
    } catch (e: any) {
      console.error("[Parse Document] Error:", e);
      res.status(500).json({ error: e.message || "Failed to parse document" });
    }
  });`;

const replacement = `  app.post("/api/parse-document", async (req, res) => {
    try {
      const { name, data, type } = req.body;
      if (!data) return res.status(400).json({ error: "Missing file data" });

      const base64Data = data.split(',')[1] || data;
      const buffer = Buffer.from(base64Data, 'base64');
      
      let textContent = '';
      
      const ext = (name.split('.').pop() || '').toLowerCase();
      const officeTypes = ['docx', 'pptx', 'xlsx', 'odt', 'odp', 'ods', 'pdf', 'rtf', 'csv', 'epub'];

      if (officeTypes.includes(ext)) {
        const { parseOffice } = await import('officeparser');
        textContent = await parseOffice(buffer);
      } else if (ext === 'zip' || type === 'application/zip' || type === 'application/x-zip-compressed') {
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(buffer);
        const files = [];
        
        for (const [filename, zipEntry] of Object.entries(zip.files)) {
          if (!zipEntry.dir) {
            const innerExt = (filename.split('.').pop() || '').toLowerCase();
            try {
              if (officeTypes.includes(innerExt)) {
                 const innerBuffer = await zipEntry.async("nodebuffer");
                 const { parseOffice } = await import('officeparser');
                 const content = await parseOffice(innerBuffer);
                 files.push(\`--- File: \${filename} ---\\n\${content}\\n\`);
              } else if (innerExt.match(/^(txt|md|json|js|ts|jsx|tsx|py|csv|xml|html|css|java|c|cpp|cs|php|rb|go|rs|swift|kt|sh|bat)$/i) || filename.startsWith('.')) {
                 const content = await zipEntry.async("text");
                 files.push(\`--- File: \${filename} ---\\n\${content}\\n\`);
              } else {
                 files.push(\`--- File: \${filename} (Skipped non-text/office file) ---\\n\`);
              }
            } catch (e) {
              files.push(\`--- File: \${filename} (Could not parse) ---\\n\`);
            }
          }
        }
        textContent = files.join('\\n');
      } else {
        // Try parsing as raw text as fallback
        textContent = buffer.toString('utf-8');
      }

      res.json({ textContent });
    } catch (e: any) {
      console.error("[Parse Document] Error:", e);
      res.status(500).json({ error: e.message || "Failed to parse document" });
    }
  });`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('server.ts', content, 'utf-8');
    console.log('Successfully patched server.ts');
} else {
    console.log('Target not found in server.ts');
}
