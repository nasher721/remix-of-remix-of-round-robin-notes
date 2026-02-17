import { useCallback, useRef, useState } from 'react';

export interface UndoState<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface UseUndoRedoReturn<T> {
  state: UndoState<T>;
  setState: (newPresent: T | ((prev: T) => T)) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  goToState: (index: number) => void;
  clear: () => void;
}

/**
 * Generic undo/redo hook for managing state history.
 * Supports up to 50 history entries to prevent memory issues.
 */
export function useUndoRedo<T>(initialState: T, maxHistory: number = 50): UseUndoRedoReturn<T> {
  const [state, setStateInternal] = useState<UndoState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const maxHistoryRef = useRef(maxHistory);
  maxHistoryRef.current = maxHistory;

  const setState = useCallback((newPresent: T | ((prev: T) => T)) => {
    setStateInternal((currentState) => {
      const resolvedNewPresent = typeof newPresent === 'function'
        ? (newPresent as (prev: T) => T)(currentState.present)
        : newPresent;

      // Don't add to history if state hasn't changed
      if (resolvedNewPresent === currentState.present) {
        return currentState;
      }

      const newPast = [...currentState.past, currentState.present];
      
      // Trim history if it exceeds maxHistory
      if (newPast.length > maxHistoryRef.current) {
        newPast.shift();
      }

      return {
        past: newPast,
        present: resolvedNewPresent,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    setStateInternal((currentState) => {
      if (currentState.past.length === 0) {
        return currentState;
      }

      const previous = currentState.past[currentState.past.length - 1];
      const newPast = currentState.past.slice(0, -1);

      return {
        past: newPast,
        present: previous,
        future: [currentState.present, ...currentState.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setStateInternal((currentState) => {
      if (currentState.future.length === 0) {
        return currentState;
      }

      const next = currentState.future[0];
      const newFuture = currentState.future.slice(1);

      return {
        past: [...currentState.past, currentState.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const goToState = useCallback((index: number) => {
    setStateInternal((currentState) => {
      if (index < 0 || index >= currentState.past.length + 1) {
        return currentState;
      }

      if (index === currentState.past.length) {
        return currentState; // Already at this state
      }

      if (index < currentState.past.length) {
        // Going back to a past state
        const targetState = currentState.past[index];
        const newPast = currentState.past.slice(0, index);
        
        return {
          past: newPast,
          present: targetState,
          future: [currentState.present, ...currentState.past.slice(index), ...currentState.future],
        };
      }

      return currentState;
    });
  }, []);

  const clear = useCallback(() => {
    setStateInternal((currentState) => ({
      past: [],
      present: currentState.present,
      future: [],
    }));
  }, []);

  return {
    state,
    setState,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    goToState,
    clear,
  };
}

export default useUndoRedo;
