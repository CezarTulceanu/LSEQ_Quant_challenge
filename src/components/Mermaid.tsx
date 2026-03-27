import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { AlertCircle } from 'lucide-react';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

interface MermaidProps {
  chart: string;
}

export default function Mermaid({ chart }: MermaidProps) {
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
