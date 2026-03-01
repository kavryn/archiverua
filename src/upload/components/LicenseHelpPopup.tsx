"use client";

import { useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import {
  InformationCircleIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import { ALL_OPTIONS } from "./LicenseField";

export default function LicenseHelpPopup() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded px-2 py-0.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
      >
        <QuestionMarkCircleIcon className="h-4 w-4" />
        Детальніше
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <DialogTitle className="text-base font-semibold text-zinc-800">
                Варіанти ліцензій
              </DialogTitle>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрити"
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="mx-6 mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex gap-3">
                <InformationCircleIcon className="h-5 w-5 shrink-0 text-blue-500 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p>
                    Вікісховище приймає лише матеріали, які перебувають у Суспільному надбанні (Public Domain) або мають вільну ліцензію. Оскільки це архівні документи, ви маєте вказати підставу чому цей файл більше не охороняється авторським правом.
                  </p>
                  <p className="mt-2 font-medium">
                    Ви можете вказати одну або більше ліцензій, які ви вважаєте найкраще підходить документу.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col divide-y divide-zinc-100 px-6">
              {ALL_OPTIONS.map((opt) => (
                <div key={opt.value} className="py-4">
                  <p className="font-semibold text-zinc-800">{opt.label}</p>
                  <p className="mt-1">
                    <a
                      href={`https://commons.wikimedia.org/wiki/Template:${opt.template}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm text-blue-600 hover:underline"
                    >
                      {`{{${opt.template}}}`}
                    </a>
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">{opt.helpText}</p>
                  {opt.note && (
                    <p className="mt-1 text-sm text-zinc-600 italic"><span className="font-bold
                    not-italic">Примітка:</span> {opt.note}</p>
                  )}
                </div>
              ))}
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
