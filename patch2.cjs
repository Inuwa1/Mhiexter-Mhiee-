const fs = require('fs');
let content = fs.readFileSync('src/components/MhieeBrowser.tsx', 'utf-8');

const targetDrop = `  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);`;

const replacementDrop = `  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const getAllFilesFromEntries = async (entries: any[]) => {
       const files: File[] = [];
       for (const entry of entries) {
           if (entry.isFile) {
               const file = await new Promise<File>(resolve => entry.file(resolve));
               files.push(file);
           } else if (entry.isDirectory) {
               const dirReader = entry.createReader();
               const dirEntries = await new Promise<any[]>(resolve => {
                   dirReader.readEntries(resolve);
               });
               const nestedFiles = await getAllFilesFromEntries(dirEntries);
               files.push(...nestedFiles);
           }
       }
       return files;
    };

    let files: File[] = [];
    if (e.dataTransfer.items) {
        const items = Array.from(e.dataTransfer.items).map(item => item.webkitGetAsEntry()).filter(Boolean);
        files = await getAllFilesFromEntries(items);
    } else {
        files = Array.from(e.dataTransfer.files);
    }`;

if (content.includes(targetDrop)) {
    content = content.replace(targetDrop, replacementDrop);
    fs.writeFileSync('src/components/MhieeBrowser.tsx', content, 'utf-8');
    console.log('Successfully patched drop handler');
} else {
    console.log('Target drop not found');
}
