import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";

export interface KinestheticAnimation {
  property: string;
  keyframes: (number | string)[];
  times?: number[];
  ease?: "linear" | "easeInOut" | "easeIn" | "easeOut";
}

export interface KinestheticElement {
  id: string;
  type: "circle" | "rect" | "line" | "text" | "path" | "group";

  // Base SVG properties (can be animated)
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  r?: number;
  width?: number;
  height?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  opacity?: number;
  rotation?: number; // in degrees
  originX?: number;
  originY?: number;

  // Styling
  color?: string; // used for fill/stroke depending on element type
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dashed?: boolean;

  // Text
  text?: string;
  fontSize?: number;

  // Path
  d?: string;

  animations?: KinestheticAnimation[];
}

export interface KinestheticData {
  title?: string;
  width?: number; // logical width for viewBox
  height?: number; // logical height for viewBox
  duration?: number; // seconds
  elements: KinestheticElement[];
}

const easeInOutQuad = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeInQuad = (t: number) => t * t;
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);

function interpolateValue(progress: number, anim: KinestheticAnimation) {
  const { keyframes, times, ease } = anim;
  if (!keyframes || keyframes.length === 0) return 0;
  if (keyframes.length === 1) return keyframes[0];

  const t = times || keyframes.map((_, i) => i / (keyframes.length - 1));

  if (progress <= t[0]) return keyframes[0];
  if (progress >= t[t.length - 1]) return keyframes[keyframes.length - 1];

  let i = 0;
  while (i < t.length - 1 && progress >= t[i + 1]) {
    i++;
  }

  let segmentProgress = (progress - t[i]) / (t[i + 1] - t[i]);

  if (ease === "easeInOut") segmentProgress = easeInOutQuad(segmentProgress);
  else if (ease === "easeIn") segmentProgress = easeInQuad(segmentProgress);
  else if (ease === "easeOut") segmentProgress = easeOutQuad(segmentProgress);

  if (typeof keyframes[0] === "number") {
    return (
      (keyframes[i] as number) +
      ((keyframes[i + 1] as number) - (keyframes[i] as number)) *
        segmentProgress
    );
  } else {
    // For strings/colors, do a hard switch at half-way
    return segmentProgress < 0.5 ? keyframes[i] : keyframes[i + 1];
  }
}

const KinestheticSandbox: React.FC<{ data: KinestheticData }> = ({ data }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const requestRef = useRef<number>(undefined);
  const lastTimeRef = useRef<number>(undefined);

  const durationMs = (data.duration || 5) * 1000;

  const animate = (time: number) => {
    if (lastTimeRef.current !== undefined) {
      const deltaTime = time - lastTimeRef.current;
      setProgress((prevProgress) => {
        const nextProgress = prevProgress + deltaTime / durationMs;
        if (nextProgress >= 1) {
          setIsPlaying(false);
          return 1;
        }
        return nextProgress;
      });
    }
    lastTimeRef.current = time;
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, durationMs]);

  const togglePlay = () => {
    if (progress >= 1) {
      setProgress(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProgress(parseFloat(e.target.value));
    setIsPlaying(false);
  };

  const vBoxW = data.width || 100;
  const vBoxH = data.height || 100;

  return (
    <div className="my-6 border border-zinc-200 rounded-2xl overflow-hidden shadow-md w-full bg-white font-sans max-w-2xl mx-auto">
      <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-2 flex items-center justify-between">
        <h3 className="font-bold text-zinc-800 text-sm flex items-center gap-2">
          <span className="text-lg">🎬</span>
          {data.title || "Kinesthetic Animation"}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setProgress(0);
              setIsPlaying(false);
            }}
            className="p-1.5 hover:bg-zinc-200 text-zinc-500 rounded-md transition-colors"
            title="Reset"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={togglePlay}
            className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors font-bold flex items-center gap-1.5 shadow-sm"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            <span className="text-xs uppercase tracking-wider">
              {isPlaying ? "Pause" : "Play"}
            </span>
          </button>
        </div>
      </div>

      <div className="relative w-full aspect-video bg-zinc-900 overflow-hidden flex items-center justify-center">
        <svg
          viewBox={`0 0 ${vBoxW} ${vBoxH}`}
          className="w-full h-full drop-shadow-lg max-h-[400px]"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>
          {data.elements.map((el, i) => {
            // Calculate animated properties
            const props = { ...el } as any;
            if (el.animations) {
              el.animations.forEach((anim) => {
                props[anim.property] = interpolateValue(progress, anim);
              });
            }

            const commonStyles = {
              opacity: props.opacity !== undefined ? props.opacity : 1,
              transform: props.rotation
                ? `rotate(${props.rotation}deg)`
                : undefined,
              transformOrigin: `${props.originX ?? 0}px ${props.originY ?? 0}px`,
              transition: "none", // React might try to tween strings if we rely on CSS, but we force hard updates
            };

            switch (el.type) {
              case "circle":
                return (
                  <circle
                    key={el.id || i}
                    cx={props.cx ?? 0}
                    cy={props.cy ?? 0}
                    r={props.r ?? 10}
                    fill={props.fill || props.color || "#3b82f6"}
                    stroke={props.stroke}
                    strokeWidth={props.strokeWidth}
                    strokeDasharray={props.dashed ? "4,4" : undefined}
                    style={commonStyles}
                  />
                );
              case "rect":
                return (
                  <rect
                    key={el.id || i}
                    x={props.x ?? 0}
                    y={props.y ?? 0}
                    width={props.width ?? 10}
                    height={props.height ?? 10}
                    fill={props.fill || props.color || "#3b82f6"}
                    stroke={props.stroke}
                    strokeWidth={props.strokeWidth}
                    strokeDasharray={props.dashed ? "4,4" : undefined}
                    style={commonStyles}
                  />
                );
              case "line":
                return (
                  <line
                    key={el.id || i}
                    x1={props.x1 ?? 0}
                    y1={props.y1 ?? 0}
                    x2={props.x2 ?? 0}
                    y2={props.y2 ?? 0}
                    stroke={props.stroke || props.color || "#3b82f6"}
                    strokeWidth={props.strokeWidth ?? 2}
                    strokeDasharray={props.dashed ? "4,4" : undefined}
                    markerEnd={
                      el.id?.includes("vector") || el.id?.includes("arrow")
                        ? "url(#arrow)"
                        : undefined
                    }
                    style={{
                      ...commonStyles,
                      color: props.stroke || props.color || "#3b82f6",
                    }}
                  />
                );
              case "text":
                return (
                  <text
                    key={el.id || i}
                    x={props.x ?? 0}
                    y={props.y ?? 0}
                    fill={props.fill || props.color || "#ffffff"}
                    fontSize={props.fontSize ?? vBoxH * 0.05}
                    fontFamily="monospace"
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    style={commonStyles}
                    fontWeight="bold"
                  >
                    {props.text}
                  </text>
                );
              case "path":
                return (
                  <path
                    key={el.id || i}
                    d={props.d ?? ""}
                    fill={props.fill || "none"}
                    stroke={props.stroke || props.color || "#3b82f6"}
                    strokeWidth={props.strokeWidth ?? 2}
                    strokeDasharray={props.dashed ? "4,4" : undefined}
                    style={commonStyles}
                  />
                );
              default:
                return null;
            }
          })}
        </svg>
      </div>

      <div className="px-4 py-3 bg-zinc-50 border-t border-zinc-200 flex items-center gap-3">
        <span className="text-[10px] font-mono font-bold text-zinc-500 w-12 text-right tracking-wider">
          {(progress * (data.duration || 5)).toFixed(1)}s
        </span>
        <div className="flex-1 relative flex items-center">
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={progress}
            onChange={handleSliderChange}
            className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-blue-600 relative z-10"
          />
        </div>
        <span className="text-[10px] font-mono font-bold text-zinc-500 w-12 tracking-wider">
          {(data.duration || 5).toFixed(1)}s
        </span>
      </div>
    </div>
  );
};

export default KinestheticSandbox;
