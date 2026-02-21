"use client";
import { createContext, useContext, useState } from "react";

type Ctx = { shouldGuard: boolean; setShouldGuard: (v: boolean) => void };

const NavigationGuardContext = createContext<Ctx>({
  shouldGuard: false,
  setShouldGuard: () => {},
});

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const [shouldGuard, setShouldGuard] = useState(false);
  return (
    <NavigationGuardContext.Provider value={{ shouldGuard, setShouldGuard }}>
      {children}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  return useContext(NavigationGuardContext);
}
