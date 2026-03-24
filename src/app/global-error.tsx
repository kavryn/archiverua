"use client";

import * as Sentry from "@sentry/nextjs";
import Error from "next/error";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="uk">
      <body className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-semibold text-gray-900">
            Щось пішло не так
          </h1>
          <p className="mb-6 text-gray-600">
            Виникла неочікувана помилка. Спробуйте перезавантажити сторінку.
          </p>
        </div>
      </body>
    </html>  );
}
