import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import 'katex/dist/katex.min.css';

interface ContentRendererProps {
  content: string;
  className?: string;
}

const ContentRenderer: React.FC<ContentRendererProps> = ({ content, className = "" }) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className={`prose prose-invert prose-indigo max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p({ children }) {
            const text = String(children);
            // Hide internal JSON decision blocks which might be present in the stream
            if (text.includes('"decision_type"') || text.includes('"action_command"') || (text.trim().startsWith('{') && text.trim().endsWith('}'))) {
              return null;
            }
            return <p className="mb-4 leading-relaxed">{children}</p>;
          },
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');

            if (codeString.includes('"decision_type"') || codeString.includes('"action_command"')) {
              return null;
            }

            if (!inline && match) {
              const id = Math.random().toString(36).substr(2, 9);
              return (
                <div className="relative group my-6 overflow-hidden rounded-xl border border-zinc-700/50 shadow-2xl">
                  <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/80 border-b border-zinc-700/50">
                    <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">{match[1]}</span>
                    <button
                      onClick={() => copyToClipboard(codeString, id)}
                      className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                    >
                      {copiedId === id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedId === id ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{ 
                      margin: 0, 
                      padding: '1.5rem',
                      background: '#0a0a0a',
                      fontSize: '0.875rem',
                      lineHeight: '1.7',
                      fontFamily: 'JetBrains Mono, Fira Code, monospace'
                    }}
                    {...props}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </div>
              );
            }

            return (
              <code className="bg-zinc-800/80 px-1.5 py-0.5 rounded text-sm font-mono text-indigo-300 border border-zinc-700/50" {...props}>
                {children}
              </code>
            );
          },
          // Customize other elements to ensure mobile responsiveness and aesthetics
          h1({ children }) { return <h1 className="text-2xl font-bold mt-8 mb-4 sm:text-3xl">{children}</h1>; },
          h2({ children }) { return <h2 className="text-xl font-bold mt-6 mb-3 sm:text-2xl">{children}</h2>; },
          h3({ children }) { return <h3 className="text-lg font-bold mt-4 mb-2 sm:text-xl">{children}</h3>; },
          ul({ children }) { return <ul className="list-disc pl-5 mb-4 space-y-2">{children}</ul>; },
          ol({ children }) { return <ol className="list-decimal pl-5 mb-4 space-y-2">{children}</ol>; },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-indigo-500 pl-4 italic text-zinc-400 my-6 bg-zinc-800/20 py-2 rounded-lg">
                {children}
              </blockquote>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-6 rounded-xl border border-zinc-800">
                <table className="w-full text-sm text-left">{children}</table>
              </div>
            );
          },
          th({ children }) { return <th className="px-4 py-2 bg-zinc-800 font-bold border-b border-zinc-700">{children}</th>; },
          td({ children }) { return <td className="px-4 py-2 border-b border-zinc-800/50">{children}</td>; },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default ContentRenderer;
