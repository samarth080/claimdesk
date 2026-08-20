import { describe, expect, it } from "vitest";

import type { Click, Order } from "@/lib/types/domain";

import { buildAgentCasePacket } from "./queue";

const click: Click = {
  id: "click-row-1",
  userId: "user-1",
  retailerId: "retailer-1",
  clickedAt: "2026-08-10T10:00:00.000Z",
  clickId: "clk_network_1",
  device: "desktop",
  handoffToNativeApp: false,
  referrerIntact: true,
  cartPreloaded: false,
};

const order: Order = {
  id: "order-1",
  userId: "user-1",
  retailerId: "retailer-1",
  orderedAt: "2026-08-10T10:20:00.000Z",
  orderValue: 18_990,
  category: "Electronics",
  status: "delivered",
  couponCodeUsed: null,
  emailUsed: "person@example.test",
};

describe("agent case packet", () => {
  it("produces a complete copy-ready network claim", () => {
    const packet = buildAgentCasePacket({
      caseId: "NET-12345678",
      route: "Affiliate network",
      claimId: "claim-12345678",
      diagnosisCode: "GENUINE_TRACKING_FAILURE",
      confidence: 0.98,
      claimantName: "Test Person",
      claimantEmail: "person@example.test",
      retailerName: "Orbit Electronics",
      submittedAt: "20 August 2026 at 4:00 pm",
      rawText: "My cashback did not track.",
      click,
      order,
      cashback: null,
      clarification: null,
      storedPacket: {
        evidenceSummary: [
          "Clean click recorded.",
          "Tracking SLA elapsed.",
        ],
        requestedAction: "Validate the transaction.",
      },
    });

    expect(packet.heading).toBe("Network claim draft");
    expect(packet.evidenceSummary).toEqual([
      "Clean click recorded.",
      "Tracking SLA elapsed.",
    ]);
    expect(packet.copyText).toContain("Case ID: NET-12345678");
    expect(packet.copyText).toContain("Click ID: clk_network_1");
    expect(packet.copyText).toContain("Order ID: order-1");
    expect(packet.copyText).toContain("Order value: ₹18,990");
    expect(packet.copyText).toContain("Customer statement: My cashback did not track.");
    expect(packet.copyText).toContain(
      "Requested action: Validate the transaction.",
    );
  });

  it("includes the single clarification in a human review brief", () => {
    const packet = buildAgentCasePacket({
      caseId: "HUM-12345678",
      route: "Human specialist",
      claimId: "claim-12345678",
      diagnosisCode: "ACCOUNT_MISMATCH",
      confidence: 0.99,
      claimantName: "Test Person",
      claimantEmail: "person@example.test",
      retailerName: "Cedar & Loom",
      submittedAt: "20 August 2026 at 4:00 pm",
      rawText: "The order is missing cashback.",
      click,
      order: { ...order, emailUsed: "order@example.test" },
      cashback: null,
      clarification: {
        question: "Which email address did you use for this order?",
        answer: "order@example.test",
      },
      storedPacket: null,
    });

    expect(packet.heading).toBe("Human review brief");
    expect(packet.copyText).toContain(
      "Clarifying answer: order@example.test",
    );
    expect(packet.evidenceSummary).toContain(
      "No cashback record is linked to the click or order.",
    );
  });
});
