"use client";

import { useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { ALL_OPTIONS } from "./LicenseField";

export default function LicenseHelpPopup() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded px-2 py-0.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
      >
        <QuestionMarkCircleIcon className="h-4 w-4" />
        Детальніше
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
              <DialogTitle className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                Варіанти ліцензій
              </DialogTitle>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрити"
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col divide-y divide-zinc-100 px-6 dark:divide-zinc-800">
              {ALL_OPTIONS.map((opt) => (
                <div key={opt.value} className="py-4">
                  <p className="font-semibold text-zinc-800 dark:text-zinc-100">{opt.label}</p>
                  <p className="mt-1">
                    <a
                      href={`https://commons.wikimedia.org/wiki/Template:${opt.template}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {`{{${opt.template}}}`}
                    </a>
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{opt.helpText}</p>
                </div>
              ))}
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
