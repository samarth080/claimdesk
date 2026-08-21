# ClaimDesk

**Missing cashback is the largest source of support tickets on a cashback platform, and answering one means digging through click logs, order records and retailer terms to work out which of a dozen ordinary causes applies.** Most of those causes are already implied by evidence the platform holds — the order was returned, the category is excluded, the click never reached the tracker, the session expired — but a person still has to go and look.

ClaimDesk tests one thesis: **deterministic evidence can resolve a large share of missing-cashback claims immediately, and the genuine failures should reach an agent already diagnosed and filing-ready.** It is a working Next.js prototype on Supabase, not a mock.

There is no retrieval layer and no model in the decision path. Thirteen rules run in a fixed order against structured records; the first to match wins. Groq parses free text on the way in and may polish the wording on the way out, and both have complete deterministic fallbacks.

> Live: **[claimdesk-chi.vercel.app](https://claimdesk-chi.vercel.app/demo)**

## The four stages

Every claim takes the same path, and the product shows all four stages on every result — compactly for a shopper, expanded in the agent console, and in full on each demo case file.

| Stage | What happens | What you see |
|---|---|---|
| **1 · Evidence** | Read the click, order, cashback and retailer records | Every field the rules can read, grouped by source. Records that do not exist are stated, not omitted — an absent click row is what `NO_CLICK_RECORDED` fires on |
| **2 · Rules** | Walk 13 rules in precedence order until one matches | All 13 with their position, outcome and the evidence value each read. Rules below the match are marked `not reached`, so the short-circuit is visible rather than inferred |
| **3 · Diagnosis** | One code, with confidence | The code, its plain-language label and the cause |
| **4 · Action** | Answer, credit, question or escalation | What the system did, with goodwill policy checks itemised and the network packet shown for escalations |

A worked example of stage 2, from a returned order:

```text
01  ORDER_CANCELLED_OR_RETURNED   Order status is returned.                  Matched
    ───────────── Evaluation stopped here ─────────────
02  EXCLUDED_CATEGORY             Not evaluated — ORDER_CANCELLED_OR_…       Not reached
03  WITHIN_TRACKING_SLA           Not evaluated — ORDER_CANCELLED_OR_…       Not reached
```

Cancellation and exclusion deliberately outrank timing. The engine never tells a shopper to wait for cashback that cannot arrive.

## A four-minute review

Start at `/demo`, which lists ten case files. Each opens the complete case: the message as written, what was parsed from it, which orders the matcher considered and which constraint rejected each one, the four stages, and the exact reply sent back. Case files run the real engine over the seeded evidence and write nothing.

1. **Gift card** — a retailer terms clause cited by the rule that read it.
2. **Real failure** — clean evidence, escalated with a drafted network packet.
3. **Wrong retailer** — deliberately messy input, and the constraint that rejects it.
4. **Impact** — the projection, its arithmetic and its assumptions.

Eight of the ten carry sample artifacts — order emails, a terms clause, session logs, referral headers. These are illustrative of where a field comes from; they are **not** engine inputs. The rules read the structured records.

## Diagnosis taxonomy

| Code | Evidence test | Product route |
|---|---|---|
| `WITHIN_TRACKING_SLA` | Click and order exist; click is still inside the retailer SLA | Auto-resolve with exact due time |
| `PENDING_CONFIRMATION_WINDOW` | Cashback is pending; delivered order is inside the confirmation window | Auto-resolve with exact date |
| `ORDER_CANCELLED_OR_RETURNED` | Order is cancelled or returned | Auto-resolve; explain reversal |
| `EXCLUDED_CATEGORY` | Order category appears in retailer exclusions | Auto-resolve; name category and terms |
| `NO_CLICK_RECORDED` | No eligible pre-order click exists | Auto-resolve with cause and prevention |
| `REFERRER_STRIPPED` | Click exists without intact referral data | Auto-resolve; evaluate goodwill |
| `NATIVE_APP_HANDOFF` | Native handoff on a known broken deep link | Auto-resolve; evaluate goodwill |
| `COUPON_ATTRIBUTION_LOSS` | External coupon conflicts with stacking policy | Auto-resolve; explain attribution |
| `SESSION_EXPIRED` | Purchase more than 24 hours after the click | Auto-resolve |
| `CART_PRELOADED` | Cart was preloaded and the retailer disallows it | Auto-resolve |
| `ACCOUNT_MISMATCH` | Ordering email differs from account email | Ask one question, then human verification |
| `GENUINE_TRACKING_FAILURE` | Clean click and order; SLA elapsed; no cashback record | Escalate to affiliate network |
| `INSUFFICIENT_EVIDENCE` | No order can yet be matched | Ask the highest-information question, then rerun |

## Projected impact

**These are projections over synthetic data, not measured results.** Nothing here has been run against a real support queue.

The seeded dataset is 60 claims across 25 synthetic users and six invented retailers:

| Outcome | Claims | Share |
|---|---:|---:|
| Auto-resolved | 35 | 58.3% |
| Needs one answer | 8 | 13.3% |
| Escalated | 17 | 28.3% |

`/impact` shows the figure as a chain rather than a total, recomputing as the assumptions change, with each claim-count step opening the claims behind it:

```text
60 claims  →  35 auto-resolved  ×  11 min handle time  ×  ₹4 per agent minute  =  ₹1,540
```

Both multipliers are **assumptions, stated as such on the page**:

- **11 minutes average handle time** — assumed, not measured. A mid-range guess for opening a claim, pulling logs, checking terms and writing a reply.
- **₹4 per agent minute** — assumed, not quoted. A round fully-loaded rate, near ₹45 for an 11-minute claim.

Only claims whose persisted status is `resolved` count. Clarifications and escalations earn no deflection credit. Live counts drift above the seeded 60 as demo claims are submitted.

### What would change this in production

- **Real claims are messier than seeded ones.** Every seeded claim names a retailer and either a date or a value. Real free text is vaguer and sometimes covers several orders, so more claims would land in the clarification loop and the auto-resolved count would fall.
- **`GENUINE_TRACKING_FAILURE` is a residual bucket.** It fires when nothing else does. On real network data it would fragment into reporting lag, retailer feed gaps and genuinely dropped transactions, each with a different route and cost.
- **Handle time is not flat.** One number is applied to every deflected claim. A "still inside the SLA" reply is cheap and an account-mismatch verification is not, so the mix of codes matters as much as the count.

## Known limitations

- Seeded evidence is written relative to the time the seed runs, so scenarios keyed to a short window age out of it. Run `npm run seed` before a review; case files state it plainly when aged evidence has moved a scenario off its intended code.
- When a shopper names the wrong retailer, the gap is the retailer, but the question set for `INSUFFICIENT_EVIDENCE` only offers the order date, so the engine asks about the date. A retailer question is the right next change and is not in this build.

## What I would instrument in production

- Claim reopen rate by diagnosis code, especially after auto-resolution.
- Goodwill-credit approval, exception and abuse rates by user cohort.
- CSAT for auto-resolved, clarified and human-resolved claims.
- Order-match precision, and how often agents override a diagnosis.
- Network acceptance rate and ageing for genuine tracking failures.
- Drop-off and time-to-answer for each clarifying question.

## What I would build next

1. Shadow-mode evaluation against historical claims, with agent override reasons.
2. Signed retailer and network adapters, with an auditable claim-submission state machine.
3. Reopen handling that treats disagreement as new evidence, not user error.
4. Abuse controls for goodwill credits and account-mismatch verification.
5. Rule-version reporting, so any decision can be reproduced after a policy change.

## Run locally

1. Run `supabase/migrations/20260820000000_initial_schema.sql` in a Supabase project.
2. Copy `.env.example` to `.env.local` and add the public Supabase values, the seed-only service-role values and an optional `GROQ_API_KEY`. Never commit this file.
3. Run `npm install`, `npm run seed`, then `npm run dev`.
4. Before deploying: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.

`npm run seed -- --dry-run` validates the exact seed mix without writing. `npm run seed -- --reset-claims` removes non-seed synthetic claims and restores the deterministic 60.

## Independence and provenance

**ClaimDesk is an independent prototype built entirely on synthetic data. It is unaffiliated with and not endorsed by any company.** All retailer names, people, transactions and evidence are invented. The failure modes are inferred from public affiliate-tracking documentation and common web-attribution mechanics, not from any internal company knowledge. No company logo, trademark or brand colour is used.
