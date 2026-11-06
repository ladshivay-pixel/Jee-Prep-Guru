import React, { useState } from "react";
import MathMarkdown from "./MathMarkdown";
import Whiteboard, { WhiteboardData } from "./Whiteboard";
import { MessageSquare, Calculator, LineChart, Layers } from "lucide-react";

const safeJsonParse = (str: string): WhiteboardData | null => {
  let fixed = str
    .replace(/\\b(?=egin|eta|ar\b|oldsymbol|ath|f\b|ig)/g, "\\\\b")
    .replace(/\\f(?=rac|orall|box)/g, "\\\\f")
    .replace(/\\n(?=abla|u\b|eq|otin|ormal)/g, "\\\\n")
    .replace(/\\r(?=ight|ho\b|angle|m\b)/g, "\\\\r")
    .replace(/\\t(?=heta|au\b|o\b|an\b|ext|imes|ilde|op\b|riangle)/g, "\\\\t")
    .replace(/\\u(?![0-9a-fA-F]{4})/g, "\\\\u");

  fixed = fixed.replace(/\\([^"\\/bfnrtu])/g, "\\\\$1");

  try {
    const obj = JSON.parse(fixed);
    if (obj && Array.isArray(obj.elements)) return obj;
  } catch (e) {
    try {
      const aggressive = str.replace(/\\(?!["\\])/g, "\\\\");
      const obj2 = JSON.parse(aggressive);
      if (obj2 && Array.isArray(obj2.elements)) return obj2;
    } catch (e2) {
      return null;
    }
  }
  return null;
};

interface MessageRendererProps {
  content: string;
  onReply?: (text: string) => void;
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({
  content,
  onReply,
}) => {
  const [activeTab, setActiveTab] = useState<"all" | "chat" | "equation" | "graph">("all");

  // Clean obsolete or operational tags
  let rawText = content
    .replace(/<ASSIGN_TASK>[\s\S]*?<\/ASSIGN_TASK>/gi, "")
    .replace(/<self_solved\s*\/?>/gi, "")
    .replace(/<solved_on_my_own\s*\/?>/gi, "")
    .replace(/<microtest>[\s\S]*?<\/microtest>/gi, "")
    .trim();

  // 1. EXTRACT EQUATION COMPONENTS (<equation> or <roughwork>)
  const equationBlocks: string[] = [];
  const extractTag = (text: string, tag: string, sink: string[]) => {
    return text.replace(
      new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "gi"),
      (_, p1) => {
        if (p1.trim()) sink.push(p1.trim());
        return "";
      }
    );
  };

  rawText = extractTag(rawText, "equation", equationBlocks);
  rawText = extractTag(rawText, "roughwork", equationBlocks);

  // 2. EXTRACT GRAPH COMPONENTS (<graph> or <whiteboard>)
  const graphRawBlocks: string[] = [];
  rawText = extractTag(rawText, "graph", graphRawBlocks);
  rawText = extractTag(rawText, "whiteboard", graphRawBlocks);

  // Extract JSON codeblocks that define graphs
  const codeBlockRegex = /```json\n([\s\S]*?)\n```/gi;
  rawText = rawText.replace(codeBlockRegex, (match, jsonString) => {
    const parsed = safeJsonParse(jsonString);
    if (parsed) {
      graphRawBlocks.push(jsonString);
      return "";
    }
    return match;
  });

  // Check if leftover text itself is a full graph JSON
  const parsedDirect = safeJsonParse(rawText.trim());
  if (parsedDirect) {
    graphRawBlocks.push(rawText.trim());
    rawText = "";
  }

  // Parse valid graph data structures
  const validGraphs: WhiteboardData[] = [];
  graphRawBlocks.forEach((block) => {
    const parsed = safeJsonParse(block);
    if (parsed) validGraphs.push(parsed);
  });

  // Strip any leftover obsolete custom tags and clean up chat text
  let chatText = rawText
    .replace(/<\/?(?:logic_trigger|genius_thought|socratic_ignition|motive_learn|motive_build|kinesthetic)[^>]*>/gi, "")
    .trim();

  // If no equation tag was explicitly used, but text has clear step-by-step methods, optionally split
  let equationText = equationBlocks.join("\n\n").trim();
  if (!equationText && (chatText.includes("### Derivation") || chatText.includes("### Equations"))) {
    const splitIndex = chatText.search(/### (?:Derivation|Equations)/i);
    if (splitIndex > 0) {
      equationText = chatText.slice(splitIndex).trim();
      chatText = chatText.slice(0, splitIndex).trim();
    }
  }

  const hasChat = chatText.length > 0;
  const hasEquation = equationText.length > 0;
  const hasGraph = validGraphs.length > 0;

  const componentCount = (hasChat ? 1 : 0) + (hasEquation ? 1 : 0) + (hasGraph ? 1 : 0);

  // If only 1 component exists, render it directly without tab selector
  if (componentCount <= 1) {
    return (
      <div className="space-y-4 w-full">
        {hasChat && (
          <div className="leading-relaxed">
            <MathMarkdown content={chatText} />
          </div>
        )}

        {hasEquation && (
          <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 sm:p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest font-mono mb-3">
              <Calculator size={14} className="text-amber-500" /> EQUATION & DERIVATION
            </div>
            <MathMarkdown content={equationText} className="leading-relaxed text-zinc-900 dark:text-zinc-100" />
          </div>
        )}

        {hasGraph && (
          <div className="space-y-3">
            {validGraphs.map((data, idx) => (
              <Whiteboard key={`graph-single-${idx}`} data={data} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // When multiple components exist: provide the 3 pure components + All view
  return (
    <div className="space-y-4 w-full max-w-full overflow-hidden">
      {/* 3 Component Selector Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab("all")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all whitespace-nowrap ${
            activeTab === "all"
              ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
              : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <Layers size={13} /> All
        </button>

        {hasChat && (
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all whitespace-nowrap ${
              activeTab === "chat"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
            }`}
          >
            <MessageSquare size={13} /> 1. Chat
          </button>
        )}

        {hasEquation && (
          <button
            onClick={() => setActiveTab("equation")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all whitespace-nowrap ${
              activeTab === "equation"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            }`}
          >
            <Calculator size={13} /> 2. Equation
          </button>
        )}

        {hasGraph && (
          <button
            onClick={() => setActiveTab("graph")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all whitespace-nowrap ${
              activeTab === "graph"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            }`}
          >
            <LineChart size={13} /> 3. Graph
          </button>
        )}
      </div>

      {/* Component Panels */}
      <div className="space-y-4 w-full">
        {/* 1. CHAT COMPONENT */}
        {(activeTab === "all" || activeTab === "chat") && hasChat && (
          <div className="bg-blue-500/5 dark:bg-zinc-900/60 border border-blue-500/10 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm overflow-x-auto">
            <div className="flex items-center gap-2 text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-mono mb-2">
              <MessageSquare size={13} /> 1. CHAT & SOCRATIC EXPLORATION
            </div>
            <MathMarkdown content={chatText} className="leading-relaxed" />
          </div>
        )}

        {/* 2. EQUATION COMPONENT */}
        {(activeTab === "all" || activeTab === "equation") && hasEquation && (
          <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 dark:border-amber-900/50 rounded-2xl p-4 sm:p-5 shadow-sm overflow-x-auto">
            <div className="flex items-center gap-2 text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest font-mono mb-3">
              <Calculator size={13} /> 2. EQUATION & DERIVATION
            </div>
            <MathMarkdown content={equationText} className="leading-relaxed text-zinc-900 dark:text-zinc-100" />
          </div>
        )}

        {/* 3. GRAPH COMPONENT */}
        {(activeTab === "all" || activeTab === "graph") && hasGraph && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest font-mono">
              <LineChart size={13} /> 3. GRAPH & VISUAL MODEL
            </div>
            {validGraphs.map((data, idx) => (
              <Whiteboard key={`graph-${idx}`} data={data} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageRenderer;
