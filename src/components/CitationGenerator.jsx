"use client";

import { useState } from "react";
import axios from "axios";
import { Copy, Loader2, Check } from "lucide-react";

export default function CitationGenerator() {
  const [input, setInput] = useState("");
  const [citation, setCitation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!input.trim()) return;

    setLoading(true);
    setError("");
    setCitation("");
    setCopied(false);

    try {
      const response = await axios.post("/api/citation", { identifier: input });
      if (response.data.citation) {
        setCitation(response.data.citation);
      } else {
        setError("Could not generate citation. Please check the identifier.");
      }
    } catch (err) {
      setError(
        err.response?.data?.error || "An error occurred while fetching data."
      );
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(citation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-6">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Justapedia Citation Tool
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
          Enter a DOI, PMID, S2CID, Google Books URL, or any Web Link.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g., 10.1038/... or https://bbc.com/news/..."
            className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !input.trim()}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating...
            </>
          ) : (
            "Generate Citation"
          )}
        </button>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {citation && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Result:
              </span>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copy
                  </>
                )}
              </button>
            </div>
            <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 font-mono text-sm break-words whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
              {citation}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800 text-sm text-zinc-500 dark:text-zinc-400">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-200 mb-2">Supported Identifiers:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>DOI:</strong> e.g., 10.1038/s41586-020-2649-2</li>
          <li><strong>PMID:</strong> e.g., 32728213</li>
          <li><strong>S2CID:</strong> e.g., 220845396</li>
          <li><strong>Google Books:</strong> URL (e.g., https://books.google.com/...)</li>
          <li><strong>Web Link:</strong> URL (e.g., https://bbc.com/news/...)</li>
        </ul>
        <p className="mt-4 text-xs">
          This tool expands identifiers into full citations for Justapedia.
          It fixes common errors by regenerating the citation from the official source. Developed by Sourav. Contact: skhsouravhalder@gmail.com
        </p>
      </div>
    </div>
  );
}
