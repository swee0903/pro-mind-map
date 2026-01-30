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
  // 안전장치: session이나 nodeStates가 없을 경우를 대비해 기본값 제공
  const nodeState = (session?.nodeStates && session.nodeStates[node.id]) || { isSolved: false, isStarred: false, isCollapsed: false, hintCount: 0 };
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
  const [sessions
