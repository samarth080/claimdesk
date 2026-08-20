import { describe, expect, it, vi } from "vitest";

import type { DiagnosisResult } from "@/lib/rules/engine";

import { writeResolutionCopy } from "./resolution";

const diagnosis: DiagnosisResult = {
  code: "WITHIN_TRACKING_SLA",
  confidence: 0.99,
  disposition: "auto_resolve",
  baseDisposition: "auto_resolve",
  explanation:
    "Your click is inside the 24-hour window and is due by 21 August 2026 at 2:00 pm.",
  goodwill: null,
  escalationPacket: null,
  trace: [],
};

const fallback =
  "Your click is inside the 24-hour tracking window. It is due by 21 August 2026 at 2:00 pm.";

describe("AI resolution-copy adapter", () => {
  it("returns the complete template when no API generator exists", async () => {
    const result = await writeResolutionCopy({
      diagnosis,
      fallback,
      evidence: { tracking_sla_hours: 24 },
      generator: null,
    });

    expect(result).toEqual({
      message: fallback,
      source: "template_fallback",
    });
  });

  it("accepts concise copy from a mocked generator", async () => {
    const copy =
      "We found your click. Nimbus Mart has until 21 August 2026 at 2:00 pm to report this order, so no claim is needed yet.";
    const result = await writeResolutionCopy({
      diagnosis,
      fallback,
      evidence: { tracking_sla_hours: 24 },
      generator: vi.fn().mockResolvedValue(copy),
    });

    expect(result).toEqual({ message: copy, source: "ai" });
  });

  it("falls back when generated copy violates a hard constraint", async () => {
    const result = await writeResolutionCopy({
      diagnosis,
      fallback,
      evidence: { tracking_sla_hours: 24 },
      generator: vi.fn().mockResolvedValue(
        "Your cashback is definitely guaranteed to arrive tomorrow 🎉",
      ),
    });

    expect(result).toEqual({
      message: fallback,
      source: "template_fallback",
    });
  });

  it("rejects copy that promises a future cashback credit", async () => {
    const result = await writeResolutionCopy({
      diagnosis,
      fallback,
      evidence: { tracking_sla_hours: 24 },
      generator: vi.fn().mockResolvedValue(
        "Your claim is inside the 24-hour window and will be processed and credited by 21 August 2026 at 2:00 pm.",
      ),
    });

    expect(result).toEqual({
      message: fallback,
      source: "template_fallback",
    });
  });

  it("rejects invented completed credits and deadlines for goodwill cases", async () => {
    const goodwillDiagnosis: DiagnosisResult = {
      ...diagnosis,
      code: "NATIVE_APP_HANDOFF",
    };
    const result = await writeResolutionCopy({
      diagnosis: goodwillDiagnosis,
      fallback: "The ₹1,799 order qualifies for an auto-approved goodwill credit.",
      evidence: { amount: 1_799 },
      generator: vi.fn().mockResolvedValue(
        "Your ₹1,799 order has been credited as goodwill and the credit is due by 31 August 2026.",
      ),
    });

    expect(result).toEqual({
      message: "The ₹1,799 order qualifies for an auto-approved goodwill credit.",
      source: "template_fallback",
    });
  });

  it("rejects an invented promise for when human review will finish", async () => {
    const humanDiagnosis: DiagnosisResult = {
      ...diagnosis,
      code: "ACCOUNT_MISMATCH",
      disposition: "escalate_human",
      baseDisposition: "needs_input",
    };
    const result = await writeResolutionCopy({
      diagnosis: humanDiagnosis,
      fallback,
      evidence: { amount: 1_890 },
      generator: vi.fn().mockResolvedValue(
        "The ₹1,890 order needs a specialist. This will be completed due by 48 hours from now.",
      ),
    });

    expect(result).toEqual({
      message: fallback,
      source: "template_fallback",
    });
  });

  it("rejects an invented dated decision for a network escalation", async () => {
    const networkDiagnosis: DiagnosisResult = {
      ...diagnosis,
      code: "GENUINE_TRACKING_FAILURE",
      disposition: "escalate_network",
    };
    const result = await writeResolutionCopy({
      diagnosis: networkDiagnosis,
      fallback: "The ₹18,990 order needs an affiliate-network tracking claim.",
      evidence: { amount: 18_990 },
      generator: vi.fn().mockResolvedValue(
        "The ₹18,990 order needs network validation. A decision will be communicated by 15 September 2026.",
      ),
    });

    expect(result).toEqual({
      message: "The ₹18,990 order needs an affiliate-network tracking claim.",
      source: "template_fallback",
    });
  });

  it("falls back when the generator throws", async () => {
    const result = await writeResolutionCopy({
      diagnosis,
      fallback,
      evidence: { tracking_sla_hours: 24 },
      generator: vi.fn().mockRejectedValue(new Error("provider unavailable")),
    });

    expect(result.source).toBe("template_fallback");
    expect(result.message).toBe(fallback);
  });
});
