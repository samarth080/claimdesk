"use client";

import { useState, type FormEvent } from "react";

import type {
  ClarifyingQuestionId,
  ClarifyingQuestionView,
} from "@/lib/rules/questions";

type ClarifyingQuestionFormProps = {
  question: ClarifyingQuestionView;
  onSubmit: (questionId: ClarifyingQuestionId, answer: string) => Promise<void>;
  suggestedAnswer?: string | null;
};

export function ClarifyingQuestionForm({
  question,
  onSubmit,
  suggestedAnswer,
}: ClarifyingQuestionFormProps) {
  const [answer, setAnswer] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answer.trim()) return;
    await onSubmit(question.id, answer);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-800">
            Highest-information question
          </p>
          <span className="font-mono text-[10px] tabular-nums text-zinc-500">
            {question.candidateCountBefore} candidates → ~
            {question.expectedRemainingCodes.toFixed(1)}
          </span>
        </div>
        <label
          htmlFor={`clarification-${question.id}`}
          className="mt-2 block text-sm font-medium text-zinc-900"
        >
          {question.text}
        </label>
        <p className="mt-1 text-xs leading-5 text-zinc-600">
          This is the one missing detail most likely to change the diagnosis.
        </p>
      </div>

      {question.inputType === "choice" ? (
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">Choose an answer</legend>
          {question.options.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer border px-3 py-3 text-sm transition ${
                answer === option.value
                  ? "border-amber-500 bg-white text-zinc-950"
                  : "border-zinc-300 bg-white/70 text-zinc-700 hover:border-zinc-500"
              }`}
            >
              <input
                type="radio"
                name="clarifying-answer"
                value={option.value}
                checked={answer === option.value}
                onChange={(event) => setAnswer(event.target.value)}
                className="mr-2 accent-amber-700"
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      ) : (
        <input
          id={`clarification-${question.id}`}
          type={question.inputType === "date" ? "text" : question.inputType}
          inputMode={question.inputType === "date" ? "numeric" : undefined}
          pattern={
            question.inputType === "date"
              ? "\\d{4}-\\d{2}-\\d{2}"
              : undefined
          }
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder={
            question.inputType === "email"
              ? "name@example.com"
              : question.inputType === "date"
                ? "YYYY-MM-DD"
                : undefined
          }
          required
          className="block w-full border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none transition focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
        />
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] leading-5 text-zinc-500">
            Your answer is saved with the case evidence.
          </p>
          {suggestedAnswer ? (
            <button
              type="button"
              onClick={() => setAnswer(suggestedAnswer)}
              className="mt-1 text-[11px] font-medium text-amber-800 underline decoration-amber-300 underline-offset-4 hover:text-amber-950"
            >
              Use demo answer: {suggestedAnswer}
            </button>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={!answer.trim()}
          className="shrink-0 bg-amber-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          Update diagnosis
        </button>
      </div>
    </form>
  );
}
