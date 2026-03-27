import React, { useState } from 'react';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { GoogleGenAI, Type } from '@google/genai';
import { Loader2, Download, BookOpen, Bold, Type as TypeIcon, Image as ImageIcon, Palette, Calculator } from 'lucide-react';

const styles = StyleSheet.create({
  page: { padding: 30 },
  title: { fontSize: 24, marginBottom: 20, textAlign: 'center' },
  chapterTitle: { fontSize: 18, marginTop: 15, marginBottom: 10 },
  paragraph: { fontSize: 12, marginBottom: 10, lineHeight: 1.5 },
  image: { width: '100%', marginBottom: 10 },
});

const PDFDocument = ({ title, content }: { title: string, content: any }) => (
  <Document>
    <Page size="A4" style={[styles.page, { fontFamily: content.font }]}>
      <Text style={[styles.title, { textTransform: content.titleUppercase ? 'uppercase' : 'none' }]}>{title}</Text>
      {content.chapters.map((chapter: any, index: number) => (
        <View key={index}>
          <Text style={styles.chapterTitle}>{index + 1}. {chapter.title}</Text>
          {chapter.paragraphs.map((p: any, pIndex: number) => (
            <View key={pIndex}>
              {p.photoUrl && <Image src={p.photoUrl} style={styles.image} />}
              <Text style={[styles.paragraph, { color: p.color, fontWeight: p.bold ? 'bold' : 'normal', textTransform: p.uppercase ? 'uppercase' : 'none' }]}>{p.text}</Text>
            </View>
          ))}
        </View>
      ))}
    </Page>
  </Document>
);

export default function BookGenerator() {
  const [topic, setTopic] = useState('');
  const [bookData, setBookData] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [problem, setProblem] = useState('');
  const [isSolving, setIsSolving] = useState(false);
  const [stylingSuggestions, setStylingSuggestions] = useState<any>(null);

  const generateBook = async () => {
    if (!topic) return;
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `Write a book about: ${topic}. Include title, 3 chapters, 3 paragraphs each. If the topic is related to calculations (math, physics, chemistry), include a chapter titled 'Practice Problems' with many simple and tricky questions and answers, solved step-by-step with detailed explanations for every move and formula derivation. Also suggest styling options (font: Helvetica, Times-Roman, or Courier; titleUppercase: true or false). Return JSON with book content and stylingSuggestions.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              chapters: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    paragraphs: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["title", "paragraphs"]
                }
              },
              stylingSuggestions: {
                type: Type.OBJECT,
                properties: {
                  font: { type: Type.STRING },
                  titleUppercase: { type: Type.BOOLEAN }
                }
              }
            },
            required: ["title", "chapters", "stylingSuggestions"]
          }
        }
      });
      const data = JSON.parse(response.text!);
      setBookData({
        ...data,
        font: 'Helvetica',
        titleUppercase: false,
        chapters: data.chapters.map((c: any) => ({
          ...c,
          paragraphs: c.paragraphs.map((p: string) => ({ text: p, bold: false, uppercase: false, photoUrl: '', color: 'black' }))
        }))
      });
      setStylingSuggestions(data.stylingSuggestions);
    } catch (error) { console.error(error); } finally { setIsGenerating(false); }
  };

  const solveProblem = async () => {
    if (!problem || !bookData) return;
    setIsSolving(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `Solve this problem step-by-step: ${problem}. Make it very easy to understand. Return as a single string of text.`,
      });
      const solution = response.text!;
      const newData = {...bookData};
      newData.chapters[0].paragraphs.push({ text: `Solved Problem: ${problem}\n\n${solution}`, bold: false, uppercase: false, photoUrl: '', color: 'black' });
      setBookData(newData);
    } catch (error) { console.error(error); } finally { setIsSolving(false); }
  };

  return (
    <div className="p-6 bg-zinc-900 text-zinc-100 rounded-xl h-full overflow-y-auto">
      <h2 className="text-2xl font-bold mb-4">Book Generator</h2>
      <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Enter book topic..." className="w-full p-3 bg-zinc-800 rounded-lg mb-4" />
      <button onClick={generateBook} className="px-4 py-2 bg-indigo-600 rounded-lg flex items-center gap-2">
        {isGenerating ? <Loader2 className="animate-spin" /> : <BookOpen />} Generate Book
      </button>

      {stylingSuggestions && (
        <div className="mt-4 p-4 bg-zinc-800 rounded-lg">
          <h4 className="font-bold">AI Styling Suggestions:</h4>
          <p>Font: {stylingSuggestions.font}, Uppercase Title: {stylingSuggestions.titleUppercase ? 'Yes' : 'No'}</p>
          <button onClick={() => setBookData({...bookData, font: stylingSuggestions.font, titleUppercase: stylingSuggestions.titleUppercase})} className="mt-2 px-2 py-1 bg-emerald-600 rounded">Apply Suggestions</button>
        </div>
      )}

      {bookData && (
        <div className="mt-6">
          <div className="mb-4 p-4 bg-zinc-800 rounded-lg">
            <h4 className="font-bold mb-2">Solve Problem:</h4>
            <input value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="Enter math/physics/chem problem..." className="w-full p-2 bg-zinc-700 rounded mb-2" />
            <button onClick={solveProblem} className="px-4 py-2 bg-amber-600 rounded-lg flex items-center gap-2">
              {isSolving ? <Loader2 className="animate-spin" /> : <Calculator />} Solve Step-by-Step
            </button>
          </div>

          <select value={bookData.font} onChange={(e) => setBookData({...bookData, font: e.target.value})} className="bg-zinc-800 p-2 rounded mb-2">
            <option value="Helvetica">Helvetica</option>
            <option value="Times-Roman">Times-Roman</option>
            <option value="Courier">Courier</option>
          </select>
          <h3 className="text-xl font-semibold">{bookData.title}</h3>
          {bookData.chapters.map((chapter: any, cIndex: number) => (
            <div key={cIndex} className="mt-4 border-t border-zinc-700 pt-4">
              <input value={chapter.title} onChange={(e) => { const newData = {...bookData}; newData.chapters[cIndex].title = e.target.value; setBookData(newData); }} className="text-lg font-bold bg-zinc-800 w-full p-2 rounded" />
              {chapter.paragraphs.map((p: any, pIndex: number) => (
                <div key={pIndex} className="mt-2 p-2 bg-zinc-800 rounded">
                  <textarea value={p.text} onChange={(e) => { const newData = {...bookData}; newData.chapters[cIndex].paragraphs[pIndex].text = e.target.value; setBookData(newData); }} className="w-full bg-transparent" />
                  <div className="flex gap-2 mt-1 items-center">
                    <button onClick={() => { const newData = {...bookData}; newData.chapters[cIndex].paragraphs[pIndex].bold = !p.bold; setBookData(newData); }} className={`p-1 ${p.bold ? 'bg-indigo-600' : 'bg-zinc-700'} rounded`}><Bold size={16}/></button>
                    <button onClick={() => { const newData = {...bookData}; newData.chapters[cIndex].paragraphs[pIndex].uppercase = !p.uppercase; setBookData(newData); }} className={`p-1 ${p.uppercase ? 'bg-indigo-600' : 'bg-zinc-700'} rounded`}><TypeIcon size={16}/></button>
                    <button onClick={() => { const newData = {...bookData}; newData.chapters[cIndex].paragraphs[pIndex].color = 'black'; setBookData(newData); }} className="p-1 bg-black rounded border border-zinc-600" title="Black" />
                    <button onClick={() => { const newData = {...bookData}; newData.chapters[cIndex].paragraphs[pIndex].color = 'red'; setBookData(newData); }} className="p-1 bg-red-600 rounded" title="Red" />
                    <button onClick={() => { const newData = {...bookData}; newData.chapters[cIndex].paragraphs[pIndex].color = 'green'; setBookData(newData); }} className="p-1 bg-green-600 rounded" title="Green" />
                    <input placeholder="Photo URL" value={p.photoUrl} onChange={(e) => { const newData = {...bookData}; newData.chapters[cIndex].paragraphs[pIndex].photoUrl = e.target.value; setBookData(newData); }} className="bg-zinc-700 p-1 rounded text-xs flex-1" />
                  </div>
                </div>
              ))}
            </div>
          ))}
          <PDFDownloadLink document={<PDFDocument title={bookData.title} content={bookData} />} fileName="book.pdf" className="mt-6 px-4 py-2 bg-green-600 rounded-lg flex items-center gap-2">
            {({ blob, url, loading, error }) => (loading ? 'Loading document...' : <><Download /> Download PDF</>)}
          </PDFDownloadLink>
        </div>
      )}
    </div>
  );
}
