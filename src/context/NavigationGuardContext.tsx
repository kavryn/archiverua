"use client";
import { createContext, useCallback, useContext, useEffect, useRef } from "react";

type Ctx = {
  setShouldGuard: (v: boolean) => void;
  isGuarded: () => boolean;
};

const NavigationGuardContext = createContext<Ctx>({
  setShouldGuard: () => {},
  isGuarded: () => false,
});

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const shouldGuardRef = useRef(false);

  const setShouldGuard = useCallback((v: boolean) => {
    shouldGuardRef.current = v;
  }, []);

  const isGuarded = () => shouldGuardRef.current;

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!shouldGuardRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  return (
    <NavigationGuardContext.Provider value={{ setShouldGuard, isGuarded }}>
      {children}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  return useContext(NavigationGuardContext);
}
