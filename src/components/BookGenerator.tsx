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
  page: { padding: 30 },
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
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  const saveToHistory = (book: Book) => {
    const newHistory = [book, ...history.filter(h => h.id !== book.id)];
    setHistory(newHistory);
    localStorage.setItem('bookHistory', JSON.stringify(newHistory));
  };

  const generateOutline = async () => {
    if (!topic) return;
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await callAiWithRetry(() => ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
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
      }));
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
    } catch (error) { console.error(error); } finally { setIsGenerating(false); }
  };

  const generateChapter = async (index: number, book: Book): Promise<Book> => {
    const newBook = { ...book };
    newBook.chapters[index].status = 'generating';
    newBook.chapters[index].content = '';
    setCurrentBook(newBook);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const stream = await streamAiWithRetry(async () => ai.models.generateContentStream({
        model: 'gemini-3.1-pro-preview',
        contents: `Write a very detailed, long chapter for the book "${newBook.title}". Chapter title: "${newBook.chapters[index].title}". Provide at least 5000 words for this chapter.`,
        config: { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } }
      }));
      
      let fullContent = '';
      for await (const chunk of stream) {
        fullContent += chunk.text;
        newBook.chapters[index].content = fullContent;
        setCurrentBook({ ...newBook });
      }
      
      newBook.chapters[index].status = 'done';
    } catch (error) { 
      console.error(error); 
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
    <div className="p-6 bg-zinc-900 text-zinc-100 rounded-xl h-full overflow-y-auto flex gap-6">
      <div className="w-1/3 border-r border-zinc-700 pr-4">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><History /> History</h3>
        {history.map(book => (
          <div key={book.id} onClick={() => setCurrentBook(book)} className="p-2 bg-zinc-800 rounded mb-2 cursor-pointer hover:bg-zinc-700">
            {book.title}
          </div>
        ))}
      </div>
      <div className="flex-1">
        <h2 className="text-2xl font-bold mb-4">Book Generator</h2>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Enter book topic..." className="w-full p-3 bg-zinc-800 rounded-lg mb-4" />
        <button onClick={generateOutline} className="px-4 py-2 bg-indigo-600 rounded-lg flex items-center gap-2 mb-6">
          {isGenerating ? <Loader2 className="animate-spin" /> : <Plus />} Generate Outline
        </button>

        {currentBook && (
          <div>
            <h3 className="text-2xl font-semibold mb-4">{currentBook.title}</h3>
            {currentBook.chapters.map((chapter, index) => (
              <div key={index} className="mb-4 p-4 bg-zinc-800 rounded-lg flex items-center gap-4">
                <input type="checkbox" checked={selectedChapters.includes(index)} onChange={() => toggleChapterSelection(index)} className="w-5 h-5" />
                <div className="flex-1">
                  <h4 className="font-bold">{chapter.title}</h4>
                  <div className="mt-2 flex items-center gap-2">
                    <button onClick={() => generateChapter(index, currentBook)} disabled={chapter.status === 'generating'} className="px-3 py-1 bg-emerald-600 rounded text-sm">
                      {chapter.status === 'generating' ? 'Generating...' : chapter.status === 'done' ? 'Regenerate' : 'Generate Content'}
                    </button>
                    {chapter.status === 'done' && <span className="text-emerald-400 text-sm">Done</span>}
                  </div>
                </div>
              </div>
            ))}
            <div className="flex gap-4">
              <button onClick={generateSelectedChapters} disabled={selectedChapters.length === 0 || isGenerating} className="px-4 py-2 bg-blue-600 rounded-lg flex items-center gap-2">
                <BookOpen /> Generate Selected ({selectedChapters.length})
              </button>
              <PDFDownloadLink document={<PDFDocument book={currentBook} />} fileName={`${currentBook.title}.pdf`} className="px-4 py-2 bg-green-600 rounded-lg flex items-center gap-2">
                {({ blob, url, loading, error }) => (loading ? 'Loading document...' : <><Download /> Download PDF</>)}
              </PDFDownloadLink>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
