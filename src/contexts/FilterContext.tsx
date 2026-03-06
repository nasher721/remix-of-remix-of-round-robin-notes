import React, { createContext, useContext, useMemo } from "react";
import { Patient } from "@/types/patient";

// Context for search and filter state
interface FilterContextValue {
  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  // Filter
  filter: string;
  setFilter: (filter: string) => void;
  
  // Sort
  sortBy: string;
  setSortBy: (sort: string) => void;
  
  // Quick actions
  resetFilters: () => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ 
  children, 
  value 
}: { 
  children: React.ReactNode;
  value: FilterContextValue;
}) {
  const memoizedValue = useMemo(() => value, [
    value.searchQuery,
    value.filter,
    value.sortBy,
    value.setSearchQuery,
    value.setFilter,
    value.setSortBy,
    value.resetFilters,
  ]);

  return (
    <FilterContext.Provider value={memoizedValue}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error("useFilters must be used within a FilterProvider");
  }
  return context;
}

// Convenience hook for just the search query
export function useSearchQuery() {
  const { searchQuery, setSearchQuery } = useFilters();
  return { searchQuery, setSearchQuery };
}
