"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { FileCard } from "@/components/chat/FileCard";
import { cn } from "@/lib/utils";

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className={cn("markdown-body min-w-0 break-words text-[15px] text-slate-200")}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a({ href, children, title }) {
            if (href?.startsWith("openteams-file:")) {
              const fileId = href.slice("openteams-file:".length);
              const descriptor = title?.split(" · ")[0];
              return <FileCard fileId={fileId} name={String(children) || "Attachment"} mimeType={descriptor} />;
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-300 underline decoration-indigo-300/40 hover:decoration-indigo-300">
                {children}
              </a>
            );
          },
          img({ src, alt, title }) {
            if (src?.startsWith("openteams-file:")) {
              const fileId = src.slice("openteams-file:".length);
              return <FileCard fileId={fileId} name={alt ?? "Image attachment"} mimeType={title?.split(" · ")[0] ?? "image/*"} />;
            }
            return src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={String(src)} alt={alt ?? ""} className="my-2 max-h-72 rounded-lg border border-surface-border" />
            ) : null;
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
