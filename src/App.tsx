import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Upload, History, FileText, Trash2, Play, BookOpen, Plus, Sparkles,
  Home, Maximize, Star, RotateCcw, HelpCircle, CheckCircle2,
  ChevronRight, ChevronDown 
} from 'lucide-react';

// --- 유틸리티 및 타입 ---
const STORAGE_KEY = 'promindmap_v1_single';
const generateId = () => Math.random().toString(36).substring(2, 11);

enum DifficultyLevel { BASIC = 1, INTERMEDIATE = 2, MASTER = 3 }

const parseMarkdownToTree = (text: string) => {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const getIndent = (line: string) => (line.match(/^(\s*)/)?.[1].length || 0);
  const cleanText = (line: string) => line.trim().replace(/^[-*+]\s*/, '').replace(/^#+\s*/, '').trim();
  
  const stack: any[] = [];
  let root: any = null;

  lines.forEach((line) => {
    const indent = getIndent(line);
    const node = { id: generateId(), text: cleanText(line), children: [], isLeaf: true, level: 0 };
    if (!root) { root = node; stack.push({ node, indent }); return; }
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop();
    if (stack.length > 0) {
      const parent = stack[stack.length - 1].node;
      parent.children.push(node);
      parent.isLeaf = false;
      node.level = stack.length;
      stack.push({ node, indent });
    }
  });
  return root;
};

// --- 노드 컴포넌트 ---
const MindMapNode = ({ node, session, difficulty, onUpdateNode, starredOnly, isRoot = false }: any) => {
  const nodeState = session.nodeStates[node.id] || { isSolved: false, isStarred: false, isCollapsed: false, hintCount: 0 };
  const [inputValue, setInputValue] = useState('');
  const isMasked = (node.level > 0 && !nodeState.isSolved) && (
    (difficulty === 1 && node.isLeaf) || 
    (difficulty === 2 && (node.isLeaf || node.children.some((c: any) => c.isLeaf))) || 
    (difficulty === 3)
  );

  if (starredOnly && !nodeState.isStarred) return null;

  return (
    <div className={`flex flex-col mb-4 ${isRoot ? '' : 'ml-6 md:ml-10'}`}>
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-2 p-1.5 rounded-2xl ${isMasked ? 'bg-slate-100' : ''}`}>
          {node.children.length > 0 && (
            <button onClick={() => onUpdateNode(node.id, { isCollapsed: !nodeState.isCollapsed })}>
              {nodeState.isCollapsed ? <ChevronRight className="w-4" /> : <ChevronDown className="w-4" />}
            </button>
          )}
          {isMasked ? (
            <input 
              value={inputValue} 
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if(e.key === 'Enter' && inputValue.trim() === node.text.trim()) onUpdateNode(node.id, { isSolved: true });
              }}
              className="border rounded-lg px-2 py-1 text-sm w-32 md:w-48"
              placeholder="입력..."
            />
          ) : (
            <span className={`${node.level === 0 ? 'text-xl font-bold' : 'text-base'}`}>{node.text}</span>
          )}
          <button onClick={() => onUpdateNode(node.id, { isStarred: !nodeState.isStarred })}>
            <Star className={`w-4 ${nodeState.isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
          </button>
        </div>
      </div>
      {!nodeState.isCollapsed && node.children.map((c: any) => (
        <MindMapNode key={c.id} node={c} session={session} difficulty={difficulty} onUpdateNode={onUpdateNode} starredOnly={starredOnly} />
      ))}
    </div>
  );
};

// --- 메인 앱 ---
export default function App() {
  const [sessions, setSessions] = useState<any[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  const [activeSession, setActiveSession] = useState<any>(null);
  const [isStarredOnly, setIsStarredOnly] = useState(false);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); }, [sessions]);

  const handleUpload = (content: string, name: string) => {
    const newSession = { id: generateId(), fileName: name, data: parseMarkdownToTree(content), difficulty: 1, nodeStates: {}, progress: 0 };
    setSessions([newSession, ...sessions]);
    setActiveSession(newSession);
  };

  const handleUpdate = (nodeId: string, update: any) => {
    const nextStates = nodeId ? { ...activeSession.nodeStates, [nodeId]: { ...(activeSession.nodeStates[nodeId] || {}), ...update } } : {};
    setActiveSession({ ...activeSession, nodeStates: nextStates });
  };

  if (activeSession) {
    return (
      <div className="h-full flex flex-col bg-white">
        <header className="p-4 border-b flex justify-between items-center">
          <button onClick={() => { setSessions(sessions.map(s => s.id === activeSession.id ? activeSession : s)); setActiveSession(null); }}><Home /></button>
          <div className="flex gap-2">
            {[1, 2, 3].map(l => <button key={l} onClick={() => setActiveSession({...activeSession, difficulty: l})} className={`px-3 py-1 rounded ${activeSession.difficulty === l ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>Lvl {l}</button>)}
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6 md:p-12">
          <MindMapNode node={activeSession.data} session={activeSession} difficulty={activeSession.difficulty} onUpdateNode={handleUpdate} starredOnly={isStarredOnly} isRoot={true} />
        </main>
      </div>
    );
  }

  return (
    <div className="p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl font-black mb-10">Pro Mind Map</h1>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="border-2 border-dashed p-10 rounded-3xl text-center cursor-pointer hover:bg-slate-50" onClick={() => document.getElementById('file')?.click()}>
          <Plus className="mx-auto mb-4" /> <p>파일 업로드</p>
          <input id="file" type="file" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(await file.text(), file.name);
          }} />
        </div>
        <div className="space-y-4">
          <h2 className="font-bold">최근 기록</h2>
          {sessions.map(s => (
            <div key={s.id} className="p-4 border rounded-xl flex justify-between items-center">
              <span>{s.fileName}</span>
              <button onClick={() => setActiveSession(s)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg">시작</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
