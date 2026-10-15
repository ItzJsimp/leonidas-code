import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Play,
  Pause,
  Search,
  Maximize2,
  Sparkles,
  Layers,
} from "lucide-react";
import {
  type GraphData3D,
  type GraphNode3D,
  type Camera3D,
  step3DPhysics,
  project3DTo2D,
} from "./LeonidasVault.logic.ts";

export interface LeonidasKnowledgeGraph3DProps {
  readonly graphData: GraphData3D;
  readonly selectedNodeId?: string | null;
  readonly onSelectNode?: (nodeId: string) => void;
  readonly className?: string;
}

export function LeonidasKnowledgeGraph3D({
  graphData,
  selectedNodeId,
  onSelectNode,
  className = "",
}: LeonidasKnowledgeGraph3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Camera state for 3D orbital navigation
  const cameraRef = useRef<Camera3D>({
    theta: 0.4,
    phi: 0.3,
    radius: 450,
    targetX: 0,
    targetY: 0,
    targetZ: 0,
    fov: 650,
  });

  // Local mutable copy of nodes for 60fps simulation
  const nodesRef = useRef<GraphNode3D[]>([]);
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const hoveredNodeIdRef = useRef<string | null>(null);
  const pulsePhaseRef = useRef(0);

  // UI state
  const [isSimulating, setIsSimulating] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTags, setShowTags] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<GraphNode3D | null>(null);

  // Sync incoming nodes from graphData
  useEffect(() => {
    // Preserve existing positions if nodes match
    const existingMap = new Map(nodesRef.current.map((n) => [n.id, n]));
    nodesRef.current = graphData.nodes.map((node) => {
      const existing = existingMap.get(node.id);
      if (existing) {
        return {
          ...node,
          x: existing.x,
          y: existing.y,
          z: existing.z,
          vx: existing.vx,
          vy: existing.vy,
          vz: existing.vz,
        };
      }
      return { ...node };
    });
  }, [graphData]);

  // Neighbors of active or hovered node for dimming non-connected nodes
  const activeNodeId = hoveredNode?.id ?? selectedNodeId;
  const connectedNodeIds = useMemo(() => {
    if (!activeNodeId) return null;
    const ids = new Set<string>([activeNodeId]);
    for (const link of graphData.links) {
      if (link.source === activeNodeId) ids.add(link.target);
      if (link.target === activeNodeId) ids.add(link.source);
    }
    return ids;
  }, [activeNodeId, graphData.links]);

  // Render & physics loop, capped at about 30fps: a full-canvas repaint every vsync is wasted on
  // a graph that orbits slowly, and the cap holds on 120Hz+ displays too.
  useEffect(() => {
    let animId: number;
    let lastFrame = 0;

    const render = (now: number) => {
      if (now - lastFrame < 30) {
        animId = requestAnimationFrame(render);
        return;
      }
      lastFrame = now;
      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(render);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        animId = requestAnimationFrame(render);
        return;
      }

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const camera = cameraRef.current;

      // Auto-orbit rotation
      if (autoRotate && !isDraggingRef.current && !isPanningRef.current) {
        camera.theta += 0.003;
      }

      // Step physics
      if (isSimulating) {
        step3DPhysics(nodesRef.current, graphData.links);
      }

      pulsePhaseRef.current = (pulsePhaseRef.current + 0.04) % (Math.PI * 2);

      // Clear with dark cyberpunk background
      ctx.fillStyle = "#07090e";
      ctx.fillRect(0, 0, width, height);

      // Subtle cybernetic radial glow
      const centerGlow = ctx.createRadialGradient(
        width / 2,
        height / 2,
        10,
        width / 2,
        height / 2,
        Math.max(width, height) / 1.5,
      );
      centerGlow.addColorStop(0, "rgba(14, 23, 42, 0.45)");
      centerGlow.addColorStop(0.6, "rgba(8, 12, 22, 0.8)");
      centerGlow.addColorStop(1, "#07090e");
      ctx.fillStyle = centerGlow;
      ctx.fillRect(0, 0, width, height);

      // Filter nodes based on search and tag toggles
      const query = searchQuery.trim().toLowerCase();
      const visibleNodes = nodesRef.current.filter((node) => {
        if (!showTags && node.kind === "tag") return false;
        if (!query) return true;
        return (
          node.label.toLowerCase().includes(query) ||
          node.tags.some((t) => t.toLowerCase().includes(query))
        );
      });

      const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));

      // 1. Project all nodes and sort by depth for correct 3D occlusions
      interface ProjectedNode {
        node: GraphNode3D;
        screenX: number;
        screenY: number;
        depth: number;
        scale: number;
        visible: boolean;
      }

      const projectedMap = new Map<string, ProjectedNode>();
      const projectedList: ProjectedNode[] = [];

      for (const node of visibleNodes) {
        const proj = project3DTo2D(node, camera, { width, height });
        const item: ProjectedNode = {
          node,
          screenX: proj.screenX,
          screenY: proj.screenY,
          depth: proj.depth,
          scale: proj.scale,
          visible: proj.visible,
        };
        projectedMap.set(node.id, item);
        if (proj.visible) {
          projectedList.push(item);
        }
      }

      // Sort back-to-front (highest depth first)
      projectedList.sort((a, b) => b.depth - a.depth);

      // 2. Render Links with futuristic neon lasers
      for (const link of graphData.links) {
        if (!visibleNodeIds.has(link.source) || !visibleNodeIds.has(link.target)) {
          continue;
        }

        const pSource = projectedMap.get(link.source);
        const pTarget = projectedMap.get(link.target);
        if (!pSource || !pTarget || (!pSource.visible && !pTarget.visible)) {
          continue;
        }

        const isHighlighted =
          activeNodeId && (link.source === activeNodeId || link.target === activeNodeId);
        const isDimmed = activeNodeId && !isHighlighted;

        const avgDepth = (pSource.depth + pTarget.depth) / 2;
        const depthAlpha = Math.max(0.1, Math.min(0.9, 500 / avgDepth));

        ctx.beginPath();
        ctx.moveTo(pSource.screenX, pSource.screenY);
        ctx.lineTo(pTarget.screenX, pTarget.screenY);

        if (isHighlighted) {
          // Intense glowing laser beam
          ctx.strokeStyle = "rgba(255, 215, 0, 0.9)";
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Laser traveling pulse particle
          const pulseT = (Math.sin(pulsePhaseRef.current * 2) + 1) / 2;
          const px = pSource.screenX + (pTarget.screenX - pSource.screenX) * pulseT;
          const py = pSource.screenY + (pTarget.screenY - pSource.screenY) * pulseT;

          ctx.beginPath();
          ctx.arc(px, py, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = "#ffd700";
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        } else if (link.kind === "tag") {
          ctx.strokeStyle = isDimmed
            ? "rgba(192, 132, 252, 0.08)"
            : `rgba(192, 132, 252, ${0.25 * depthAlpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          ctx.strokeStyle = isDimmed
            ? "rgba(0, 240, 255, 0.06)"
            : `rgba(0, 240, 255, ${0.3 * depthAlpha})`;
          ctx.lineWidth = Math.max(0.8, 1.2 * pSource.scale);
          ctx.stroke();
        }
      }

      // 3. Render Nodes with Neon Halos
      for (const item of projectedList) {
        const { node, screenX, screenY, scale } = item;
        const isSelected = selectedNodeId === node.id;
        const isHovered = hoveredNodeIdRef.current === node.id;
        const isConnected = !connectedNodeIds || connectedNodeIds.has(node.id);
        const opacity = isConnected ? 1.0 : 0.2;

        const renderedRadius = Math.max(
          3,
          node.radius * scale * (isHovered || isSelected ? 1.35 : 1.0),
        );

        // Outer Neon Glow
        const glowRadius = renderedRadius * 2.8;
        const glowGrad = ctx.createRadialGradient(
          screenX,
          screenY,
          renderedRadius * 0.5,
          screenX,
          screenY,
          glowRadius,
        );
        glowGrad.addColorStop(0, node.glowColor.replace("0.45", (0.55 * opacity).toString()));
        glowGrad.addColorStop(1, "rgba(0,0,0,0)");

        ctx.beginPath();
        ctx.arc(screenX, screenY, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = glowGrad;
        ctx.fill();

        // Node Core Circle
        ctx.beginPath();
        ctx.arc(screenX, screenY, renderedRadius, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? "#ffffff" : isHovered ? "#ffe066" : node.color;
        ctx.globalAlpha = opacity;
        ctx.fill();

        // Crisp Border
        ctx.strokeStyle = isSelected || isHovered ? "#ffffff" : "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = isSelected ? 2.5 : 1.2;
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Node Label
        const shouldShowLabel =
          isHovered ||
          isSelected ||
          node.kind === "hub" ||
          (scale > 0.8 && isConnected && node.linkCount > 1);

        if (shouldShowLabel && opacity > 0.3) {
          ctx.font =
            isHovered || isSelected ? "bold 12px Inter, sans-serif" : "10px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";

          // Text shadow
          ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
          ctx.fillText(node.label, screenX + 1, screenY + renderedRadius + 5);

          ctx.fillStyle = isHovered || isSelected ? "#ffffff" : "rgba(226, 232, 240, 0.9)";
          ctx.fillText(node.label, screenX, screenY + renderedRadius + 4);
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    graphData,
    isSimulating,
    autoRotate,
    searchQuery,
    showTags,
    selectedNodeId,
    connectedNodeIds,
    activeNodeId,
  ]);

  // Mouse Interaction: Orbit, Pan, Hover, Click
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    if (e.button === 0 && !e.shiftKey) {
      isDraggingRef.current = true;
    } else {
      isPanningRef.current = true;
    }
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };

      const camera = cameraRef.current;

      if (isDraggingRef.current) {
        camera.theta -= dx * 0.007;
        camera.phi = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, camera.phi + dy * 0.007));
      } else if (isPanningRef.current) {
        camera.targetX -= dx * 0.5;
        camera.targetY += dy * 0.5;
      } else {
        // Hit testing for hover
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        let foundNode: GraphNode3D | null = null;
        let minDistance = 20;

        for (const node of nodesRef.current) {
          if (!showTags && node.kind === "tag") continue;
          const proj = project3DTo2D(node, camera, { width: canvas.width, height: canvas.height });
          if (!proj.visible) continue;

          const dist = Math.hypot(proj.screenX - mouseX, proj.screenY - mouseY);
          const hitRadius = Math.max(12, node.radius * proj.scale + 6);
          if (dist <= hitRadius && dist < minDistance) {
            minDistance = dist;
            foundNode = node;
          }
        }

        hoveredNodeIdRef.current = foundNode?.id ?? null;
        setHoveredNode(foundNode);
      }
    },
    [showTags],
  );

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isPanningRef.current = false;
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !onSelectNode) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const camera = cameraRef.current;

    for (const node of nodesRef.current) {
      if (!showTags && node.kind === "tag") continue;
      const proj = project3DTo2D(node, camera, { width: canvas.width, height: canvas.height });
      if (!proj.visible) continue;

      const dist = Math.hypot(proj.screenX - mouseX, proj.screenY - mouseY);
      const hitRadius = Math.max(14, node.radius * proj.scale + 8);
      if (dist <= hitRadius) {
        onSelectNode(node.id);
        break;
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const camera = cameraRef.current;
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    camera.radius = Math.max(150, Math.min(1400, camera.radius * zoomFactor));
  };

  const resetCamera = () => {
    cameraRef.current = {
      theta: 0.4,
      phi: 0.3,
      radius: 450,
      targetX: 0,
      targetY: 0,
      targetZ: 0,
      fov: 650,
    };
  };

  const zoomIn = () => {
    cameraRef.current.radius = Math.max(150, cameraRef.current.radius * 0.85);
  };

  const zoomOut = () => {
    cameraRef.current.radius = Math.min(1400, cameraRef.current.radius * 1.15);
  };

  return (
    <div
      className={`relative flex flex-col w-full h-full bg-[#07090e] select-none overflow-hidden ${className}`}
    >
      {/* Top Floating Control Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none gap-2">
        {/* Search Input */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0d121f]/90 border border-cyan-500/30 text-xs shadow-lg backdrop-blur-md pointer-events-auto">
          <Search className="w-3.5 h-3.5 text-cyan-400" />
          <input
            type="text"
            placeholder="Search the note map…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48 bg-transparent text-gray-200 placeholder-gray-500 focus:outline-none"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#0d121f]/90 border border-slate-700/60 shadow-lg backdrop-blur-md pointer-events-auto">
          <button
            type="button"
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1.5 rounded hover:bg-slate-700/60 transition ${
              autoRotate ? "text-cyan-400 bg-cyan-950/40" : "text-gray-400"
            }`}
            title={autoRotate ? "Stop turning the map" : "Turn the map by itself"}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsSimulating(!isSimulating)}
            className={`p-1.5 rounded hover:bg-slate-700/60 transition ${
              isSimulating ? "text-emerald-400" : "text-gray-400"
            }`}
            title={isSimulating ? "Hold the notes still" : "Let the notes move"}
          >
            {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setShowTags(!showTags)}
            className={`p-1.5 rounded hover:bg-slate-700/60 transition ${
              showTags ? "text-purple-400 bg-purple-950/40" : "text-gray-400"
            }`}
            title="Show or hide tags"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-4 bg-slate-700/80 mx-1" />

          <button
            type="button"
            onClick={zoomIn}
            className="p-1.5 text-gray-400 hover:text-gray-200 rounded hover:bg-slate-700/60 transition"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={zoomOut}
            className="p-1.5 text-gray-400 hover:text-gray-200 rounded hover:bg-slate-700/60 transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={resetCamera}
            className="p-1.5 text-gray-400 hover:text-gray-200 rounded hover:bg-slate-700/60 transition"
            title="Reset the view"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3D Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Hover Info Tooltip */}
      {hoveredNode && (
        <div className="absolute bottom-4 left-4 z-10 p-3 rounded-lg bg-[#0d121f]/95 border border-cyan-500/40 shadow-xl backdrop-blur-md max-w-xs text-xs pointer-events-none animate-fadeIn">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: hoveredNode.color,
                boxShadow: `0 0 8px ${hoveredNode.color}`,
              }}
            />
            <span className="font-semibold text-gray-100">{hoveredNode.label}</span>
            <span className="ml-auto text-[10px] text-cyan-400 font-mono">
              {hoveredNode.kind.toUpperCase()}
            </span>
          </div>

          <div className="mt-2 text-slate-400 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span>Links:</span>
              <span className="text-gray-200 font-mono font-medium">{hoveredNode.linkCount}</span>
            </div>
            {hoveredNode.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {hoveredNode.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-purple-950/60 text-purple-300 border border-purple-800/40"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Futuristic Graph Stats Badge */}
      <div className="absolute bottom-4 right-4 z-10 px-2.5 py-1 rounded bg-[#0d121f]/80 border border-slate-800/80 text-[10px] text-slate-400 font-mono shadow pointer-events-none backdrop-blur-sm">
        {graphData.nodes.length} notes and tags · {graphData.links.length} links
      </div>
    </div>
  );
}
