"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-red-900/30 border border-red-700/50 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-white">
            Something went wrong
          </h1>
          <p className="text-zinc-400 text-sm">
            {error.message || "An unexpected error occurred."}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium text-white transition-colors"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium text-zinc-300 transition-colors inline-block"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
