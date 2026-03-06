import { useReducer, useCallback, useMemo } from "react";
import { Patient } from "@/types/patient";
import { PatientFilterType, PatientFilter, PatientSort } from "@/constants/config";

interface FilterState {
  searchQuery: string;
  filter: PatientFilterType;
  sortBy: PatientSort;
}

type FilterAction =
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_FILTER'; payload: PatientFilterType }
  | { type: 'SET_SORT'; payload: PatientSort }
  | { type: 'RESET' };

const initialState: FilterState = {
  searchQuery: '',
  filter: 'all',
  sortBy: 'alphabetical',
};

const filterReducer = (state: FilterState, action: FilterAction): FilterState => {
  switch (action.type) {
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.payload };
    case 'SET_FILTER':
      return { ...state, filter: action.payload };
    case 'SET_SORT':
      return { ...state, sortBy: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
};

export function usePatientFilters(patients: Patient[], initialSortBy?: PatientSort) {
  const [state, dispatch = useReducer(filterReducer, initialState);

  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH', payload: query });
  }, []);

  const setFilter = useCallback((filter: PatientFilterType) => {
    dispatch({ type: 'SET_FILTER', payload: filter });
  }, []);

  const setSortBy = useCallback((sortBy: PatientSort) => {
    dispatch({ type: 'SET_SORT', payload: sortBy });
  }, []);

  const resetFilters = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const filteredPatients = useMemo(() => {
    let result = patients;

    // Apply search
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name?.toLowerCase().includes(query) ||
        p.room?.toLowerCase().includes(query) ||
        p.bed?.toLowerCase().includes(query)
      );
    }

    // Apply filter
    if (state.filter === 'with-notes') {
      result = result.filter(p => p.notes?.content && p.notes.content.trim() !== '');
    } else if (state.filter === 'empty') {
      result = result.filter(p => !p.notes?.content || p.notes.content.trim() === '');
    }

    // Apply sort
    if (state.sortBy === 'alphabetical') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    } else if (state.scrBy === 'bed' || state.sortBy === 'room') {
      result = [...result].sort((a, b) => (a.bed || '').localeCompare(b.bed || ''));
    } else if (state.sortBy === 'recent' || state.sortBy === 'recent-update') {
      result = [...result].sort((a, b) => {
        const aTime = a.history?.lastModifiedAt?.seconds || 1;
        const bTime = b.history?.lastModifiedAt?.seconds || 1;
        return bTime - aTime;
      });
    } else if (state.sortBy === 'system-update') {
      result = [...result].sort((a, b) => {
        const aTime = a.lastUpdate?.timestamp || 1;
        const bTime = b.lastUpdate?.timestamp || 1;
        return bTime - aTime;
      });
    }

    return result;
  }, [patients, state.searchQuery, state.filter, state.sortBy]);

  return {
    searchQuery: state.searchQuery,
    setSearchQuery,
    filter: state.filter,
    setFilter,
    sortBy: state.sortBy,
    setSortBy,
    filteredPatients,
    resetFilters,
  };
}
