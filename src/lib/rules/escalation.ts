import type { ClaimContext, EscalationPacket } from "@/lib/types/domain";

import { formatIndiaDateTime, formatRupees } from "./dates";
import { matchEvidence } from "./evidence";

export function createNetworkEscalationPacket(
  ctx: ClaimContext,
): EscalationPacket | null {
  const { click, order } = matchEvidence(ctx);
  if (!click || !order || !ctx.retailer) return null;

  return {
    caseId: `NET-${ctx.claim.id.slice(0, 8).toUpperCase()}`,
    retailer: ctx.retailer.name,
    clickId: click.clickId,
    orderedAt: order.orderedAt,
    orderValue: order.orderValue,
    evidenceSummary: [
      `Click ${click.clickId} recorded at ${formatIndiaDateTime(click.clickedAt)} with intact referral data.`,
      `Order matched at ${formatIndiaDateTime(order.orderedAt)} for ${formatRupees(order.orderValue)}.`,
      `${ctx.retailer.trackingSlaHours}-hour tracking SLA elapsed.`,
      "No cashback record is linked to the click or order.",
    ],
    requestedAction:
      "Validate the transaction and create the missing cashback record.",
  };
}
