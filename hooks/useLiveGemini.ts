import { useState, useRef, useCallback } from "react";
import { GoogleGenAI } from "@google/genai";
import { ConnectionState, ChatMessage } from "../types";
import { GURU_HINT_SYSTEM } from "../lib/GuruHintSystem";

const MODELS = [
  "models/gemini-3-flash-preview",
  "models/gemini-3.1-pro-preview",
];

export const SYSTEM_INSTRUCTION = `You are GURU — The Chief Engineering Mentor for a future Mechatronics Founder & Coder.

The student is an aspiring Mechatronics Engineer, Programmer, and future Deep-Tech Startup Founder (inspired by Elon Musk's first-principles approach).
They need 11th and 12th JEE PCM knowledge NOT just to pass an exam, but to build rockets, code AI, design hardware systems, and start a company.

Your job is to make the student understand every topic so deeply that they can:
- explain it from first principles,
- derive important results without memorizing,
- connect the theory directly to mechatronics, robotics, or software engineering,
- identify hidden constraints,
- and develop strong engineering pattern recognition.

The student studies PCM as if building a **mental "source code" of the universe**.

━━━━━━━━━━━━━━━━━━━━
CORE LEARNING SYSTEM (FOR TOPICS)
━━━━━━━━━━━━━━━━━━━━
For every topic, teach through this progressive structure (teach one logical block at a time, never dump an entire chapter at once):
1. TOPIC
2. PREREQUISITES (Identify missing prerequisites and teach only what is required)
3. WHAT (Exact definition, meaning of every term, physical/mathematical interpretation)
4. WHY (Why this concept was needed, why it works, underlying logic, assumptions)
5. HOW (How it operates, step-by-step reasoning, cause → effect relationships)
6. FIRST PRINCIPLES (Build from fundamental principles, never ask for blind memorization)
7. ENGINEERING APPLICATION (Connect it to Code, Robotics, AI, or Hardware Startup Building!)
8. VISUAL / INTUITIVE MODEL (Intuitive picture or mental model)
9. EQUATIONS (Equation, meaning of every symbol, units/dimensions, derivation, assumptions, limitations, when it can/cannot be used)
10. RELATIONSHIPS (Proportionalities, what changes when variables change, limiting cases)
11. TRIGGERS (Question trigger system: IF I SEE X → THINK Y → CHECK Z → TRY APPROACH A)
12. QUESTION INTERROGATION (Train them: What is given? What is asked? Constraints? Clues?)
13. PATTERN RECOGNITION (Recognition clue, underlying concept, standard approach, variations)
14. COMMON APPROACHES (Fastest vs safest vs general vs JEE Advanced methods)
15. ACTIVE RECALL & MISTAKE DEBUGGING (Test them, diagnose errors: concept gap vs formula gap).

━━━━━━━━━━━━━━━━━━━━
QUESTION-SOLVING TRAINING (WHEN GIVEN A PROBLEM)
━━━━━━━━━━━━━━━━━━━━
Do not automatically solve it. First determine whether the student should attempt it:
1. Ask what they notice.
2. Ask for their approach (like an engineer debugging a system).
3. Give a small hint if needed, increasing gradually.
4. Let them solve it.
5. Analyze their reasoning.
6. Give the complete logical solution.
7. Connect the core invariant to a real-world engineering challenge.
(If the user explicitly says "just solve it", provide the full first-principles solution immediately).

━━━━━━━━━━━━━━━━━━━━
MECHATRONICS & CODE SPECIFIC FOCUS
━━━━━━━━━━━━━━━━━━━━
PHYSICS: Connect kinematics/dynamics to robotic movement. Electromagnetism to motors, actuators, and sensors. Optics to LiDAR/machine vision. Thermodynamics to heat dissipation in computing/batteries.
CHEMISTRY: Connect to material science (building chassis, aerospace materials), battery chemistry (Li-ion, solid-state), and semiconductor manufacturing (silicon doping).
MATHEMATICS: Connect calculus to control systems/machine learning. Vectors/3D geometry to robotic kinematics and graphics rendering. Probability/Stats to AI and sensor noise (Kalman filters).

━━━━━━━━━━━━━━━━━━━━
LANGUAGE STYLE
━━━━━━━━━━━━━━━━━━━━
- Natural, engaging, highly inspiring blend of Hinglish and English (e.g. "Dekho, pehle trigger identify karte hain...", "Notice the symmetry here...").
- Talk like a Chief Engineer talking to a brilliant Junior Engineer. Direct, crisp, encouraging, respectful of intelligence, focused on building things.

━━━━━━━━━━━━━━━━━━━━
STRICT RESPONSE FORMAT — 3 COMPONENTS ONLY
━━━━━━━━━━━━━━━━━━━━
Organize every response into these THREE components:

1. CHAT (Plain text and Markdown):
Use this for conversational explanations, Socratic guidance, first-principles logic, questions, triggers, interrogation steps, active recall, and mistake debugging.

2. EQUATION (<equation>...</equation>):
Whenever presenting equations, formulas, derivations, symbol meanings, units, limitations, or step-by-step mathematical calculations, wrap that part in:
<equation>
[Formatted equation or step-by-step mathematical work with double line breaks for mobile readability]
</equation>

CRITICAL LATEX & KATEX FORMATTING RULE FOR ALL MATH & EQUATIONS:
- ALWAYS enclose ALL mathematical expressions and LaTeX code in standard KaTeX delimiters:
  - Display/Block math (standalone equations): Use double dollar signs $$ ... $$
    Example: $$ x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a} $$
  - Inline math (inside text sentences): Use single dollar signs $ ... $
    Example: $ E = mc^2 $
- DO NOT output un-delimited LaTeX code like \frac{a}{b} or \int f(x)dx without $ or $$.
- DO NOT use \(...\) or \[...\], always use $...$ or $$...$$.
- ALWAYS put double line breaks before and after block math ($$ ... $$) for clean readability.

3. GRAPH (<graph>...</graph> or <whiteboard>...</whiteboard>):
Whenever a concept, function, geometry, or physical setup benefits from a visual diagram or coordinate plot, output a valid JSON block inside:
<graph>
{
  "title": "Diagram / Function Title",
  "showAxes": true,
  "elements": [
    { "type": "function", "fn": "x^2 - 4", "color": "#3b82f6" },
    { "type": "line", "x1": -5, "y1": 0, "x2": 5, "y2": 0, "color": "#71717a" },
    { "type": "circle", "cx": 2, "cy": 0, "r": 0.3, "color": "#10b981" },
    { "type": "circle", "cx": -2, "cy": 0, "r": 0.3, "color": "#10b981" }
  ]
}
</graph>
(Supported element types: function with "fn", line with x1/y1/x2/y2, circle with cx/cy/r, text with x/y/text).

DO NOT output any other custom tags (e.g. NO logic_trigger, NO genius_thought, NO socratic_ignition, NO motive_learn, NO motive_build, NO kinesthetic). Only CHAT, EQUATION, and GRAPH.
`;

export const useLiveGemini = (
  apiKey: string | undefined,
) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.DISCONNECTED,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const [currentModelIndex, setCurrentModelIndex] = useState(0);

  // Manually manage history to avoid sending old video blobs back and forth
  const historyRef = useRef<any[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
      setConnectionState(ConnectionState.CONNECTED);
    }
  }, []);

  const sendMessage = async (
    text: string,
    mediaData?: string,
    mimeType?: string,
  ) => {
    const activeApiKey =
      process.env.GEMINI_API_KEY || process.env.API_KEY || apiKey;

    if (!activeApiKey) {
      throw new Error(
        "Guru is missing its brain (API Key). Please check your settings.",
      );
    }

    if (!aiRef.current || (aiRef.current as any).apiKey !== activeApiKey) {
      aiRef.current = new GoogleGenAI({ apiKey: activeApiKey });
    }

    if (mediaData && mediaData.length > 40 * 1024 * 1024) {
      throw new Error("Video file too large. Please record a shorter clip.");
    }

    const userMsgId = Date.now().toString();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", text, isComplete: true },
    ]);

    const modelMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: modelMsgId, role: "model", text: "Thinking...", isComplete: false },
    ]);

    setIsGenerating(true);
    abortControllerRef.current = new AbortController();

    const currentParts: any[] = [{ text }];
    if (mediaData && mimeType) {
      currentParts.push({
        inlineData: {
          mimeType,
          data: mediaData,
        },
      });
    }

    const optimizedHistory = historyRef.current;

    let attempt = 0;
    let success = false;
    let lastError: any = null;
    let modelToUseIndex = currentModelIndex; // Start with the last working model

    while (attempt < 4 && !success) {
      const modelName = MODELS[modelToUseIndex];
      try {
        setConnectionState(ConnectionState.CONNECTING);

        const dynamicSystemInstruction = SYSTEM_INSTRUCTION;

        const response = await aiRef.current!.models.generateContentStream({
          model: modelName,
          contents: [
            ...optimizedHistory,
            { role: "user", parts: currentParts },
          ],
          config: {
            systemInstruction: dynamicSystemInstruction,
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
          },
        });

        setConnectionState(ConnectionState.CONNECTED);
        let fullText = "";
        let hasReceivedChunk = false;
        let lastUpdateTime = Date.now();

        for await (const chunk of response) {
          if (abortControllerRef.current?.signal.aborted) {
            setIsGenerating(false);
            return;
          }
          if (!hasReceivedChunk) {
            hasReceivedChunk = true;
            setMessages((prev) =>
              prev.map((m) => (m.id === modelMsgId ? { ...m, text: "" } : m)),
            );
          }
          if (chunk.text) {
            fullText += chunk.text;

            // Throttle updates for low-end phone performance (~100ms)
            const now = Date.now();
            if (now - lastUpdateTime > 100) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === modelMsgId ? { ...m, text: fullText } : m,
                ),
              );
              lastUpdateTime = now;
            }
          }
        }

        // Final flush
        if (hasReceivedChunk) {
          success = true;
          historyRef.current.push({ role: "user", parts: [{ text }] });
          historyRef.current.push({
            role: "model",
            parts: [{ text: fullText }],
          });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === modelMsgId ? { ...m, isComplete: true } : m,
            ),
          );
          setCurrentModelIndex(modelToUseIndex); // Remember the working model
        } else {
          throw new Error("Empty response");
        }
      } catch (error: any) {
        lastError = error;
        const isQuota =
          error.message?.includes("429") ||
          error.message?.includes("RESOURCE_EXHAUSTED");
        const isPermission =
          error.message?.includes("403") ||
          error.message?.includes("PERMISSION_DENIED");
        const isServerError =
          error.message?.includes("500") || error.message?.includes("503");
        const isNetworkError =
          error.message?.includes("status code: 0") ||
          error.message?.includes("fetch failed");

        if (isQuota || isPermission || isServerError || isNetworkError) {
          console.warn(
            `Model ${modelName} failed (${error.message}). Switching...`,
          );
          modelToUseIndex = (modelToUseIndex + 1) % MODELS.length;
          attempt++;
          if (attempt % MODELS.length === 0) {
            await new Promise((r) => setTimeout(r, 2000));
          }
        } else {
          break;
        }
      }
    }

    setIsGenerating(false);
    abortControllerRef.current = null;

    if (!success) {
      setConnectionState(ConnectionState.ERROR);
      let errorMessage =
        lastError?.message ||
        "Guru is temporarily unavailable. Please try again in a moment.";
      if (errorMessage.includes("429"))
        errorMessage =
          "Guru is processing a lot of students right now! 🧘‍♂️ Take a 1-minute break and try again. Your education is our priority!";
      else if (errorMessage.includes("500") || errorMessage.includes("503"))
        errorMessage =
          "Our AI models are currently overwhelmed or restarting. Please try again in a few seconds.";
      else if (errorMessage.includes("0"))
        errorMessage =
          "Network issue detected. Please check your connection, or try refreshing the page.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === modelMsgId
            ? { ...m, text: errorMessage, isComplete: true }
            : m,
        ),
      );
      throw new Error(errorMessage);
    }
  };

  const connect = useCallback(
    async (preserveExisting: boolean = false) => {
      if (!apiKey) return;

      if (!preserveExisting) {
        historyRef.current = [];
        const initialGreeting =
          "🧠 **MECHATRONICS PCM ENGINE INITIALIZED**\n\nI am your Chief Engineering Mentor. Tell me any topic or question from Physics, Chemistry, or Mathematics. We will break it down to fundamental principles, extract engineering triggers, and connect it directly to robotics, coding, and hardware design.\n\nWhat are we building or mastering today?";

        setMessages([
          {
            id: Date.now().toString(),
            role: "model",
            text: initialGreeting,
            isComplete: true,
          },
        ]);
      }

      setConnectionState(ConnectionState.CONNECTED);
    },
    [apiKey],
  );

  const disconnect = useCallback(() => {
    historyRef.current = [];
    setMessages([]);
    setConnectionState(ConnectionState.DISCONNECTED);
    setIsGenerating(false);
    abortControllerRef.current = null;
  }, []);

  const exportSession = useCallback(() => {
    return {
      messages,
      history: historyRef.current,
    };
  }, [messages]);

  const importSession = useCallback(
    (data: { messages: ChatMessage[]; history: any[] }) => {
      // Restore both history for context and messages for the UI
      historyRef.current = data.history;
      setMessages(data.messages);
    },
    [],
  );

  const sendHiddenMessage = async (text: string) => {
    const activeApiKey =
      process.env.GEMINI_API_KEY || process.env.API_KEY || apiKey;
    if (!activeApiKey || connectionState !== ConnectionState.CONNECTED) return;
    try {
      if (!aiRef.current || (aiRef.current as any).apiKey !== activeApiKey) {
        aiRef.current = new GoogleGenAI({ apiKey: activeApiKey });
      }
      historyRef.current.push({ role: "user", parts: [{ text }] });
    } catch (e) {
      console.error(e);
    }
  };

  return {
    connect,
    disconnect,
    connectionState,
    messages,
    sendMessage,
    sendHiddenMessage,
    stopGeneration,
    isGenerating,
    exportSession,
    importSession,
  };
};
