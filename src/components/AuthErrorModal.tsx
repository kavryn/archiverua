"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { signOut, useSession } from "next-auth/react";
import { useNavigationGuard } from "@/context/NavigationGuardContext";

export default function AuthErrorModal() {
  const [open, setOpen] = useState(false);
  const { setShouldGuard } = useNavigationGuard();
  const { data: session } = useSession();

  useEffect(() => {
    function handleAuthError() {
      setOpen(true);
    }
    window.addEventListener("API_FETCH_AUTH_ERROR", handleAuthError);
    return () => window.removeEventListener("API_FETCH_AUTH_ERROR", handleAuthError);
  }, []);

  useEffect(() => {
    if (session?.error === "RefreshTokenError") {
      signOut({ callbackUrl: "/" });
    }
  }, [session?.error]);

  return (
    <Dialog open={open} onClose={() => {}} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-xl bg-white shadow-xl">
          <div className="border-b border-zinc-200 px-6 py-4">
            <DialogTitle className="text-base font-semibold text-zinc-800">
              Сесія завершилась
            </DialogTitle>
          </div>

          <div className="px-6 py-4 text-sm text-zinc-600">
            <p>
              Будь ласка, увійдіть знову, щоб продовжити роботу.
            </p>
          </div>

          <div className="flex justify-end border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={() => {
                setShouldGuard(false);
                signOut({ callbackUrl: "/" });
              }}
              className="btn-primary"
            >
              Зрозуміло
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
