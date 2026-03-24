"use client";

import React from "react";

/**
 * Lightweight markdown-to-JSX renderer for LLM responses.
 * Handles: **bold**, *italic*, bullet lists, numbered lists, headings, paragraphs.
 * No external dependencies.
 */
export function MarkdownText({ text, className = "" }: { text: string; className?: string }) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const Tag = listType;
      elements.push(
        <Tag key={`list-${elements.length}`} className={listType === "ul" ? "list-disc pl-4 space-y-1" : "list-decimal pl-4 space-y-1"}>
          {listItems}
        </Tag>
      );
      listItems = [];
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      const cls = level === 1 ? "text-sm font-bold text-white mt-3 mb-1" :
                  level === 2 ? "text-sm font-semibold text-gray-200 mt-2 mb-1" :
                  "text-xs font-semibold text-gray-300 mt-2 mb-0.5";
      elements.push(<div key={i} className={cls}>{inlineFormat(content)}</div>);
      continue;
    }

    // Bullet list
    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)/);
    if (bulletMatch) {
      if (listType !== "ul") { flushList(); listType = "ul"; }
      listItems.push(<li key={i} className="text-xs text-gray-300">{inlineFormat(bulletMatch[1])}</li>);
      continue;
    }

    // Numbered list
    const numMatch = trimmed.match(/^\d+[.)]\s+(.+)/);
    if (numMatch) {
      if (listType !== "ol") { flushList(); listType = "ol"; }
      listItems.push(<li key={i} className="text-xs text-gray-300">{inlineFormat(numMatch[1])}</li>);
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={i} className="text-xs text-gray-300 leading-relaxed">
        {inlineFormat(trimmed)}
      </p>
    );
  }

  flushList();

  return <div className={`space-y-1.5 ${className}`}>{elements}</div>;
}

/** Parse inline markdown: **bold**, *italic*, `code` */
function inlineFormat(text: string): React.ReactNode {
  // Split by inline patterns
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // **bold**
      parts.push(<strong key={match.index} className="text-white font-semibold">{match[2]}</strong>);
    } else if (match[3]) {
      // *italic*
      parts.push(<em key={match.index} className="text-gray-200">{match[3]}</em>);
    } else if (match[4]) {
      // `code`
      parts.push(<code key={match.index} className="bg-gray-800 text-blue-300 px-1 rounded text-[10px]">{match[4]}</code>);
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
