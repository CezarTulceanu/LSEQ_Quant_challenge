import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { AlertCircle } from 'lucide-react';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

const parsePath = (d: string) => {
  const commands: {cmd: string, args: number[]}[] = [];
  const regex = /([a-zA-Z])([^a-zA-Z]*)/g;
  let match;
  while ((match = regex.exec(d)) !== null) {
    const cmd = match[1];
    const argsStr = match[2];
    const args: number[] = [];
    const numRegex = /-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;
    let numMatch;
    while ((numMatch = numRegex.exec(argsStr)) !== null) {
      args.push(parseFloat(numMatch[0]));
    }
    commands.push({ cmd, args });
  }
  return commands;
};

const stringifyPath = (commands: {cmd: string, args: number[]}[]) => {
  return commands.map(c => `${c.cmd}${c.args.join(',')}`).join(' ');
};

const getTranslate = (element: Element) => {
  const transform = element.getAttribute('transform');
  if (transform) {
    const match = transform.match(/translate\(([^,\s]+)[,\s]*([^)]*)\)/);
    if (match) {
      const x = parseFloat(match[1]);
      const y = match[2] ? parseFloat(match[2]) : 0;
      if (!isNaN(x) && !isNaN(y)) {
        return { x, y };
      }
    }
  }
  return { x: 0, y: 0 };
};

interface MermaidProps {
  chart: string;
  onNodeClick?: (nodeText: string) => void;
}

export default function Mermaid({ chart, onNodeClick }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    const renderChart = async () => {
      if (!chart) {
        if (isMounted) setSvg('');
        return;
      }
      try {
        setError('');
        // Generate a unique ID for the mermaid render to avoid DOM conflicts
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);
        if (isMounted) {
          setSvg(svg);
        }
      } catch (err: any) {
        console.error('Mermaid rendering error:', err);
        if (isMounted) {
          setError(err.message || 'Failed to render diagram. The generated syntax might be invalid.');
        }
      }
    };

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [chart]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const svgElement = container.querySelector('svg');
    if (!svgElement) return;

    let isDragging = false;
    let draggedNode: SVGGElement | null = null;
    let startMouseX = 0;
    let startMouseY = 0;
    let initialTranslateX = 0;
    let initialTranslateY = 0;
    let hasMoved = false;
    let connectedPaths: any[] = [];

    const getMousePosition = (evt: MouseEvent) => {
      const CTM = svgElement.getScreenCTM();
      if (!CTM) return { x: evt.clientX, y: evt.clientY };
      return {
        x: (evt.clientX - CTM.e) / CTM.a,
        y: (evt.clientY - CTM.f) / CTM.d
      };
    };

    const startDrag = (evt: MouseEvent) => {
      const target = evt.target as HTMLElement;
      const node = target.closest('.node') as SVGGElement;
      
      if (node) {
        isDragging = true;
        hasMoved = false;
        draggedNode = node;
        
        const pos = getMousePosition(evt);
        startMouseX = pos.x;
        startMouseY = pos.y;

        const transform = node.getAttribute('transform');
        const match = transform ? transform.match(/translate\(([^,]+),\s*([^)]+)\)/) : null;
        if (match) {
          initialTranslateX = parseFloat(match[1]);
          initialTranslateY = parseFloat(match[2]);
        } else {
          initialTranslateX = 0;
          initialTranslateY = 0;
        }

        // Bring the dragged node to the front
        node.parentNode?.appendChild(node);
        node.style.cursor = 'grabbing';

        // Find connected paths
        connectedPaths = [];
        const allNodes = Array.from(svgElement.querySelectorAll('.node'));
        const nodeData = allNodes.map(n => {
          const center = getTranslate(n);
          let bbox = { width: 100, height: 50 };
          try {
            bbox = (n as SVGGraphicsElement).getBBox();
          } catch(e) {}
          return { node: n, center, bbox };
        });
        
        const edgePaths = Array.from(svgElement.querySelectorAll('.edgePaths path'));
        const edgeLabels = Array.from(svgElement.querySelectorAll('.edgeLabels .edgeLabel'));
        
        const labelData = edgeLabels.map(label => ({
          label,
          center: getTranslate(label),
          used: false
        }));
        
        edgePaths.forEach((path) => {
          const d = path.getAttribute('d');
          if (!d) return;
          const commands = parsePath(d);
          if (commands.length < 2) return;

          const first = commands[0];
          const last = commands[commands.length - 1];
          
          if (first.args.length < 2) return;
          const startX = first.args[0];
          const startY = first.args[1];
          
          let endX = 0, endY = 0;
          if (last.cmd.toUpperCase() === 'Z') {
            if (commands.length < 2) return;
            const prev = commands[commands.length - 2];
            if (prev.args.length < 2) return;
            endX = prev.args[prev.args.length - 2];
            endY = prev.args[prev.args.length - 1];
          } else {
            if (last.args.length < 2) return;
            endX = last.args[last.args.length - 2];
            endY = last.args[last.args.length - 1];
          }

          let closestStartNode = null;
          let minStartScore = Infinity;
          nodeData.forEach(nd => {
            const dx = startX - nd.center.x;
            const dy = startY - nd.center.y;
            const rx = Math.max(nd.bbox.width / 2, 10);
            const ry = Math.max(nd.bbox.height / 2, 10);
            const score = Math.sqrt(Math.pow(dx / rx, 2) + Math.pow(dy / ry, 2));
            if (score < minStartScore) {
              minStartScore = score;
              closestStartNode = nd.node;
            }
          });

          let closestEndNode = null;
          let minEndScore = Infinity;
          nodeData.forEach(nd => {
            const dx = endX - nd.center.x;
            const dy = endY - nd.center.y;
            const rx = Math.max(nd.bbox.width / 2, 10);
            const ry = Math.max(nd.bbox.height / 2, 10);
            const score = Math.sqrt(Math.pow(dx / rx, 2) + Math.pow(dy / ry, 2));
            if (score < minEndScore) {
              minEndScore = score;
              closestEndNode = nd.node;
            }
          });

          const isStart = closestStartNode === node;
          const isEnd = closestEndNode === node;

          if (isStart || isEnd) {
            let matchedLabel = null;
            let labelOffset = { x: 0, y: 0 };
            
            try {
              const pathLength = (path as SVGPathElement).getTotalLength();
              const midPoint = (path as SVGPathElement).getPointAtLength(pathLength / 2);
              
              let minLabelDist = Infinity;
              let bestLd: any = null;
              
              labelData.forEach(ld => {
                if (ld.used) return;
                const dist = Math.hypot(ld.center.x - midPoint.x, ld.center.y - midPoint.y);
                if (dist < minLabelDist) {
                  minLabelDist = dist;
                  bestLd = ld;
                }
              });

              if (bestLd && minLabelDist < 150) {
                bestLd.used = true;
                matchedLabel = bestLd.label;
                labelOffset = {
                  x: bestLd.center.x - midPoint.x,
                  y: bestLd.center.y - midPoint.y
                };
              }
            } catch (e) {
              // Ignore if getPointAtLength fails
            }

            connectedPaths.push({
              element: path as SVGPathElement,
              isStart,
              isEnd,
              originalCommands: commands,
              labelElement: matchedLabel,
              labelOffset
            });
          }
        });
      }
    };

    const drag = (evt: MouseEvent) => {
      if (isDragging && draggedNode) {
        evt.preventDefault();
        const pos = getMousePosition(evt);
        const dx = pos.x - startMouseX;
        const dy = pos.y - startMouseY;
        
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          hasMoved = true;
        }

        draggedNode.setAttribute(
          'transform', 
          `translate(${initialTranslateX + dx}, ${initialTranslateY + dy})`
        );

        connectedPaths.forEach(cp => {
          const cmds = cp.originalCommands.map((c: any) => ({ cmd: c.cmd, args: [...c.args] }));
          
          if (cp.isStart) {
            cmds[0].args[0] += dx;
            cmds[0].args[1] += dy;
            if (cmds.length > 1) {
              if (cmds[1].cmd.toUpperCase() === 'C' && cmds[1].args.length >= 2) {
                cmds[1].args[0] += dx;
                cmds[1].args[1] += dy;
              } else if (cmds[1].cmd.toUpperCase() === 'Q' && cmds[1].args.length >= 2) {
                cmds[1].args[0] += dx;
                cmds[1].args[1] += dy;
              }
            }
          }
          
          if (cp.isEnd) {
            const last = cmds[cmds.length - 1];
            const len = last.args.length;
            if (len >= 2) {
              last.args[len - 2] += dx;
              last.args[len - 1] += dy;
            }
            if (last.cmd.toUpperCase() === 'C' && len >= 6) {
              last.args[len - 4] += dx;
              last.args[len - 3] += dy;
            } else if (last.cmd.toUpperCase() === 'Q' && len >= 4) {
              last.args[len - 4] += dx;
              last.args[len - 3] += dy;
            }
          }
          
          cp.element.setAttribute('d', stringifyPath(cmds));
          
          if (cp.labelElement) {
            try {
              const pathLength = cp.element.getTotalLength();
              const midPoint = cp.element.getPointAtLength(pathLength / 2);
              cp.labelElement.setAttribute(
                'transform', 
                `translate(${midPoint.x + cp.labelOffset.x}, ${midPoint.y + cp.labelOffset.y})`
              );
            } catch (e) {
              // Fallback if getPointAtLength fails
            }
          }
        });
      }
    };

    const endDrag = () => {
      if (draggedNode) {
        draggedNode.style.cursor = 'grab';
      }
      setTimeout(() => {
        isDragging = false;
        draggedNode = null;
        connectedPaths = [];
      }, 0);
    };

    const handleNodeClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const node = target.closest('.node');
      if (node) {
        if (hasMoved) {
          e.stopPropagation();
          e.preventDefault();
          hasMoved = false;
          return;
        }
        if (onNodeClick) {
          const labelNode = node.querySelector('.nodeLabel') || node;
          const text = labelNode.textContent?.trim();
          if (text) {
            onNodeClick(text);
          }
        }
      }
    };

    svgElement.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', drag);
    window.addEventListener('mouseup', endDrag);
    svgElement.addEventListener('click', handleNodeClick, true);

    const nodes = svgElement.querySelectorAll('.node');
    nodes.forEach(n => {
      const el = n as HTMLElement;
      el.style.cursor = 'grab';
      el.style.transition = 'opacity 0.2s';
      el.addEventListener('mouseenter', () => { if (!isDragging) el.style.opacity = '0.8'; });
      el.addEventListener('mouseleave', () => { el.style.opacity = '1'; });
    });

    return () => {
      svgElement.removeEventListener('mousedown', startDrag);
      window.removeEventListener('mousemove', drag);
      window.removeEventListener('mouseup', endDrag);
      svgElement.removeEventListener('click', handleNodeClick, true);
    };
  }, [svg, onNodeClick]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-red-50 text-red-600 rounded-lg border border-red-200 max-w-full">
        <AlertCircle className="w-8 h-8 mb-2" />
        <h3 className="font-semibold mb-1">Invalid Diagram Syntax</h3>
        <pre className="text-xs overflow-auto max-w-full whitespace-pre-wrap p-2 bg-red-100 rounded">
          {error}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="mermaid flex items-center justify-center w-full h-full p-4 overflow-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
