import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  Camera,
  CameraOff,
  Send,
  Loader2,
  Square,
  Video,
  X,
  Zap,
  Save,
  Upload,
  Flashlight,
  Cpu,
  CheckCircle2,
  Moon,
  Power,
  Info,
  Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveGemini } from "./hooks/useLiveGemini";
import MessageRenderer from "./components/MessageRenderer";
import { ConnectionState } from "./types";

const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY || "";
const STORAGE_KEY = "guru_pcm_session_persistent";

const App = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [thinkingTime, setThinkingTime] = useState(0);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedBase64, setRecordedBase64] = useState<string | null>(null);
  const [videoQuality, setVideoQuality] = useState<"low" | "high">("high");
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);

  // Focus Timer state
  const [solvingTimer, setSolvingTimer] = useState(0);
  const [isSolving, setIsSolving] = useState(false);
  const [questionsSolved, setQuestionsSolved] = useState(0);

  const [isRestored, setIsRestored] = useState(false);

  const MAX_RECORDING_SECONDS = videoQuality === "high" ? 120 : 500;
  const MAX_RECORDING_SIZE_MB = 28;

  const {
    connect,
    disconnect,
    connectionState,
    messages,
    sendMessage,
    stopGeneration,
    isGenerating,
    exportSession,
    importSession,
  } = useLiveGemini(API_KEY);

  // 1. Session Restoration: Load saved messages so chat NEVER restarts after inactivity
  useEffect(() => {
    if (isRestored) return;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data && data.messages && data.messages.length > 0) {
          importSession({ messages: data.messages, history: data.history || [] });
          if (data.solvingTimer) setSolvingTimer(data.solvingTimer);
          if (data.questionsSolved) setQuestionsSolved(data.questionsSolved);
          connect(true);
          setIsRestored(true);
          return;
        }
      }
    } catch (e) {
      console.warn("Failed to load existing session from storage", e);
    }

    // If no previous session, initialize cleanly
    connect(false);
    setIsRestored(true);
  }, [connect, importSession, isRestored]);

  // 2. Continuous Persistence: Save messages whenever they update
  useEffect(() => {
    if (!isRestored) return;
    if (messages.length > 0) {
      try {
        const sessionData = exportSession();
        const fullData = {
          ...sessionData,
          solvingTimer,
          questionsSolved,
          savedAt: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fullData));
      } catch (e) {
        console.warn("Storage quota warning", e);
      }
    }
  }, [messages, solvingTimer, questionsSolved, exportSession, isRestored]);

  // Camera Management
  const startStream = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser does not support camera access.");
      }

      let newStream: MediaStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch (err) {
        newStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
      }

      setStream(newStream);
      setIsTorchOn(false);
      setIsCameraOn(true);
      setErrorMsg(null);
    } catch (err: any) {
      console.warn("Camera stream unavailable:", err);
      setIsCameraOn(false);
    }
  };

  // Auto-start camera on initial load
  useEffect(() => {
    let mounted = true;
    const initCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
        let newStream: MediaStream;
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          });
        } catch (err) {
          newStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        }
        if (mounted) {
          setStream(newStream);
          setIsCameraOn(true);
        }
      } catch (err) {
        console.warn("Camera auto-start failed:", err);
      }
    };
    initCamera();
    return () => { mounted = false; };
  }, []);

  const toggleCamera = () => {
    if (isCameraOn) {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
      setIsCameraOn(false);
      setIsTorchOn(false);
    } else {
      startStream();
    }
  };

  useEffect(() => {
    if (stream && videoRef.current && videoRef.current.srcObject !== stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const toggleTorch = async () => {
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    try {
      setIsTorchOn((prev) => {
        const nextState = !prev;
        videoTrack
          .applyConstraints({
            advanced: [{ torch: nextState }],
          } as any)
          .catch((err) => console.warn("Torch failed", err));
        return nextState;
      });
    } catch (err) {
      setErrorMsg("Flashlight toggle not supported on this device.");
    }
  };

  // Video Recording Logic
  const startRecording = useCallback(() => {
    if (!stream || isRecording) return;

    setRecordedBlob(null);
    setRecordedBase64(null);
    chunksRef.current = [];

    const mimeType = "video/webm;codecs=vp8,opus";
    const bitrate = videoQuality === "high" ? 1200000 : 400000;
    const options = { mimeType, videoBitsPerSecond: bitrate };

    try {
      const recorder = new MediaRecorder(stream, options);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          const currentSize = chunksRef.current.reduce((acc, c) => acc + c.size, 0);
          if (currentSize > MAX_RECORDING_SIZE_MB * 1024 * 1024) {
            stopRecording();
          }
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setRecordedBlob(blob);
        chunksRef.current = [];
        setIsRecording(false);
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (e) {
      console.error("Recording error", e);
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setRecordedBlob(blob);
        setIsRecording(false);
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    }
  }, [stream, isRecording, videoQuality]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  useEffect(() => {
    let interval: number;
    if (isRecording) {
      interval = window.setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= MAX_RECORDING_SECONDS - 1) {
            stopRecording();
            return MAX_RECORDING_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isRecording, stopRecording, MAX_RECORDING_SECONDS]);

  // Thinking Time counter
  useEffect(() => {
    let interval: number;
    if (isGenerating) {
      setThinkingTime(0);
      interval = window.setInterval(() => {
        setThinkingTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  // Message Sending
  const handleSendTextOnly = async () => {
    if (!inputText.trim() || isGenerating) return;

    setThinkingTime(0);
    setErrorMsg(null);
    try {
      const text = inputText.trim();
      setInputText("");
      await sendMessage(text);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to send message.");
    }
  };

  const handleReply = async (text: string) => {
    if (!text.trim() || isGenerating) return;
    setThinkingTime(0);
    setErrorMsg(null);
    try {
      await sendMessage(text.trim());
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to send message.");
    }
  };

  const handleSendVideoWithText = async () => {
    if (!recordedBlob || isGenerating) return;

    setThinkingTime(0);
    setUploadProgress(15);
    setErrorMsg(null);

    try {
      if (recordedBlob.size > 30 * 1024 * 1024) {
        throw new Error("Video file too large (exceeds 30MB limit). Please record a shorter clip.");
      }

      setUploadProgress(40);
      let base64data = recordedBase64;
      if (!base64data) {
        base64data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64 = result.split(",")[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(recordedBlob);
        });
        setRecordedBase64(base64data);
      }

      setUploadProgress(70);
      const textToSend = inputText.trim() || "Examine this problem or equation. Break it down from first principles.";
      await sendMessage(textToSend, base64data, "video/webm");

      setUploadProgress(100);
      setInputText("");
      setRecordedBlob(null);
      setRecordedBase64(null);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to process video input.");
    } finally {
      setUploadProgress(0);
    }
  };

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Focus Timer Logic
  useEffect(() => {
    if (isSolving) {
      timerIntervalRef.current = setInterval(() => {
        setSolvingTimer((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isSolving]);

  const handleStartSolving = () => {
    setIsSolving(true);
    setSolvingTimer(0);
    setQuestionsSolved(0);
  };

  const handleFinishSolving = async () => {
    setIsSolving(false);
    const finalTime = formatTime(solvingTimer);
    const finalQs = questionsSolved;
    setSolvingTimer(0);
    setQuestionsSolved(0);

    try {
      await sendMessage(
        `I finished my focused practice session! Duration: ${finalTime}. Questions Solved: ${finalQs}.`
      );
    } catch (err) {
      console.error(err);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Sleep Mode
  const handleSleep = () => {
    setIsSleeping(true);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  };

  const handleWake = () => {
    setIsSleeping(false);
    if (isCameraOn) {
      startStream();
    }
  };

  // Session Export & Import
  const handleSave = () => {
    const sessionData = exportSession();
    const data = {
      ...sessionData,
      solvingTimer,
      questionsSolved,
      type: "PCM_SOURCE_CODE_SAVE",
    };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mechatronics-pcm-session-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.messages && Array.isArray(json.messages)) {
          importSession(json);
          if (json.solvingTimer) setSolvingTimer(json.solvingTimer);
          if (json.questionsSolved) setQuestionsSolved(json.questionsSolved);
        } else {
          setErrorMsg("Incompatible save file format.");
        }
      } catch (err) {
        setErrorMsg("Failed to load save file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Explicit Clear Chat
  const handleNewChat = () => {
    const confirmed = window.confirm("Start a brand new chat? This will clear your current session.");
    if (!confirmed) return;

    disconnect();
    setErrorMsg(null);
    setRecordedBlob(null);
    setInputText("");
    setSolvingTimer(0);
    setQuestionsSolved(0);
    localStorage.removeItem(STORAGE_KEY);
    connect(false);
  };

  if (isSleeping) {
    return (
      <div className="h-[100dvh] w-full max-w-md mx-auto bg-zinc-950 flex flex-col items-center justify-center text-white fixed inset-0 z-[9999] sm:border-x sm:border-zinc-800">
        <Moon size={64} className="text-zinc-600 mb-6" />
        <h2 className="text-2xl font-bold mb-2 font-mono">Resting Mode</h2>
        <p className="text-zinc-400 mb-8 max-w-xs text-center text-sm">
          Camera and streams paused to conserve battery while you review notes. Your session is safely preserved.
        </p>
        <button
          onClick={handleWake}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full font-bold font-mono shadow-lg transition-all hover:scale-105 active:scale-95"
        >
          <Power size={20} />
          Wake Up System
        </button>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full max-w-md mx-auto flex flex-col overflow-hidden font-sans sm:border-x relative bg-zinc-950 text-zinc-100 sm:border-zinc-800 sm:shadow-2xl">
      {/* Header */}
      <header className="px-4 py-3 flex justify-between items-center border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-xl z-50 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center shadow-inner">
            <Cpu size={18} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-white font-mono flex items-center gap-1.5 leading-none">
              MECHATRONICS CORE
            </h1>
            <span className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase">
              Engineering & Code First-Principles
            </span>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-1.5 text-zinc-400">
          <button
            onClick={handleSleep}
            className="p-2 rounded-lg hover:bg-zinc-800/60 hover:text-zinc-200 transition-colors"
            title="Sleep View"
          >
            <Moon size={15} />
          </button>
          <button
            onClick={handleSave}
            className="p-2 rounded-lg hover:bg-zinc-800/60 hover:text-zinc-200 transition-colors"
            title="Save Session"
          >
            <Save size={15} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg hover:bg-zinc-800/60 hover:text-zinc-200 transition-colors"
            title="Load Session"
          >
            <Upload size={15} />
          </button>
          <button
            onClick={toggleCamera}
            className={`p-2 rounded-lg transition-all ${
              isCameraOn ? "text-blue-400 bg-blue-500/10 border border-blue-500/30" : "hover:bg-zinc-800/60"
            }`}
            title={isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
          >
            {isCameraOn ? <Camera size={15} /> : <CameraOff size={15} />}
          </button>
          {isCameraOn && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-lg transition-all ${
                isTorchOn ? "text-amber-300 bg-amber-400/20 border border-amber-400/30" : "hover:bg-zinc-800/60"
              }`}
              title="Toggle Flashlight"
            >
              <Flashlight size={15} />
            </button>
          )}
          <button
            onClick={handleNewChat}
            className="p-2 rounded-lg hover:bg-blue-500/20 hover:text-blue-400 transition-colors"
            title="Start New Chat"
          >
            <Plus size={15} />
          </button>
          <div className="flex items-center gap-1 pl-1">
            <div
              className={`w-2 h-2 rounded-full ${
                connectionState === ConnectionState.CONNECTED ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
              }`}
              title={`Connection: ${connectionState}`}
            />
          </div>
        </div>
      </header>

      {/* Focus Timer Sub-header */}
      <div className="px-4 py-2.5 flex items-center justify-between shrink-0 bg-zinc-900/70 border-b border-zinc-800/80 backdrop-blur-md z-40 sticky top-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 font-bold">
            <Zap size={13} className="text-amber-400" />
            <span>FOCUS:</span>
          </div>
          {!isSolving ? (
            <button
              onClick={handleStartSolving}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-bold rounded-lg uppercase tracking-wider font-mono border border-zinc-700 transition-colors"
            >
              START TIMER
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded text-[11px] font-mono font-black">
                {formatTime(solvingTimer)}
              </span>
              <button
                onClick={() => setQuestionsSolved((prev) => prev + 1)}
                className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold rounded-lg font-mono"
              >
                +1 Q ({questionsSolved})
              </button>
              <button
                onClick={handleFinishSolving}
                className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-bold rounded-lg font-mono flex items-center gap-1"
              >
                <CheckCircle2 size={12} className="text-emerald-400" /> DONE
              </button>
            </div>
          )}
        </div>

        <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
          CHAT • EQUATION • GRAPH
        </div>
      </div>

      {/* Flexible Layout Container */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <main className="flex-1 relative overflow-hidden flex flex-col bg-zinc-950">
          {/* Camera View (when enabled) */}
          {isCameraOn && (
            <div className="absolute inset-0 z-0 bg-zinc-950">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover opacity-80"
                style={{
                  filter: isGenerating ? "grayscale(0.8) blur(6px)" : "none",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-zinc-950/40" />
            </div>
          )}

          {/* Recording Overlay */}
          <AnimatePresence>
            {isRecording && (
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600/90 backdrop-blur-md text-white px-5 py-2.5 rounded-2xl flex items-center gap-3 shadow-2xl z-30 border border-white/20"
              >
                <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                <span className="text-sm font-bold font-mono">
                  Optical Scan: {recordingTime}s / {MAX_RECORDING_SECONDS}s
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chat Messages */}
          <div
            className="flex-1 relative z-10 overflow-y-auto px-4 sm:px-6 py-6 space-y-5 no-scrollbar pb-8"
            ref={containerRef}
          >
            <AnimatePresence mode="popLayout">
              {messages.map((msg, idx, slicedArr) => {
                const isLast = idx === slicedArr.length - 1;
                return (
                  <motion.div
                    key={msg.id}
                    initial={isLast ? { opacity: 0, y: 10, scale: 0.98 } : false}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    layout={false}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[90%] sm:max-w-[85%] overflow-hidden break-words rounded-2xl px-5 py-4 shadow-sm border ${
                        msg.role === "user"
                          ? "bg-zinc-800 border-zinc-700 text-white font-sans text-sm"
                          : "bg-zinc-900/95 backdrop-blur-md text-zinc-100 border-zinc-800 text-sm shadow-md"
                      }`}
                    >
                      <MessageRenderer content={msg.text} onReply={handleReply} />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* AI Generation State */}
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="bg-zinc-900/95 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-zinc-800 flex flex-col gap-2.5 shadow-md w-full max-w-[280px]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Loader2 size={18} className="animate-spin text-blue-400" />
                      <span className="text-xs font-bold text-zinc-300 font-mono">
                        {uploadProgress > 0 && uploadProgress < 100
                          ? `Uploading Data (${uploadProgress}%)...`
                          : "Interrogating Principles..."}
                      </span>
                    </div>
                    <button
                      onClick={stopGeneration}
                      className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
                      title="Stop Generation"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <motion.div
                        className="bg-blue-500 h-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                  <span className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
                    Thinking: {thinkingTime}s
                  </span>
                </div>
              </motion.div>
            )}

            {/* Error Notifications */}
            {errorMsg && (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center gap-2 my-2"
              >
                <div className="bg-red-950/80 border border-red-800 text-red-200 px-4 py-3 rounded-2xl text-xs font-mono flex items-center justify-between gap-3 shadow-sm max-w-md w-full">
                  <div className="flex items-center gap-2.5">
                    <Info size={16} className="text-red-400 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                  <button
                    onClick={() => setErrorMsg(null)}
                    className="p-1 hover:bg-red-900 rounded text-red-400 hover:text-white transition-colors shrink-0"
                    title="Dismiss"
                  >
                    <X size={14} />
                  </button>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>
      </div>

      {/* Action Bar & Input Controls */}
      <footer className="p-4 backdrop-blur-2xl border-t border-zinc-800 bg-zinc-950/95 pb-safe z-50 shrink-0">
        <div className="max-w-md mx-auto space-y-3">
          {/* Captured Video Preview */}
          <AnimatePresence>
            {recordedBlob && !isRecording && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-2xl p-3 border border-zinc-700 bg-zinc-900 flex items-center gap-3 mb-2 shadow-sm">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/20 text-blue-400">
                    <Video size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-xs font-mono text-white">
                      OPTICAL CLIP CAPTURED
                    </p>
                    <p className="text-[10px] text-zinc-400 font-mono">
                      Ready for First-Principles Analysis
                    </p>
                  </div>
                  <button
                    onClick={() => setRecordedBlob(null)}
                    className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Optical Scanner Controls (when camera is on) */}
          {isCameraOn && (
            <div className="flex gap-2.5">
              {!isRecording && (
                <div className="flex flex-col gap-1 justify-center">
                  <button
                    onClick={() => setVideoQuality("high")}
                    className={`w-11 h-6 rounded text-[9px] font-black font-mono border transition-all ${
                      videoQuality === "high"
                        ? "bg-zinc-800 text-blue-400 border-blue-500/40 shadow-sm"
                        : "text-zinc-500 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    HD
                  </button>
                  <button
                    onClick={() => setVideoQuality("low")}
                    className={`w-11 h-6 rounded text-[9px] font-black font-mono border transition-all ${
                      videoQuality === "low"
                        ? "bg-zinc-800 text-blue-400 border-blue-500/40 shadow-sm"
                        : "text-zinc-500 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    FAST
                  </button>
                </div>
              )}

              {!isRecording ? (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={startRecording}
                  disabled={isGenerating}
                  className="flex-1 h-14 rounded-2xl flex items-center justify-center gap-2.5 border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-white font-mono text-xs font-bold transition-colors shadow-sm"
                >
                  <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  <span>RECORD PROBLEM CLIP</span>
                </motion.button>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={stopRecording}
                  className="flex-1 bg-red-600 hover:bg-red-500 h-14 rounded-2xl flex items-center justify-center gap-2 text-white font-mono text-xs font-bold transition-colors shadow-lg"
                >
                  <Square size={16} fill="currentColor" />
                  <span>STOP & INTERROGATE</span>
                </motion.button>
              )}

              {recordedBlob && !isRecording && (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSendVideoWithText}
                  disabled={isGenerating}
                  className="flex-1 h-14 rounded-2xl flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold transition-colors shadow-lg border border-blue-500/30"
                >
                  {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  <span>ANALYZE CLIP</span>
                </motion.button>
              )}
            </div>
          )}

          {/* Primary Text Prompt Input */}
          {!isRecording && (
            <div className="flex gap-2">
              <input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (recordedBlob) {
                      handleSendVideoWithText();
                    } else {
                      handleSendTextOnly();
                    }
                  }
                }}
                placeholder={
                  recordedBlob
                    ? "Add query parameters or question focus..."
                    : "Ask any PCM topic, derivation, or problem..."
                }
                className="flex-1 border border-zinc-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 font-mono"
              />
              {!recordedBlob && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSendTextOnly}
                  disabled={!inputText.trim() || isGenerating}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-5 rounded-2xl font-bold font-mono text-sm border border-blue-500/30 flex items-center justify-center"
                >
                  <Send size={16} />
                </motion.button>
              )}
            </div>
          )}
        </div>
      </footer>

      {/* Hidden File Input for loading saves */}
      <input
        type="file"
        accept=".json"
        ref={fileInputRef}
        onChange={handleLoad}
        className="hidden"
      />
    </div>
  );
};

export default App;
