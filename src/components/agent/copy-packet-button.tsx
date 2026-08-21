"use client";

import { useState } from "react";

export function CopyPacketButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("error");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="border border-blue-700 bg-blue-700 px-3 py-2 text-detail font-medium text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
    >
      {state === "copied"
        ? "Copied to clipboard"
        : state === "error"
          ? "Copy failed — select text"
          : "Copy complete packet"}
    </button>
  );
}
