import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './MarkdownRenderer.module.css';

export interface MarkdownRendererProps {
  source: string;
  className?: string;
}

export function MarkdownRenderer({ source, className }: MarkdownRendererProps) {
  return (
    <div className={`${styles.md} ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => {
            const href = props.href ?? '';
            const isExternal = /^https?:\/\//.test(href);
            return isExternal ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {props.children}
              </a>
            ) : (
              <a href={href}>{props.children}</a>
            );
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
