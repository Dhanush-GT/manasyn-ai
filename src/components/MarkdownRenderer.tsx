import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  isUser?: boolean;
}

/**
 * Sanitizes raw LaTeX mathematical notation into clean, accessible plain-text comparisons & metrics.
 * E.g., $\ge 1$ -> >= 1, $< 15\text{ms}$ -> < 15ms, $\le 10$ -> <= 10.
 */
function sanitizeLatexSymbols(text: string): string {
  if (!text) return '';
  return text
    // Replace LaTeX text wrappers
    .replace(/\\text\{([^}]+)\}/g, '$1')
    // Replace common LaTeX relational & mathematical operators
    .replace(/\\ge\b/g, '>=')
    .replace(/\\le\b/g, '<=')
    .replace(/\\gt\b/g, '>')
    .replace(/\\lt\b/g, '<')
    .replace(/\\geq\b/g, '>=')
    .replace(/\\leq\b/g, '<=')
    .replace(/\\neq\b/g, '!=')
    .replace(/\\approx\b/g, '≈')
    .replace(/\\times\b/g, '×')
    .replace(/\\pm\b/g, '±')
    // Strip inline math wrappers like $...$ if containing basic math or comparisons
    .replace(/\$([^\$\n]+)\$/g, (_match, inner) => inner.trim());
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isUser = false }) => {
  if (isUser) {
    return <div className="whitespace-pre-wrap text-white">{content}</div>;
  }

  const cleanContent = sanitizeLatexSymbols(content);

  return (
    <div className="markdown-content prose prose-invert max-w-none text-slate-800 dark:text-slate-200 text-xs sm:text-sm leading-relaxed space-y-2.5 min-w-0 break-words">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mt-3 mb-1.5 pb-1 border-b border-slate-200 dark:border-slate-800">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white mt-2.5 mb-1">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white mt-2 mb-1">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white mt-1.5 mb-0.5">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-slate-800 dark:text-slate-200 leading-relaxed mb-2 last:mb-0">
              {children}
            </p>
          ),
          span: ({ children }) => (
            <span className="text-slate-800 dark:text-slate-200">
              {children}
            </span>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-4 space-y-1 my-2 text-slate-800 dark:text-slate-200">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside pl-4 space-y-1 my-2 text-slate-800 dark:text-slate-200">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-slate-800 dark:text-slate-200 leading-relaxed">
              {children}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-900 dark:text-white">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-slate-800 dark:text-slate-200">
              {children}
            </em>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-indigo-500 pl-3 py-1.5 my-2 bg-slate-50 dark:bg-slate-900/80 rounded-r-md text-slate-700 dark:text-slate-200 italic text-xs sm:text-sm border border-l-0 border-slate-200 dark:border-slate-800">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const isCodeBlock = String(children).includes('\n') || (className && className.includes('language-'));
            if (isCodeBlock) {
              return (
                <code className="block bg-slate-950 text-indigo-300 font-mono text-xs p-3 rounded-lg overflow-x-auto border border-slate-800 my-2 leading-relaxed" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] sm:text-xs border border-slate-200 dark:border-slate-700/80" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <div className="my-2 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
              {children}
            </div>
          ),
          hr: () => (
            <hr className="my-3 border-slate-200 dark:border-slate-800" />
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-indigo-600 dark:text-cyan-400 underline underline-offset-2 hover:text-indigo-500 dark:hover:text-cyan-300 font-medium"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/70 max-w-full min-w-0">
              <table className="w-full text-left text-xs border-collapse border border-slate-200 dark:border-slate-800">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white font-semibold border-b border-slate-200 dark:border-slate-800">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="border-b border-slate-200 dark:border-slate-800 odd:bg-white dark:odd:bg-slate-900/50 even:bg-slate-50 dark:even:bg-slate-950/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="p-2.5 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-semibold text-xs bg-slate-100 dark:bg-slate-900">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="p-2.5 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs">
              {children}
            </td>
          ),
        }}
      >
        {cleanContent}
      </Markdown>
    </div>
  );
};
