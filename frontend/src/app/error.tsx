"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[Route Error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-jb-bg text-jb-text p-8">
      <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
      <p className="text-jb-text-muted text-sm mb-6 text-center max-w-md">
        {error.message || "An unexpected error occurred while loading this page."}
      </p>
      <button
        onClick={reset}
        className="px-6 py-2 rounded-xl bg-jb-accent text-white font-semibold hover:opacity-90 transition-opacity"
      >
        Try Again
      </button>
    </div>
  );
}
