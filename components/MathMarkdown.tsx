import React, { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import Whiteboard from "./Whiteboard";

interface MathMarkdownProps {
  content: string;
  className?: string;
}

const normalizeMathDelimiters = (text: string): string => {
  if (!text) return text;
  let processed = text;

  // Fix double-escaped backslashes before common LaTeX operators
  processed = processed.replace(
    /\\\\(frac|int|sum|lim|sqrt|begin|end|vec|alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega|mathbf|mathcal|mathrm|text|left|right|cdot|times|div|pm|mp|le|ge|neq|approx|equiv|forall|exists|in|notin|subset|subseteq|cap|cup|partial|nabla|infty|to|rightarrow|Rightarrow|leftarrow|Leftarrow)/g,
    "\\$1"
  );

  // Convert \[ ... \] to $$ ... $$ (display math)
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n\n$$ ${math.trim()} $$\n\n`);

  // Convert \( ... \) to $ ... $ (inline math)
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`);

  // Auto-wrap lines that contain raw LaTeX math operators but lack $ or $$
  const lines = processed.split("\n");
  const processedLines = lines.map((line) => {
    const trimmed = line.trim();

    if (
      !trimmed ||
      trimmed.startsWith("$") ||
      trimmed.endsWith("$") ||
      trimmed.includes("$$") ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("```") ||
      trimmed.startsWith("- ") ||
      trimmed.startsWith("* ") ||
      /^\d+\.\s/.test(trimmed)
    ) {
      return line;
    }

    if (/\\(frac|int|sum|lim|sqrt|begin|matrix|pmatrix|bmatrix|vec|partial|nabla)/.test(trimmed)) {
      return `$$ ${trimmed} $$`;
    }

    return line;
  });

  return processedLines.join("\n");
};

const sanitizeJson = (str: string) => {
  try {
    // If it's already valid JSON, don't touch it
    JSON.parse(str);
    return str;
  } catch (e) {
    // Attempt rescue
    let s = str
      .replace(/\\/g, "\\\\") // Double all backslashes
      .replace(/\\\\"/g, '\\"') // Restore escaped quotes
      .replace(/\\\\u([0-9a-fA-F]+)/g, "\\u$1"); // Restore unicode escapes

    s = s.replace(/\n/g, " ").replace(/\r/g, "");
    s = s.replace(/,\s*([\]}])/g, "$1");
    return s;
  }
};

const extractJson = (str: string) => {
  const start = str.indexOf("{");
  const end = str.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return str.substring(start, end + 1);
  }
  return str;
};

const MathMarkdown: React.FC<MathMarkdownProps> = memo(
  ({ content, className }) => {
    // Split content by whiteboard, studyplan, and blackbook tags
    const parts = content.split(
      /(<whiteboard>[\s\S]*?<\/whiteboard>|<studyplan>[\s\S]*?<\/studyplan>|<blackbook>[\s\S]*?<\/blackbook>)/g,
    );

    return (
      <div className={`prose max-w-none ${className}`}>
        {parts
          .filter((p) => p.trim())
          .map((part, i) => {
            const key = `part-${i}`;

            if (
              part.trim().startsWith("<blackbook>") &&
              part.trim().endsWith("</blackbook>")
            ) {
              try {
                let inner = part
                  .replace(/<blackbook>/g, "")
                  .replace(/<\/blackbook>/g, "")
                  .trim();
                if (inner.startsWith("```json"))
                  inner = inner
                    .replace(/^```json\n?/, "")
                    .replace(/\n?```$/, "")
                    .trim();
                else if (inner.startsWith("```"))
                  inner = inner
                    .replace(/^```\n?/, "")
                    .replace(/\n?```$/, "")
                    .trim();

                const jsonStr = extractJson(inner);
                const sanitized = sanitizeJson(jsonStr);
                const data = JSON.parse(sanitized);
                return (
                  <div
                    key={key}
                    className="my-6 p-5 bg-white border border-zinc-200 rounded-2xl shadow-md relative overflow-hidden group"
                  >
                    <style>{`
                  .anomaly-bg {
                    background-image: repeating-linear-gradient(45deg, rgba(0, 0, 0, 0.01) 0, rgba(0, 0, 0, 0.01) 1px, transparent 0, transparent 50%);
                    background-size: 20px 20px;
                  }
                `}</style>
                    <div className="absolute inset-0 anomaly-bg pointer-events-none" />
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                      <div className="text-8xl font-black text-zinc-200 font-mono uppercase tracking-tighter">
                        {data.concept?.substring(0, 2)}
                      </div>
                    </div>
                    {/* Scanner line animation - subtle */}
                    <div
                      className="absolute left-0 right-0 h-px bg-zinc-200 shadow-[0_0_10px_rgba(0,0,0,0.1)] animate-bounce pointer-events-none"
                      style={{ animationDuration: "4s" }}
                    />

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-zinc-400 font-black uppercase tracking-[0.2em] text-[10px] flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                          LOGIC_OVERLAP_DETECTED // GEN:{" "}
                          {Math.floor(Math.random() * 9000) + 1000}
                        </h4>
                        <span className="text-zinc-300 text-[8px] font-mono tracking-widest">
                          CORE_PROTECTION_ACTIVE
                        </span>
                      </div>
                      <div className="mb-4 bg-zinc-50 border border-zinc-100 p-4 rounded-xl">
                        <div className="text-xl font-bold text-zinc-900 mb-1 font-mono tracking-tight">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[
                              [
                                rehypeKatex,
                                {
                                  strict: false,
                                  throwOnError: false,
                                  output: "html",
                                },
                              ],
                            ]}
                          >
                            {data.concept}
                          </ReactMarkdown>
                        </div>
                        <div className="text-zinc-500 text-sm border-t border-zinc-100 pt-3 mt-3">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[
                              [
                                rehypeKatex,
                                {
                                  strict: false,
                                  throwOnError: false,
                                  output: "html",
                                },
                              ],
                            ]}
                          >
                            {data.mistake}
                          </ReactMarkdown>
                        </div>
                      </div>
                      <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 shadow-lg">
                        <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider block mb-2">
                          MODIFICATION_PROTOCOL
                        </span>
                        <div className="text-white font-medium leading-relaxed font-mono text-sm">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[
                              [
                                rehypeKatex,
                                {
                                  strict: false,
                                  throwOnError: false,
                                  output: "html",
                                },
                              ],
                            ]}
                          >
                            {data.takeaway}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              } catch (e) {
                return (
                  <div
                    key={key}
                    className="p-4 bg-red-50 border border-red-100 rounded-lg my-4"
                  >
                    <p className="text-red-500 text-sm">
                      Failed to synchronize memory fragment.
                    </p>
                  </div>
                );
              }
            }

            if (
              part.trim().startsWith("<whiteboard>") &&
              part.trim().endsWith("</whiteboard>")
            ) {
              try {
                let inner = part
                  .replace(/<whiteboard>/g, "")
                  .replace(/<\/whiteboard>/g, "")
                  .trim();
                if (inner.startsWith("```json"))
                  inner = inner
                    .replace(/^```json\n?/, "")
                    .replace(/\n?```$/, "")
                    .trim();
                else if (inner.startsWith("```"))
                  inner = inner
                    .replace(/^```\n?/, "")
                    .replace(/\n?```$/, "")
                    .trim();

                const jsonStr = extractJson(inner);
                const sanitized = sanitizeJson(jsonStr);
                const data = JSON.parse(sanitized);
                return <Whiteboard key={key} data={data} />;
              } catch (e) {
                console.error("Failed to parse whiteboard JSON", e);
                return (
                  <div
                    key={key}
                    className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg my-4"
                  >
                    <p className="text-red-400 text-sm font-bold mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      Whiteboard Error: JSON Parsing Failed
                    </p>
                    <pre className="text-[10px] text-zinc-500 overflow-x-auto whitespace-pre-wrap">
                      {e instanceof Error
                        ? e.message
                        : "Invalid JSON structure"}
                    </pre>
                  </div>
                );
              }
            }

            if (
              part.trim().startsWith("<studyplan>") &&
              part.trim().endsWith("</studyplan>")
            ) {
              try {
                let inner = part
                  .replace(/<studyplan>/g, "")
                  .replace(/<\/studyplan>/g, "")
                  .trim();
                if (inner.startsWith("```json"))
                  inner = inner
                    .replace(/^```json\n?/, "")
                    .replace(/\n?```$/, "")
                    .trim();
                else if (inner.startsWith("```"))
                  inner = inner
                    .replace(/^```\n?/, "")
                    .replace(/\n?```$/, "")
                    .trim();

                const jsonStr = extractJson(inner);
                const sanitized = sanitizeJson(jsonStr);
                const data = JSON.parse(sanitized);
                return null;
              } catch (e) {
                console.error("Failed to parse studyplan JSON", e);
                return null;
              }
            }

            // Format double linebreaks and spacing for inline step-by-step methods
            let formattedPart = part;
            formattedPart = formattedPart
              .replace(/(Method \d+:)/gi, "\n\n### $1\n")
              .replace(/(Using [^:\n]+:)/gi, "\n$1\n")
              .replace(/(So, [^:\n]+)/gi, "\n$1")
              .replace(/(Final Answer:)/gi, "\n\n**$1**\n");

            formattedPart = normalizeMathDelimiters(formattedPart);

            return (
              <div key={key} className="overflow-x-auto w-full">
                <style>{`
                  .katex {
                    white-space: normal !important;
                  }
                  .katex-display, .katex-display > .katex {
                    white-space: nowrap !important;
                  }
                  .katex-display {
                    margin: 0.75em 0 !important;
                    overflow-x: auto !important;
                    overflow-y: hidden !important;
                    padding: 0.25em 0;
                    display: block;
                    width: 100%;
                  }
                  .katex-html {
                    user-select: all;
                  }
                `}</style>
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[
                    [
                      rehypeKatex,
                      { strict: false, throwOnError: false, output: "html" },
                    ],
                  ]}
                  components={{
                    p: ({ children }) => (
                      <p className="mb-3.5 last:mb-0 leading-relaxed text-sm sm:text-base text-zinc-800 dark:text-zinc-200 font-normal tracking-wide whitespace-pre-wrap">
                        {children}
                      </p>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-4 mb-2 tracking-tight border-b border-zinc-200/60 pb-1">
                        {children}
                      </h3>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {children}
                      </strong>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc pl-5 my-2 space-y-1.5 text-sm sm:text-base">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal pl-5 my-2 space-y-1.5 text-sm sm:text-base">
                        {children}
                      </ol>
                    ),
                  }}
                >
                  {formattedPart}
                </ReactMarkdown>
              </div>
            );
          })}
      </div>
    );
  },
);

export default MathMarkdown;
