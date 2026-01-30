
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Upload, History, FileText, Trash2, Play, BookOpen, Plus, Sparkles,
  Home, Maximize, Minimize, Star, RotateCcw, HelpCircle, CheckCircle2,
  ChevronRight, ChevronDown 
} from 'lucide-react';

// --- TYPES & ENUMS ---

enum DifficultyLevel {
  BASIC = 1,
  INTERMEDIATE = 2,
  MASTER = 3
}

type ViewState = 'dashboard' | 'study';

interface TreeNode {
  id: string;
  text: string;
  children: TreeNode[];
  isLeaf: boolean;
  level: number;
}

interface NodeState {
  isSolved: boolean;
  isStarred: boolean;
  isCollapsed: boolean;
  hintCount: number;
}

interface Session {
  id: string;
  fileName: string;
  data: TreeNode;
  difficulty: DifficultyLevel;
  nodeStates: Record<string, NodeState>;
  lastUpdated: number;
  progress: number;
}

// --- UTILITIES ---

const STORAGE_KEY = 'promindmap_v1_single';

const generateId = () => Math.random().toString(36).substring(2, 11);

const parseMarkdownToTree = (text: string): TreeNode => {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  if (lines.length === 0) {
    return { id: 'root', text: 'Empty Tree', children: [], isLeaf: true, level: 0 };
  }

  const getIndent = (line: string): number => {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  };

  const cleanText = (line: string): string => {
    return line.trim()
      .replace(/^[-*+]\s*/, '') 
      .replace(/^#+\s*/, '')    
      .trim();
  };

  const stack: { node: TreeNode; indent: number }[] = [];
  let root: TreeNode | null = null;

  lines.forEach((line) => {
    const indent = getIndent(line);
    const textContent = cleanText(line);
    
    const node: TreeNode = {
      id: generateId(),
      text: textContent,
      children: [],
      isLeaf: true,
      level: 0
    };

    if (!root) {
      root = node;
      stack.push({ node, indent });
      return;
    }

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    if (stack.length > 0) {
      const parentEntry = stack[stack.length - 1];
      parentEntry.node.children.push(node);
      parentEntry.node.isLeaf = false;
      node.level = stack.length;
      stack.push({ node, indent });
    } else {
      root.children.push(node);
      root.isLeaf = false;
      node.level = 1;
      stack.push({ node, indent });
    }
  });

  return root || { id: 'root', text: 'Parsing Error', children: [], isLeaf: true, level: 0 };
};

// --- COMPONENTS ---

const MindMapNode: React.FC<{
  node: TreeNode;
  session: Session;
  difficulty: DifficultyLevel;
  onUpdateNode: (nodeId: string, state: Partial<NodeState>) => void;
  starredOnly: boolean;
  isRoot?: boolean;
}> = ({ node, session, difficulty, onUpdateNode, starredOnly, isRoot = false }) => {
  const nodeState = session.nodeStates[node.id] || { isSolved: false, isStarred: false, isCollapsed: false, hintCount: 0 };
  const [inputValue, setInputValue] = useState('');
  const [isError, setIsError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const shouldMask = (n: TreeNode) => {
    if (n.level === 0) return false;
    if (difficulty === DifficultyLevel.BASIC) return n.isLeaf;
    if (difficulty === DifficultyLevel.INTERMEDIATE) return n.isLeaf || n.children.some(c => c.isLeaf);
    if (difficulty === DifficultyLevel.MASTER) return n.level > 0;
    return false;
  };

  const isMasked = shouldMask(node) && !nodeState.isSolved;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsError(false);
  };

  const checkAnswer = () => {
    const cleanInput = inputValue.replace(/\s+/g, '').toLowerCase();
    const cleanAnswer = node.text.replace(/\s+/g, '').toLowerCase();
    
    if (cleanInput === cleanAnswer) {
      onUpdateNode(node.id, { isSolved: true });
      setIsError(false);
    } else {
      setIsError(true);
      setTimeout(() => setIsError(false), 500);
    }
  };

  const provideHint = () => {
    const nextCount = (nodeState.hintCount || 0) + 1;
    onUpdateNode(node.id, { hintCount: nextCount });
    
    if (nextCount === 1) setInputValue(node.text.charAt(0));
    else if (nextCount === 2) setInputValue(node.text.substring(0, Math.min(3, node.text.length)));
    else setInputValue(node.text);
    inputRef.current?.focus();
  };

  const hasStarredDescendant = (n: TreeNode): boolean => {
    if (session.nodeStates[n.id]?.isStarred) return true;
    return n.children.some(c => hasStarredDescendant(c));
  };

  if (starredOnly && !hasStarredDescendant(node)) return null;

  return (
    <div className={`flex flex-col mb-4 ${isRoot ? '' : 'ml-10'}`}>
      <div className="flex items-center group relative">
        {!isRoot && <div className="absolute -left-10 top-1/2 -translate-y-1/2 w-10 h-0.5 bg-slate-200"></div>}

        <div className={`flex items-center gap-3 p-1.5 rounded-2xl transition-all duration-500 ${isMasked ? 'bg-slate-200/50 pr-3 shadow-inner' : 'bg-transparent'}`}>
          {node.children.length > 0 && (
            <button 
              onClick={() => onUpdateNode(node.id, { isCollapsed: !nodeState.isCollapsed })}
              className={`p-2 rounded-xl transition-all ${nodeState.isCollapsed ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
            >
              {nodeState.isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}

          {isMasked ? (
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={(e) => e.key === 'Enter' && checkAnswer()}
                placeholder="Type to recall..."
                className={`h-11 px-5 py-2 border-2 rounded-xl outline-none transition-all font-bold w-48 sm:w-64 text-sm ${isError ? 'border-red-400 bg-red-50 text-red-900 shake' : 'border-white focus:border-indigo-400 bg-white shadow-sm focus:shadow-indigo-100'}`}
              />
              <button 
                onClick={provideHint}
                className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 rounded-xl transition-all shadow-sm active:scale-95"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl transition-all duration-500 ${nodeState.isSolved ? 'bg-green-50 text-green-700 ring-2 ring-green-100' : 'text-slate-700'} ${node.level === 0 ? 'text-2xl font-black text-indigo-900' : 'text-base font-bold'}`}>
              {nodeState.isSolved && <CheckCircle2 className="w-4 h-4 text-green-500" />}
              <span className="whitespace-nowrap">{node.text}</span>
            </div>
          )}

          <button 
            onClick={() => onUpdateNode(node.id, { isStarred: !nodeState.isStarred })}
            className={`p-2 rounded-xl transition-all ${nodeState.isStarred ? 'opacity-100 text-amber-500 scale-110' : 'opacity-0 group-hover:opacity-100 text-slate-300 hover:text-amber-400'}`}
          >
            <Star className={`w-5 h-5 ${nodeState.isStarred ? 'fill-amber-500' : ''}`} />
          </button>
        </div>
      </div>

      {!nodeState.isCollapsed && node.children.length > 0 && (
        <div className="relative border-l-2 border-slate-200 mt-2">
          {node.children.map((child) => (
            <MindMapNode key={child.id} node={child} session={session} difficulty={difficulty} onUpdateNode={onUpdateNode} starredOnly={starredOnly} />
          ))}
        </div>
      )}
    </div>
  );
};

// --- MAIN APP ---

export default function App() {
  const [view, setView] = useState<ViewState>('dashboard');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [isStarredOnly, setIsStarredOnly] = useState(false);
  const [globalExpand, setGlobalExpand] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setSessions(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, []);

  const saveSessions = (updated: Session[]) => {
    setSessions(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const calculateRequiredNodes = useCallback((node: TreeNode, level: DifficultyLevel): number => {
    let count = 0;
    const shouldMaskNode = (n: TreeNode) => {
      if (n.level === 0) return false;
      if (level === DifficultyLevel.BASIC) return n.isLeaf;
      if (level === DifficultyLevel.INTERMEDIATE) return n.isLeaf || n.children.some(c => c.isLeaf);
      return n.level > 0;
    };
    if (shouldMaskNode(node)) count++;
    node.children.forEach(c => count += calculateRequiredNodes(c, level));
    return count;
  }, []);

  const updateProgress = useCallback((sessionData: Session) => {
    const totalRequired = calculateRequiredNodes(sessionData.data, sessionData.difficulty);
    const solvedCount = Object.values(sessionData.nodeStates).filter(s => s.isSolved).length;
    sessionData.progress = Math.min(100, Math.round((solvedCount / Math.max(1, totalRequired)) * 100));
    return sessionData;
  }, [calculateRequiredNodes]);

  const handleUpload = (content: string, fileName: string) => {
    const tree = parseMarkdownToTree(content);
    const newSession: Session = {
      id: Date.now().toString(),
      fileName: fileName || "New Mind Map",
      data: tree,
      difficulty: DifficultyLevel.BASIC,
      nodeStates: {},
      lastUpdated: Date.now(),
      progress: 0
    };
    const updated = [newSession, ...sessions];
    saveSessions(updated);
    setActiveSession(newSession);
    setView('study');
  };

  const handleNodeUpdate = (nodeId: string, stateUpdate: Partial<NodeState>) => {
    if (!activeSession) return;
    const nextNodeStates = nodeId ? {
      ...activeSession.nodeStates,
      [nodeId]: {
        ...(activeSession.nodeStates[nodeId] || { isSolved: false, isStarred: false, isCollapsed: false, hintCount: 0 }),
        ...stateUpdate
      }
    } : {}; // Handle reset if nodeId is empty

    const nextSession = {
      ...activeSession,
      nodeStates: nodeId ? nextNodeStates : {},
      lastUpdated: Date.now()
    };
    const finalSession = updateProgress(nextSession);
    setActiveSession(finalSession);
  };

  const setDifficulty = (level: DifficultyLevel) => {
    if (!activeSession) return;
    const next = { ...activeSession, difficulty: level };
    setActiveSession(updateProgress(next));
  };

  const toggleGlobalExpand = () => {
    if (!activeSession) return;
    const newState = !globalExpand;
    setGlobalExpand(newState);
    const newNodeStates = { ...activeSession.nodeStates };
    const traverse = (node: TreeNode) => {
      const currentState = newNodeStates[node.id] || { isSolved: false, isStarred: false, isCollapsed: false, hintCount: 0 };
      newNodeStates[node.id] = { ...currentState, isCollapsed: !newState };
      node.children.forEach(traverse);
    };
    traverse(activeSession.data);
    setActiveSession({ ...activeSession, nodeStates: newNodeStates });
  };

  const handleSaveAndExit = () => {
    if (activeSession) {
      const updatedList = sessions.map(s => s.id === activeSession.id ? activeSession : s);
      saveSessions(updatedList);
    }
    setActiveSession(null);
    setView('dashboard');
  };

  const dashboardView = (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <header className="flex flex-col md:flex-col space-y-8 md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white"><BookOpen className="w-8 h-8" /></div>
            Pro Mind Map
          </h1>
          <p className="text-slate-500 mt-2 text-lg">Active Recall Workspace</p>
        </div>
        <button 
          onClick={() => handleUpload(`English Education Theory
  Theories
    Behaviorism
      Stimulus
      Response
    Cognitivism
      Schema
      Memory
  Methods
    GTM
      Grammar
      Translation
    CLT
      Interaction
      Fluency`, "Demo: English Theory")}
          className="flex items-center gap-2 bg-white border border-slate-200 px-5 py-2.5 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 transition-all shadow-sm group"
        >
          <Sparkles className="w-4 h-4 text-amber-500 group-hover:scale-110" />
          Load Demo
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer group flex flex-col items-center justify-center p-10 border-2 border-dashed border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50 rounded-3xl transition-all"
          >
            <div className="w-20 h-20 rounded-2xl bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 flex items-center justify-center mb-6 transition-all">
              <Plus className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Upload File</h3>
            <p className="text-sm text-slate-500 text-center mt-2 px-4">Markdown or Indented Text (.md, .txt)</p>
            <input type="file" ref={fileInputRef} className="hidden" accept=".md,.txt" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => handleUpload(ev.target?.result as string, file.name);
                reader.readAsText(file);
              }
            }} />
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="font-bold text-xl text-slate-800 flex items-center gap-3"><History className="w-5 h-5 text-slate-400" />History</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {sessions.map((session) => (
                <div key={session.id} className="p-8 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-slate-800 truncate">{session.fileName}</h3>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs font-bold">{session.progress}% Complete</div>
                      <span className="text-xs text-slate-400 uppercase font-black">Lvl {session.difficulty}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveSessions(sessions.filter(s => s.id !== session.id))} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"><Trash2 className="w-5 h-5" /></button>
                    <button onClick={() => { setActiveSession(session); setView('study'); }} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100"><Play className="w-4 h-4" />Practice</button>
                  </div>
                </div>
              ))}
              {sessions.length === 0 && (
                <div className="p-20 text-center text-slate-400">
                  No sessions found. Upload a file to start.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const studyView = activeSession && (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <header className="h-20 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={handleSaveAndExit} className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 font-bold px-4 py-2 hover:bg-slate-50 rounded-2xl"><Home className="w-5 h-5" /><span className="hidden md:inline">Exit</span></button>
          <div className="flex bg-slate-100 p-1.5 rounded-2xl">
            {[1, 2, 3].map((lvl) => (
              <button key={lvl} onClick={() => setDifficulty(lvl)} className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${activeSession.difficulty === lvl ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Lvl {lvl}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden lg:flex flex-col items-end mr-4">
            <span className="text-[10px] font-black text-slate-400 uppercase">Recall Mastery</span>
            <div className="w-32 h-2 bg-slate-100 rounded-full mt-1 overflow-hidden ring-1 ring-slate-200">
              <div className="h-full bg-indigo-600 transition-all duration-700" style={{ width: `${activeSession.progress}%` }}></div>
            </div>
          </div>
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
            <button onClick={toggleGlobalExpand} className="p-2 text-slate-500 hover:text-indigo-600"><Maximize className="w-5 h-5" /></button>
            <button onClick={() => setIsStarredOnly(!isStarredOnly)} className={`p-2 rounded-xl transition-all ${isStarredOnly ? 'bg-white text-amber-500' : 'text-slate-500'}`}><Star className={`w-5 h-5 ${isStarredOnly ? 'fill-amber-500' : ''}`} /></button>
            <button onClick={() => confirm("Reset progress?") && handleNodeUpdate('', {})} className="p-2 text-slate-500 hover:text-red-500"><RotateCcw className="w-5 h-5" /></button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] p-8 md:p-16">
        <div className="max-w-4xl mx-auto pb-40">
          <h1 className="text-4xl font-black text-slate-900 mb-12 border-l-8 border-indigo-600 pl-6">{activeSession.data.text}</h1>
          <MindMapNode node={activeSession.data} session={activeSession} difficulty={activeSession.difficulty} onUpdateNode={handleNodeUpdate} starredOnly={isStarredOnly} isRoot={true} />
        </div>
      </main>

      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-3 rounded-full shadow-2xl flex gap-6 z-30 font-bold">
        <span>{activeSession.progress}%</span>
        <div className="w-px h-6 bg-slate-700"></div>
        <span>Level {activeSession.difficulty}</span>
      </div>
    </div>
  );

  return view === 'dashboard' ? dashboardView : studyView;
}
