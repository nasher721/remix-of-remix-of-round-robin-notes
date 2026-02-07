import * as React from "react";

interface CommandCenterContextValue {
  focusedIds: string[];
  primaryFocusId: string | null;
  toggleFocus: (id: string) => void;
  clearFocus: () => void;
  setPrimaryFocusId: (id: string | null) => void;
}

const CommandCenterContext = React.createContext<CommandCenterContextValue | undefined>(undefined);

export const CommandCenterProvider = ({
  children,
  value,
}: {
  children: React.ReactNode;
  value: CommandCenterContextValue;
}) => {
  return (
    <CommandCenterContext.Provider value={value}>{children}</CommandCenterContext.Provider>
  );
};

export const useCommandCenter = () => {
  const context = React.useContext(CommandCenterContext);
  if (!context) {
    throw new Error("useCommandCenter must be used within CommandCenterProvider");
  }
  return context;
};
