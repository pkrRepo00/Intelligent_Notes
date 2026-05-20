import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';

interface WikiMarkdownProps {
  content: string;
  onLinkClick?: (noteName: string) => void;
  onContentChange?: (newContent: string) => void;
}

// Separate component for code block to handle copy status state neatly
function CodeBlock({ language, code, props }: { language: string; code: string; props: any }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-5 rounded-2xl overflow-hidden border border-white/10 bg-[#09090b] shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border-b border-white/5 text-[10px] font-mono text-white/40">
        <span className="uppercase tracking-widest font-bold text-amber-500/80">{language}</span>
        <button
          onClick={handleCopy}
          className="hover:text-white transition-all bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg border border-white/5 font-sans font-extrabold tracking-wider text-[9px] cursor-pointer"
        >
          {copied ? 'COPIED!' : 'COPY'}
        </button>
      </div>
      <SyntaxHighlighter
        {...props}
        children={code}
        style={vscDarkPlus}
        language={language}
        PreTag="div"
        customStyle={{ margin: 0, padding: '1.25rem', background: 'transparent' }}
        className="text-xs font-mono leading-relaxed"
      />
    </div>
  );
}

export function WikiMarkdown({ content, onLinkClick, onContentChange }: WikiMarkdownProps) {
  const wikiLinkRegex = /\[\[(.*?)\]\]/g;
  
  let processedContent = content;
  
  processedContent = processedContent.replace(wikiLinkRegex, function(match, p1) {
    return '[' + p1 + '](wiki://' + encodeURIComponent(p1) + ')';
  });

  // Track the checkbox index during current render pass
  let checkboxCounter = 0;

  return (
    <div className="markdown-body prose prose-invert max-w-none font-sans text-slate-300 leading-relaxed selection:bg-amber-500/30">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({node, inline, className, children, ...props}: any) {
            const match = /language-(\w+)/.exec(className || '');
            const rawCode = String(children).replace(/\n$/, '');
            if (!inline) {
              return (
                <CodeBlock 
                  language={match ? match[1] : 'text'} 
                  code={rawCode} 
                  props={props} 
                />
              );
            }
            return (
              <code {...props} className="bg-white/10 px-1.5 py-0.5 rounded text-amber-500 font-mono text-xs font-semibold">
                {children}
              </code>
            );
          },
          a: ({ node, ...props }: any) => {
            const href = props.href;
            if (href && href.startsWith('wiki://')) {
              const noteName = decodeURIComponent(href.replace('wiki://', ''));
              return (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    if (onLinkClick) onLinkClick(noteName);
                  }}
                  className="text-amber-500 hover:text-amber-400 hover:underline font-bold px-2 py-0.5 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/15 hover:border-amber-500/30 rounded-lg transition-all inline-flex items-center gap-1.5 my-0.5 text-xs cursor-pointer shadow-sm"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60" />
                  {noteName}
                </button>
              );
            }
            return (
              <a 
                {...props} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-amber-400/90 hover:text-amber-400 underline decoration-amber-500/30 hover:decoration-amber-500 transition-colors" 
              />
            );
          },
          h1: ({node, ...props}: any) => <h1 {...props} className="text-3xl font-black text-white mt-10 mb-4 border-b border-white/5 pb-3 tracking-tight leading-none" />,
          h2: ({node, ...props}: any) => <h2 {...props} className="text-2xl font-extrabold text-white/95 mt-8 mb-4 tracking-tight border-l-2 border-amber-500/40 pl-3 py-1" />,
          h3: ({node, ...props}: any) => <h3 {...props} className="text-xl font-bold text-white/90 mt-6 mb-3 tracking-tight" />,
          h4: ({node, ...props}: any) => <h4 {...props} className="text-lg font-semibold text-white/85 mt-4 mb-2 tracking-tight" />,
          
          ul: ({ node, ...props }: any) => <ul {...props} className="list-disc pl-6 space-y-2.5 text-white/80 my-5" />,
          ol: ({ node, ...props }: any) => <ol {...props} className="list-decimal pl-6 space-y-2.5 text-white/80 my-5" />,
          li: ({ node, children, ...props }: any) => {
            const hasCheckbox = React.Children.toArray(children).some(
              (child: any) => child && child.type === 'input' && child.props.type === 'checkbox'
            );
            return (
              <li 
                {...props} 
                className={`leading-relaxed hover:text-white transition-colors py-0.5 ${hasCheckbox ? 'list-none -ml-6 flex items-center' : ''}`}
              >
                {children}
              </li>
            );
          },

          input: ({node, ...props}: any) => {
            if (props.type === 'checkbox') {
              const currentIdx = checkboxCounter++;
              return (
                <input
                  type="checkbox"
                  checked={props.checked}
                  disabled={!onContentChange}
                  onChange={(e) => {
                    if (onContentChange) {
                      const isChecked = e.target.checked;
                      let idxCounter = 0;
                      const regex = /-\s*\[([ xX])\]/g;
                      const newContent = content.replace(regex, (match) => {
                        if (idxCounter === currentIdx) {
                          idxCounter++;
                          return isChecked ? '- [x]' : '- [ ]';
                        }
                        idxCounter++;
                        return match;
                      });
                      onContentChange(newContent);
                    }
                  }}
                  className="w-4.5 h-4.5 rounded border-white/15 text-amber-500 focus:ring-amber-500/50 bg-black/40 cursor-pointer accent-amber-500 mr-2.5 shrink-0 transition-all"
                />
              );
            }
            return <input {...props} />;
          },

          table: ({node, ...props}: any) => (
            <div className="overflow-x-auto my-6 border border-white/10 rounded-2xl bg-black/20 shadow-xl max-w-full">
              <table {...props} className="min-w-full divide-y divide-white/10" />
            </div>
          ),
          thead: ({node, ...props}: any) => <thead {...props} className="bg-white/[0.02]" />,
          tbody: ({node, ...props}: any) => <tbody {...props} className="divide-y divide-white/5" />,
          th: ({node, ...props}: any) => <th {...props} className="px-5 py-3 text-left text-xs font-bold text-white/65 uppercase tracking-wider font-sans" />,
          td: ({node, ...props}: any) => <td {...props} className="px-5 py-3.5 text-sm text-white/80 font-normal font-sans border-t border-white/5" />,
          
          blockquote: ({node, ...props}: any) => (
            <blockquote 
              {...props} 
              className="border-l-4 border-amber-500/55 pl-5 italic text-white/70 my-5 bg-white/[0.02] py-2.5 pr-4 rounded-r-xl tracking-wide font-serif text-[15px]" 
            />
          ),
          
          img: ({node, ...props}: any) => (
            <img 
              {...props} 
              referrerPolicy="no-referrer"
              className="rounded-2xl border border-white/10 my-6 max-h-[60vh] mx-auto object-contain shadow-2xl" 
            />
          )
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
