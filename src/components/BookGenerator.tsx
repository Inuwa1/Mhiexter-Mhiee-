import React, { useState, useEffect } from 'react';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { streamAiWithRetry, callAiWithRetry } from '../lib/aiUtils';
import { Loader2, Download, BookOpen, History, Plus } from 'lucide-react';

// Define types for the new structure
interface Chapter {
  title: string;
  content: string;
  status: 'pending' | 'generating' | 'done';
}

interface Book {
  id: string;
  title: string;
  chapters: Chapter[];
  font: string;
  titleUppercase: boolean;
}

const styles = StyleSheet.create({
  page: { padding: 90 },
  title: { fontSize: 24, marginBottom: 20, textAlign: 'center' },
  chapterTitle: { fontSize: 18, marginTop: 15, marginBottom: 10 },
  paragraph: { fontSize: 12, marginBottom: 10, lineHeight: 1.5 },
});

const PDFDocument = ({ book }: { book: Book }) => (
  <Document>
    <Page size="A4" style={[styles.page, { fontFamily: book.font }]}>
      <Text style={[styles.title, { textTransform: book.titleUppercase ? 'uppercase' : 'none' }]}>{book.title}</Text>
      {book.chapters.map((chapter, index) => (
        <View key={index}>
          <Text style={styles.chapterTitle}>{index + 1}. {chapter.title}</Text>
          <Text style={styles.paragraph}>{chapter.content}</Text>
        </View>
      ))}
    </Page>
  </Document>
);

export default function BookGenerator() {
  const [topic, setTopic] = useState('');
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [history, setHistory] = useState<Book[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedChapters, setSelectedChapters] = useState<number[]>([]);

  useEffect(() => {
    const savedHistory = localStorage.getItem('bookHistory');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Error parsing book history:", e);
        setHistory([]);
      }
    }
  }, []);

  const saveToHistory = (book: Book) => {
    const newHistory = [book, ...history.filter(h => h.id !== book.id)];
    setHistory(newHistory);
    try {
      localStorage.setItem('bookHistory', JSON.stringify(newHistory));
    } catch (e) {
      console.error("Failed to save book history to localStorage:", e);
    }
  };

  const generateOutline = async () => {
    if (!topic) return;
    setIsGenerating(true);
    try {
      const apiKey = (window as any).GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      const response = await callAiWithRetry((key) => {
        const aiInstance = new GoogleGenAI({ apiKey: key });
        return aiInstance.models.generateContent({
          model: 'gemini-1.5-pro',
          contents: `Create an outline for a comprehensive, long-form book about: ${topic}. Include a title and a list of 20 detailed chapter titles. Return JSON with title and chapterTitles (array of strings).`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                chapterTitles: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["title", "chapterTitles"]
            }
          }
        });
      });
      try {
        const data = JSON.parse(response.text!);
        const newBook: Book = {
          id: Date.now().toString(),
          title: data.title,
          chapters: data.chapterTitles.map((title: string) => ({ title, content: '', status: 'pending' })),
          font: 'Helvetica',
          titleUppercase: false
        };
        setCurrentBook(newBook);
        saveToHistory(newBook);
        setSelectedChapters([]);
      } catch (parseError) {
        console.error("JSON parse error for outline:", parseError);
        alert("Haba Boss, I made a little mistake in the JSON! 🙈 Trying a simpler way for you... ✨");
        // Fallback or re-try could go here
      }
    } catch (error) { 
        console.error(error); 
        alert("Ni dai, I couldn't get that outline ready! 🥺 Please check your connection or try again. ✨");
    } finally { setIsGenerating(false); }
  };

  const generateChapter = async (index: number, book: Book): Promise<Book> => {
    const newBook = { ...book };
    newBook.chapters[index].status = 'generating';
    newBook.chapters[index].content = '';
    setCurrentBook(newBook);

    try {
      const apiKey = (window as any).GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      const streamResult = streamAiWithRetry<any>(async (apiKey) => {
        const ai = new GoogleGenAI({ apiKey });
        const res = await ai.models.generateContentStream({
          model: 'gemini-1.5-pro',
          contents: `Write a very detailed, long chapter for the book "${newBook.title}". Chapter title: "${newBook.chapters[index].title}". Provide at least 5000 words for this chapter.`,
          config: { }
        });
        return (res as any).stream || res;
      });
      
      let fullContent = '';
      for await (const chunk of streamResult) {
        const text = (chunk as any).text;
        fullContent += text || '';
        newBook.chapters[index].content = fullContent;
        setCurrentBook({ ...newBook });
      }
      
      newBook.chapters[index].status = 'done';
    } catch (error: any) { 
      console.error(error); 
      const status = error?.status || error?.error?.code || error?.error?.status;
      const messageStr = error?.message || error?.error?.message || "";
      
      let errorToast = "Failed to generate chapter. Please try again.";
      if (status === 429 || status === 'RESOURCE_EXHAUSTED' || messageStr.includes('RESOURCE_EXHAUSTED')) {
        errorToast = "Quota exceeded! Please try again tomorrow or use your own API key. ✨";
      }
      alert(errorToast);
      newBook.chapters[index].status = 'pending'; 
    }
    setCurrentBook(newBook);
    saveToHistory(newBook);
    return newBook;
  };

  const generateSelectedChapters = async () => {
    if (!currentBook) return;
    let book = { ...currentBook };
    for (const index of selectedChapters) {
      book = await generateChapter(index, book);
    }
    setSelectedChapters([]);
  };

  const toggleChapterSelection = (index: number) => {
    setSelectedChapters(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  return (
    <div className="px-12 py-8 bg-zinc-900 text-zinc-100 rounded-2xl h-full overflow-y-auto flex gap-8">
      <div className="w-1/4 border-r border-zinc-800 pr-6">
        <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-zinc-400"><History className="w-5 h-5" /> History</h3>
        {history.map(book => (
          <div key={book.id} onClick={() => setCurrentBook(book)} className="p-3 bg-zinc-800/50 rounded-lg mb-3 cursor-pointer hover:bg-zinc-700 transition-colors text-sm truncate">
            {book.title}
          </div>
        ))}
      </div>
      <div className="flex-1">
        <h2 className="text-3xl font-extrabold mb-6 tracking-tight">Book Generator</h2>
        <div className="flex gap-3 mb-8">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Enter book topic..." className="flex-1 p-4 bg-zinc-800 rounded-xl border border-zinc-700 focus:border-indigo-500 outline-none transition-all" />
          <button onClick={generateOutline} className="px-6 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-indigo-900/20">
            {isGenerating ? <Loader2 className="animate-spin" /> : <Plus className="w-5 h-5" />} Generate Outline
          </button>
        </div>

        {currentBook && (
          <div className="bg-zinc-800/30 p-6 rounded-2xl border border-zinc-800">
            <h3 className="text-2xl font-bold mb-6 text-indigo-300">{currentBook.title}</h3>
            <div className="space-y-3 mb-8">
              {currentBook.chapters.map((chapter, index) => (
                <div key={index} className="p-4 bg-zinc-800 rounded-xl flex items-center gap-4 hover:bg-zinc-700/50 transition-colors">
                  <input type="checkbox" checked={selectedChapters.includes(index)} onChange={() => toggleChapterSelection(index)} className="w-5 h-5 accent-indigo-500" />
                  <div className="flex-1">
                    <h4 className="font-semibold">{index + 1}. {chapter.title}</h4>
                  </div>
                  <button onClick={() => generateChapter(index, currentBook)} disabled={chapter.status === 'generating'} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${chapter.status === 'generating' ? 'bg-zinc-600' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                    {chapter.status === 'generating' ? 'Generating...' : chapter.status === 'done' ? 'Regenerate' : 'Generate'}
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-4 pt-6 border-t border-zinc-700">
              <button onClick={generateSelectedChapters} disabled={selectedChapters.length === 0 || isGenerating} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl flex items-center gap-2 font-bold transition-all">
                <BookOpen className="w-5 h-5" /> Generate Selected ({selectedChapters.length})
              </button>
              <PDFDownloadLink document={<PDFDocument book={currentBook} />} fileName={`${currentBook.title}.pdf`} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center gap-3 font-bold text-white transition-all shadow-lg shadow-emerald-900/20">
                {({ blob, url, loading, error }) => (loading ? 'Loading document...' : <><Download className="w-5 h-5" /> Download PDF</>)}
              </PDFDownloadLink>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
