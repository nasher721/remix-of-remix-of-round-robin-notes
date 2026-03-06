// Focused context exports
export { PatientDataProvider, usePatientData, usePatientList } from "./PatientDataContext";
export { FilterProvider, useFilters, useSearchQuery } from "./FilterContext";
export { UIProvider, useUI, usePatientSelection, useMobileTab, useUtilityPanel } from "./UIContext";

// Legacy context (backward compatibility)
export { DashboardProvider, useDashboard } from "./DashboardContext";
