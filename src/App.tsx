import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Sparkles, Code, LayoutTemplate, Download, Loader2, Key } from 'lucide-react';
import Mermaid from './components/Mermaid';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [description, setDescription] = useState('');
  const [complexity, setComplexity] = useState(4);
  const [mermaidCode, setMermaidCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');

  const getSystemInstruction = (level: number) => {
    const baseInstruction = `You are an expert at creating Mermaid.js diagrams. Convert the user's description into valid Mermaid.js syntax. Return ONLY the raw Mermaid code. Do not use markdown backticks (\`\`\`mermaid) or any explanatory text.

### Visual & Structural Style Guide (CRITICAL):
1. **Diagram Type**: Default to \`flowchart TD\` for system architectures and pipelines unless another type is explicitly required.
2. **Node Shapes**: Use semantic shapes: \`([Oval])\` for users/endpoints/states, \`[(Cylinder)]\` for databases/history, and \`[Rectangle]\` or \`{{Hexagon}}\` for processes/tools.
3. **Edge Labels**: Always label your edges clearly describing the action (e.g., \`A -->|sends-query| B\`).
4. **Line Types**: Use solid lines (\`-->\`) for primary control flow and dashed lines (\`-.->\` or \`-. fetch-history .->\`) for secondary flows, data fetching, or rejections.
5. **Custom Styling & Colors**: You MUST strictly follow any color requests in the prompt using Mermaid's \`style\` directive (e.g., \`style NodeID fill:#ff4444,stroke:#cc0000,color:#fff\`). If no colors are requested, apply a clean, professional color scheme (e.g., blue for orchestrators, green for classifiers, orange for guardrails, gray for blocked states).`;
    
    switch (level) {
      case 1:
        return `${baseInstruction}
        
### Complexity Level 1 (Basic):
1. **Node Limit**: Use a maximum of 2 to 4 nodes. Focus only on the absolute core concept.
2. **Simplicity**: Do not add any extra components or infrastructure details. Keep the flow linear.`;
      case 2:
        return `${baseInstruction}
        
### Complexity Level 2 (Intermediate):
1. **Scope**: Include the main components and their basic relationships exactly as described by the user.
2. **Simplicity**: Do not overcomplicate or add unnecessary infrastructure unless explicitly requested.`;
      case 3:
        return `${baseInstruction}
        
### Complexity Level 3 (Advanced):
1. **Scope**: Create a detailed architectural diagram. Include standard infrastructure components like databases, APIs, and clear logical boundaries.
2. **Styling**: Use subgraphs to group related components logically.
3. **Professional Routing**: You MUST start the diagram with \`%%{init: {"flowchart": {"curve": "linear"}}}%%\` to ensure straight, professional lines instead of wobbly curves.`;
      case 4:
      default:
        return `${baseInstruction}

### Complexity Level 4 (Enterprise/Senior Architect):
1. **The "Senior Architect" Protocol**: If the user provides a simplified description, automatically expand it into a professional, resilient system designed for scale, security, and high availability.
2. **Mandatory Components**: Automatically include Load Balancers, WAFs, API Gateways, and CDNs where appropriate.
3. **Data Layer**: Include Primary/Replica splits and Redis/Memcached layers for performance.
4. **Security & Auth**: Explicitly map Identity Providers (OIDC/SAML) and Secrets Management.
5. **Messaging**: Incorporate Message Brokers (Kafka/RabbitMQ) for asynchronous decoupling.
6. **Observability**: Include dedicated nodes for Logging and Monitoring.
7. **Vague Input Handling**: Assume the user is building a modern, cloud-native microservices environment. Fill in any missing "best practice" components.
8. **Professional Routing**: You MUST start the diagram with \`%%{init: {"flowchart": {"curve": "linear"}}}%%\` to ensure straight, professional lines instead of wobbly curves.`;
    }
  };

  const handleSetApiKey = async () => {
    try {
      await window.aistudio.openSelectKey();
    } catch (err) {
      console.error('Error opening API key dialog:', err);
    }
  };

  const handleGenerate = async () => {
    if (!description.trim()) return;
    
    setIsGenerating(true);
    setError('');
    
    try {
      // Check if the user has selected a custom API key
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await window.aistudio.openSelectKey();
      }

      // Create a new instance right before making an API call to ensure it uses the latest key
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: description,
        config: {
          systemInstruction: getSystemInstruction(complexity),
          temperature: 0.1,
        }
      });
      
      let text = response.text || '';
      // Clean up markdown if the model ignores instructions
      text = text.replace(/^```mermaid\n?/m, '').replace(/^```\n?/m, '').replace(/```$/m, '').trim();
      
      setMermaidCode(text);
    } catch (err: any) {
      console.error('Generation error:', err);
      if (err.message && err.message.includes("Requested entity was not found.")) {
        setError("API Key not found or invalid. Please select your API key again.");
        await window.aistudio.openSelectKey();
      } else {
        setError(err.message || 'Failed to generate diagram.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!mermaidCode) return;
    
    // Find the SVG element rendered by Mermaid
    const svgElement = document.querySelector('.mermaid svg');
    if (!svgElement) return;
    
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'diagram.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <LayoutTemplate className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">OmniDiagram</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleSetApiKey}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-100 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <Key className="w-4 h-4" />
            Set Custom API Key
          </button>
          <div className="text-sm text-slate-500 font-medium hidden sm:block">
            Powered by Gemini
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Panel: Input */}
        <div className="w-full lg:w-[400px] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col h-full z-10 shadow-sm">
          <div className="p-6 flex-1 flex flex-col gap-4 overflow-y-auto">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-2">Describe your diagram</h2>
              <p className="text-sm text-slate-500 mb-4">
                Explain what you want to visualize. OmniDiagram supports flowcharts, sequence diagrams, mindmaps, Gantt charts, and more.
              </p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., A flowchart showing the user login process: Start -> Enter Credentials -> Validate -> If valid, go to Dashboard, else show Error -> End."
                className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-inner text-sm"
              />
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-900">Complexity Level</h3>
                <span className="text-xs font-medium px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md">
                  {complexity === 1 && 'Basic (2-4 nodes)'}
                  {complexity === 2 && 'Intermediate'}
                  {complexity === 3 && 'Advanced'}
                  {complexity === 4 && 'Enterprise (Senior Dev)'}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="4"
                step="1"
                value={complexity}
                onChange={(e) => setComplexity(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-2 font-medium">
                <span>Basic</span>
                <span>Complex</span>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !description.trim()}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Diagram
                </>
              )}
            </button>

            {error && (
              <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
                {error}
              </div>
            )}

            {mermaidCode && (
              <div className="mt-6 border-t border-slate-100 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">Mermaid Code</h3>
                  <button
                    onClick={() => setShowCode(!showCode)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-md transition-colors"
                  >
                    <Code className="w-3 h-3" />
                    {showCode ? 'Hide' : 'Show'}
                  </button>
                </div>
                
                {showCode && (
                  <textarea
                    value={mermaidCode}
                    onChange={(e) => setMermaidCode(e.target.value)}
                    className="w-full h-64 p-4 bg-slate-900 text-slate-50 font-mono text-xs rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                    spellCheck={false}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Output */}
        <div className="flex-1 bg-slate-50/50 relative overflow-hidden flex flex-col">
          {/* Toolbar */}
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            {mermaidCode && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export SVG
              </button>
            )}
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-auto relative flex items-center justify-center p-8">
            {!mermaidCode && !isGenerating ? (
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 bg-white shadow-sm border border-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                  <LayoutTemplate className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No diagram yet</h3>
                <p className="text-sm text-slate-500">
                  Describe what you want to visualize in the left panel and click generate to see the magic happen.
                </p>
              </div>
            ) : isGenerating ? (
              <div className="flex flex-col items-center justify-center text-slate-400 animate-pulse">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
                <p className="text-sm font-medium">Synthesizing diagram...</p>
              </div>
            ) : (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 min-w-full min-h-full flex items-center justify-center overflow-auto">
                <Mermaid chart={mermaidCode} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
