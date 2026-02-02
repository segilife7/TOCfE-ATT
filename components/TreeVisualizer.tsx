
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { TreeData } from '../types';

interface TreeVisualizerProps {
  data: TreeData;
  activeIoId?: string | null;
}

const TreeVisualizer: React.FC<TreeVisualizerProps> = ({ data, activeIoId }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 1200;
    const height = 1000;
    const nodeWidth = 240;
    const nodeHeight = 70;

    // 1. 노드 준비
    const nodes: any[] = [
      { id: 'target', text: data.target || "야심찬 목표", type: 'target' }
    ];

    data.ios.forEach((io) => {
      nodes.push({
        id: io.id,
        text: io.text,
        type: 'io'
      });
    });

    // 2. 링크 준비
    const links: any[] = [];
    const allPrereqIds = new Set(data.ios.flatMap(io => io.prerequisites));
    
    data.ios.forEach(io => {
      if (!allPrereqIds.has(io.id)) {
        links.push({ source: io.id, target: 'target' });
      }
      io.prerequisites.forEach(preId => {
        links.push({ source: preId, target: io.id });
      });
    });

    // 3. 계층 레벨 계산
    const levelMap: Record<string, number> = { 'target': 0 };
    const calculateLevels = () => {
      let changed = true;
      let iterations = 0;
      while (changed && iterations < 100) {
        changed = false;
        iterations++;
        links.forEach(link => {
          const s = typeof link.source === 'string' ? link.source : link.source.id;
          const t = typeof link.target === 'string' ? link.target : link.target.id;
          if (levelMap[t] !== undefined) {
            const newLevel = levelMap[t] + 1;
            if (levelMap[s] === undefined || levelMap[s] < newLevel) {
              levelMap[s] = newLevel;
              changed = true;
            }
          }
        });
      }
    };
    calculateLevels();

    // 4. Container & Zoom
    const g = svg.append("g").attr("class", "main-container");
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 2])
      .on("zoom", (event) => g.attr("transform", event.transform));

    svg.call(zoom);
    zoomRef.current = zoom;

    // 5. 시뮬레이션
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-2000))
      .force("x", d3.forceX(width / 2).strength(0.15))
      .force("y", d3.forceY((d: any) => {
        const level = levelMap[d.id] || 0;
        return 100 + (level * 160);
      }).strength(5))
      .force("collide", d3.forceCollide().radius(140));

    // 화살표 마커
    svg.append("defs").append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 45)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#94a3b8");

    // 직선 연결선
    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d: any) => {
        const s = typeof d.source === 'string' ? d.source : d.source.id;
        const t = typeof d.target === 'string' ? d.target : d.target.id;
        return (s === activeIoId || t === activeIoId) ? "#059669" : "#cbd5e1";
      })
      .attr("stroke-width", (d: any) => {
        const s = typeof d.source === 'string' ? d.source : d.source.id;
        const t = typeof d.target === 'string' ? d.target : d.target.id;
        return (s === activeIoId || t === activeIoId) ? 4 : 2;
      })
      .attr("marker-end", "url(#arrowhead)");

    // 노드 그룹
    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", "move")
      .call(d3.drag<any, any>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x; d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        }));

    // 노드 박스
    node.append("rect")
      .attr("width", nodeWidth)
      .attr("height", nodeHeight)
      .attr("x", -nodeWidth / 2)
      .attr("y", -nodeHeight / 2)
      .attr("rx", 12)
      .attr("fill", (d: any) => d.type === 'target' ? "#064e3b" : "#ffffff")
      .attr("stroke", (d: any) => {
        if (d.id === activeIoId) return "#059669";
        return d.type === 'target' ? "#059669" : "#e2e8f0";
      })
      .attr("stroke-width", (d: any) => d.id === activeIoId ? 4 : 2)
      .attr("filter", "drop-shadow(0 4px 6px rgba(0,0,0,0.05))");

    // 전체 문장 툴팁 (SVG title)
    node.append("title")
      .text((d: any) => d.text);

    // 노드 텍스트
    node.append("text")
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .attr("fill", (d: any) => d.type === 'target' ? "#ffffff" : "#334155")
      .style("font-size", "12px")
      .style("font-weight", "700")
      .style("pointer-events", "none")
      .each(function(d: any) {
        const text = d.text;
        const words = text.split(/\s+/).reverse();
        let word, line: string[] = [], lineNumber = 0, lineHeight = 1.2, y = 0, dy = 0;
        let tspan = d3.select(this).text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
        while (word = words.pop()) {
          line.push(word);
          tspan.text(line.join(" "));
          if (tspan.node()!.getComputedTextLength() > nodeWidth - 40) {
            line.pop();
            tspan.text(line.join(" "));
            line = [word];
            tspan = d3.select(this).append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
          }
        }
        const totalHeight = lineNumber * lineHeight;
        d3.select(this).attr("transform", `translate(0, ${-(totalHeight * 6)})`);
      });

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    setTimeout(() => {
      if (svgRef.current && zoomRef.current) {
        d3.select(svgRef.current).call(zoomRef.current.transform, d3.zoomIdentity.translate(width/2 - 450, 50).scale(0.75));
      }
    }, 100);

    return () => simulation.stop();
  }, [data, isFullscreen, activeIoId]);

  return (
    <div className={`relative bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-inner group ${isFullscreen ? 'fixed inset-0 z-[100] rounded-none' : 'h-full w-full'}`}>
      <svg ref={svgRef} viewBox="0 0 1200 1000" className="w-full h-full" />
      
      <div className="absolute top-6 left-6 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-2 bg-white/80 backdrop-blur px-3 py-1.5 rounded-lg border border-stone-100 shadow-sm text-[10px] font-bold text-stone-500">
          <i className="fa-solid fa-mouse-pointer mr-1"></i> Drag to move, Scroll to zoom, Hover to read
        </div>
      </div>

      <div className="absolute top-6 right-6 flex gap-2">
        <button 
          onClick={() => setIsFullscreen(!isFullscreen)} 
          className="w-10 h-10 bg-white/90 backdrop-blur border border-stone-200 rounded-xl shadow-lg flex items-center justify-center text-stone-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all active:scale-90"
        >
          <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'}`}></i>
        </button>
        <button 
          onClick={() => {
            if (svgRef.current && zoomRef.current) {
               d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity.translate(150, 50).scale(0.75));
            }
          }} 
          className="w-10 h-10 bg-white/90 backdrop-blur border border-stone-200 rounded-xl shadow-lg flex items-center justify-center text-stone-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all active:scale-90"
        >
          <i className="fa-solid fa-arrows-to-dot"></i>
        </button>
      </div>
    </div>
  );
};

export default TreeVisualizer;
