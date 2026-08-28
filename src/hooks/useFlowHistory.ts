import { useCallback, useRef, useState } from 'react';
import { Node, Edge } from '@xyflow/react';

interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

interface UseFlowHistoryOptions {
  maxHistoryLength?: number;
}

export function useFlowHistory(options: UseFlowHistoryOptions = {}) {
  const { maxHistoryLength = 50 } = options;
  
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  const historyRef = useRef<HistoryState[]>([]);
  const currentIndexRef = useRef(-1);
  const isUndoRedoActionRef = useRef(false);

  const saveState = useCallback((nodes: Node[], edges: Edge[]) => {
    // Don't save if this change was triggered by undo/redo
    if (isUndoRedoActionRef.current) {
      isUndoRedoActionRef.current = false;
      return;
    }

    const newState: HistoryState = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };

    // Remove any redo states if we're not at the end
    if (currentIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, currentIndexRef.current + 1);
    }

    // Add new state
    historyRef.current.push(newState);
    currentIndexRef.current = historyRef.current.length - 1;

    // Limit history length
    if (historyRef.current.length > maxHistoryLength) {
      historyRef.current.shift();
      currentIndexRef.current = historyRef.current.length - 1;
    }

    setCanUndo(currentIndexRef.current > 0);
    setCanRedo(false);
  }, [maxHistoryLength]);

  const undo = useCallback((): HistoryState | null => {
    if (currentIndexRef.current <= 0) return null;

    isUndoRedoActionRef.current = true;
    currentIndexRef.current--;
    
    const state = historyRef.current[currentIndexRef.current];
    
    setCanUndo(currentIndexRef.current > 0);
    setCanRedo(true);

    return {
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      edges: JSON.parse(JSON.stringify(state.edges)),
    };
  }, []);

  const redo = useCallback((): HistoryState | null => {
    if (currentIndexRef.current >= historyRef.current.length - 1) return null;

    isUndoRedoActionRef.current = true;
    currentIndexRef.current++;
    
    const state = historyRef.current[currentIndexRef.current];
    
    setCanUndo(true);
    setCanRedo(currentIndexRef.current < historyRef.current.length - 1);

    return {
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      edges: JSON.parse(JSON.stringify(state.edges)),
    };
  }, []);

  const clearHistory = useCallback(() => {
    historyRef.current = [];
    currentIndexRef.current = -1;
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  return {
    saveState,
    undo,
    redo,
    clearHistory,
    canUndo,
    canRedo,
  };
}
