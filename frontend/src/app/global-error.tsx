"use client";

import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
}

export default function GlobalError({ error }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[Global Error]", error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center h-screen bg-jb-bg text-jb-text p-8">
          <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
          <p className="text-jb-text-muted text-sm mb-6 text-center max-w-md">
            {error.message || "An unexpected error occurred. Please try refreshing the page."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 rounded-xl bg-jb-accent text-white font-semibold hover:opacity-90 transition-opacity"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
