import React, { useMemo, useState } from "react";
import { Focus, RotateCcw } from "lucide-react";
import {
  Mafs,
  Coordinates,
  Plot,
  Line,
  Circle,
  Polygon,
  Polyline,
  Vector,
  Text,
  LaTeX,
  Ellipse,
} from "mafs";
import "mafs/core.css";
import "mafs/font.css";
import "katex/dist/katex.min.css";

export interface WhiteboardElement {
  type:
    | "line"
    | "circle"
    | "rect"
    | "text"
    | "arrow"
    | "path"
    | "ellipse"
    | "function"
    | "polygon"
    | "freehand";
  layer?: number;
  originalIndex?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  cx?: number;
  cy?: number;
  r?: number;
  rx?: number;
  ry?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  label?: string;
  color?: string;
  d?: string; // For path
  points?: string; // For polygon
  pointsList?: [number, number][]; // For freehand
  strokeWidth?: number;
  fill?: boolean | string;
  fn?: string; // For function
  range?: [number, number]; // For function
  step?: number; // For function
  coordSystem?: "screen" | "cartesian";
  fontSize?: number;
}

export interface WhiteboardData {
  title?: string;
  width?: number;
  height?: number;
  showAxes?: boolean;
  elements: WhiteboardElement[];
}

const Whiteboard: React.FC<{ data: WhiteboardData }> = ({ data }) => {
  const [resetKey, setResetKey] = useState(0);

  if (!data || !data.elements) return null;

  const num = (val: any, defaultVal = 0) => {
    if (val === undefined || val === null) return defaultVal;
    const n = typeof val === "number" ? val : Number(val);
    return Number.isFinite(n) ? n : defaultVal;
  };

  const viewBox = useMemo(() => {
    if (!data.elements || data.elements.length === 0) {
      return {
        x: [-12, 12] as [number, number],
        y: [-12, 12] as [number, number],
      };
    }

    let minX = -5,
      maxX = 5,
      minY = -5,
      maxY = 5;

    data.elements.forEach((el) => {
      const coords: [number | undefined, number | undefined][] = [
        [num(el.x), num(el.y)],
        [num(el.x1), num(el.y1)],
        [num(el.x2), num(el.y2)],
        [num(el.cx), num(el.cy)],
        [
          el.cx !== undefined ? num(el.cx) + num(el.r || el.rx) : undefined,
          el.cy !== undefined ? num(el.cy) + num(el.r || el.ry) : undefined,
        ],
        [
          el.cx !== undefined ? num(el.cx) - num(el.r || el.rx) : undefined,
          el.cy !== undefined ? num(el.cy) - num(el.r || el.ry) : undefined,
        ],
        [
          el.x !== undefined ? num(el.x) + num(el.width) : undefined,
          el.y !== undefined ? num(el.y) + num(el.height) : undefined,
        ],
      ];

      coords.forEach(([x, y]) => {
        if (x !== undefined && Number.isFinite(x)) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
        if (y !== undefined && Number.isFinite(y)) {
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      });

      // Special case for paths/freehand if points are strings
      if (el.pointsList) {
        el.pointsList.forEach((p) => {
          minX = Math.min(minX, num(p[0]));
          maxX = Math.max(maxX, num(p[0]));
          minY = Math.min(minY, num(p[1]));
          maxY = Math.max(maxY, num(p[1]));
        });
      }
    });

    const xRange = maxX - minX;
    const yRange = maxY - minY;
    const paddingX = Math.max(2, xRange * 0.15);
    const paddingY = Math.max(2, yRange * 0.15);

    return {
      x: [minX - paddingX, maxX + paddingX] as [number, number],
      y: [minY - paddingY, maxY + paddingY] as [number, number],
    };
  }, [data.elements]);

  const evaluate = (fn: string, x: number) => {
    if (!fn) return 0;
    try {
      let safeFn = fn.replace(/\^/g, "**");
      const mathProps = [
        "sin",
        "cos",
        "tan",
        "asin",
        "acos",
        "atan",
        "sinh",
        "cosh",
        "tanh",
        "exp",
        "log",
        "sqrt",
        "abs",
        "PI",
        "E",
        "pow",
        "round",
        "ceil",
        "floor",
      ];
      mathProps.forEach((prop) => {
        const regex = new RegExp(`\\b${prop}\\b`, "g");
        safeFn = safeFn.replace(regex, `Math.${prop}`);
      });
      safeFn = safeFn.replace(/Math\.Math\./g, "Math.");
      const result = new Function(
        "x",
        `try { return ${safeFn}; } catch(e) { return 0; }`,
      )(x);
      const n = typeof result === "number" ? result : Number(result);
      return Number.isFinite(n) ? n : 0;
    } catch (e) {
      return 0;
    }
  };

  const sortedElements = useMemo(() => {
    return [...data.elements]
      .map((el, index) => ({
        ...el,
        layer: el.layer ?? 0,
        originalIndex: index,
      }))
      .sort((a, b) => a.layer - b.layer || a.originalIndex - b.originalIndex);
  }, [data.elements]);

  return (
    <div
      className="my-6 border border-zinc-200 rounded-2xl overflow-hidden shadow-md w-full bg-white relative custom-whiteboard"
      style={{ height: "clamp(400px, 60vh, 600px)", touchAction: "none" }}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <style>
        {`
          .custom-whiteboard .MafsView {
            background-color: #ffffff !important;
            --mafs-bg: #ffffff;
            --mafs-fg: #94a3b8;
            --mafs-origin-color: #64748b;
            --mafs-line-color: #f1f5f9;
            --grid-line-subdivision-color: #f8fafc;
            --mafs-axis-stroke-width: 1px;
            background-image: 
              linear-gradient(rgba(0, 0, 0, 0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 0, 0, 0.02) 1px, transparent 1px);
            background-size: 20px 20px;
            background-position: center;
            touch-action: none;
          }
          .custom-whiteboard::before {
            content: "";
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: linear-gradient(rgba(255, 255, 255, 0) 50%, rgba(200, 200, 200, 0.05) 50%), linear-gradient(90deg, rgba(0, 0, 0, 0.01), transparent, rgba(0, 0, 0, 0.01));
            background-size: 100% 4px, 3px 100%;
            pointer-events: none;
            z-index: 50;
          }
          .custom-whiteboard .MafsView text {
            font-size: 11px;
            font-weight: 800;
            fill: #000;
            font-family: 'JetBrains Mono', monospace;
            text-transform: uppercase;
            paint-order: stroke;
            stroke: #fff;
            stroke-width: 4px;
            stroke-linecap: round;
            stroke-linejoin: round;
          }
          .custom-whiteboard .MafsView .mafs-latex {
             background: white;
             padding: 1px 2px;
             border-radius: 2px;
             font-size: 14px;
          }
          .custom-whiteboard .MafsView svg {
            cursor: crosshair;
          }
        `}
      </style>

      {/* Decorative Lab Elements - Subtle */}
      <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-zinc-200 z-20 pointer-events-none" />
      <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-zinc-200 z-20 pointer-events-none" />
      <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-zinc-200 z-20 pointer-events-none" />
      <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-zinc-200 z-20 pointer-events-none" />

      {data.title && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-white/90 backdrop-blur-md px-4 py-3 border-b border-zinc-100 text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] flex items-center justify-between pointer-events-none font-mono">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
            <span className="text-zinc-600">{data.title}</span>
          </div>
          <div className="flex items-center gap-4 text-zinc-300">
            <span>CORE_DISPLAY</span>
            <span className="opacity-50">STABILITY: 100%</span>
          </div>
        </div>
      )}
      <div className="w-full h-full relative z-0">
        <Mafs
          key={resetKey}
          pan={true}
          zoom={{ min: 0.1, max: 20 }}
          viewBox={viewBox}
          preserveAspectRatio="contain"
        >
          {data.showAxes && <Coordinates.Cartesian subdivisions={5} />}

          {sortedElements.map((el, i) => {
            const color = el.color || "#ef4444";
            const weight = el.strokeWidth || 2.5;
            const fillOpacity = el.fill ? 0.3 : 0;
            const key = `el-${i}-${el.type}`;

            switch (el.type) {
              case "function":
                if (!el.fn) return null;
                return (
                  <Plot.OfX
                    key={key}
                    y={(x) => evaluate(el.fn!, x)}
                    color={color}
                    weight={weight}
                  />
                );
              case "line":
                return (
                  <Line.Segment
                    key={key}
                    point1={[num(el.x1), num(el.y1)]}
                    point2={[num(el.x2), num(el.y2)]}
                    color={color}
                    weight={weight}
                  />
                );
              case "arrow":
                return (
                  <Vector
                    key={key}
                    tail={[num(el.x1), num(el.y1)]}
                    tip={[num(el.x2), num(el.y2)]}
                    color={color}
                    weight={weight}
                  />
                );
              case "circle":
                return (
                  <Circle
                    key={key}
                    center={[num(el.cx), num(el.cy)]}
                    radius={num(el.r)}
                    color={color}
                    weight={weight}
                    fillOpacity={fillOpacity}
                  />
                );
              case "ellipse":
                return (
                  <Ellipse
                    key={key}
                    center={[num(el.cx), num(el.cy)]}
                    radius={[num(el.rx), num(el.ry)]}
                    angle={0}
                    color={color}
                    weight={weight}
                    fillOpacity={fillOpacity}
                  />
                );
              case "rect":
                const rx = num(el.x);
                const ry = num(el.y);
                const w = num(el.width);
                const h = num(el.height);
                return (
                  <Polygon
                    key={key}
                    points={[
                      [rx, ry],
                      [rx + w, ry],
                      [rx + w, ry - h],
                      [rx, ry - h],
                    ]}
                    color={color}
                    weight={weight}
                    fillOpacity={fillOpacity}
                  />
                );
              case "polygon":
                if (!el.points) return null;
                const pts = el.points.split(" ").map((p) => {
                  const parts = p.split(",");
                  const px = num(parts[0]);
                  const py = num(parts[1]);
                  return [px, py] as [number, number];
                });
                return (
                  <Polygon
                    key={key}
                    points={pts}
                    color={color}
                    weight={weight}
                    fillOpacity={fillOpacity}
                  />
                );
              case "freehand":
                if (!el.pointsList) return null;
                const freehandPts = el.pointsList.map(
                  (p) => [num(p[0]), num(p[1])] as [number, number],
                );
                return (
                  <Polyline
                    key={key}
                    points={freehandPts}
                    color={color}
                    weight={weight}
                    fillOpacity={0}
                  />
                );
              case "path":
                return null;
            }
            return null;
          })}

          {/* Render Text elements separately with better positioning */}
          {sortedElements.map((el, i) => {
            const color = el.color || "#000000";
            const labelText = el.text || el.label;
            const size = num(el.fontSize ? el.fontSize / 10 : 1.8, 1.8);

            if (!labelText) return null;
            const key = `text-${i}`;

            let lx = 0,
              ly = 0;
            let attach: any = "n";

            if (el.type === "text") {
              lx = num(el.x);
              ly = num(el.y);
              attach = "n";
            } else if (el.type === "arrow" || el.type === "line") {
              const dx = num(el.x2) - num(el.x1);
              const dy = num(el.y2) - num(el.y1);
              lx = (num(el.x1) + num(el.x2)) / 2;
              ly = (num(el.y1) + num(el.y2)) / 2;
              // Push label perpendicularly to the line
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              lx += (-dy / len) * 0.4;
              ly += (dx / len) * 0.4;
              attach = "n";
            } else if (el.type === "circle" || el.type === "ellipse") {
              lx = num(el.cx);
              ly = num(el.cy) + num(el.r, num(el.ry));
              attach = "n";
            } else if (el.type === "function" && el.fn) {
              // Stagger labels to avoid overlapping
              const prevFunctions = sortedElements
                .slice(0, i)
                .filter((e) => e.type === "function").length;
              lx =
                viewBox.x[0] +
                (viewBox.x[1] - viewBox.x[0]) * (0.2 + prevFunctions * 0.15);
              ly = evaluate(el.fn, lx) + 0.3;
              attach = "n";
            }

            const safeLx = Number.isFinite(lx) ? lx : 0;
            const safeLy = Number.isFinite(ly) ? ly : 0;

            if (labelText.includes("$") || labelText.includes("\\")) {
              const tex = labelText.replace(/\$/g, "");
              return (
                <LaTeX
                  key={key}
                  tex={tex}
                  at={[safeLx, safeLy]}
                  color={color}
                />
              );
            } else {
              return (
                <Text
                  key={key}
                  x={safeLx}
                  y={safeLy}
                  color={color}
                  size={size * 12}
                  attach={attach}
                >
                  {labelText}
                </Text>
              );
            }
          })}
        </Mafs>

        {/* Center / Reset View Control Button */}
        <button
          onClick={() => setResetKey((prev) => prev + 1)}
          className="absolute bottom-4 right-4 z-30 flex items-center gap-1.5 px-3 py-1.5 bg-white/95 hover:bg-white text-zinc-800 dark:bg-zinc-800/95 dark:hover:bg-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-md hover:shadow-lg text-xs font-bold font-mono transition-all hover:scale-105 active:scale-95 cursor-pointer"
          title="Center / Reset Canvas View"
        >
          <Focus size={14} className="text-blue-600 dark:text-blue-400" />
          <span>Center View</span>
        </button>
      </div>
    </div>
  );
};

export default Whiteboard;
