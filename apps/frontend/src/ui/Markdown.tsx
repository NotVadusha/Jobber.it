import type { ReactElement } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

import './markdown.css'

/** Source content stays inert: no raw HTML or remote images. */
export const Markdown = ({ text }: { text: string }): ReactElement => (
  <div className="markdown-body">
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        h1: ({ children }) => <h3>{children}</h3>,
        h2: ({ children }) => <h3>{children}</h3>,
        h3: ({ children }) => <h4>{children}</h4>,
        img: ({ alt }) => alt ? <span>{alt}</span> : null,
        a: ({ href, children }) => href ? (
          <a href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a>
        ) : <span>{children}</span>,
        table: ({ children }) => <div className="markdown-table"><table>{children}</table></div>,
      }}
    >
      {text}
    </ReactMarkdown>
  </div>
)
