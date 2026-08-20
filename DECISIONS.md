# Product and implementation decisions

This file records choices that were necessary to keep the prototype internally
consistent. It is not a backlog.

## 2026-08-20 — Isolate ClaimDesk in a subdirectory

The supplied workspace already contained a tracked Next.js product. ClaimDesk
lives in `claimdesk/` to avoid overwriting unrelated work. Vercel should use
`claimdesk` as the project root directory.

## 2026-08-20 — Add three small supporting data structures

The brief's core tables do not contain enough information to evaluate two stated
policies. The schema therefore adds:

- `retailers.allows_cart_preloading`, because `CART_PRELOADED` depends on a
  retailer-specific permission that is otherwise absent.
- `platform_coupons`, because `COUPON_ATTRIBUTION_LOSS` requires a known coupon
  set.
- `goodwill_credits`, because the 90-day frequency cap needs an auditable ledger.

`retailers.terms_url` is also included so excluded-category explanations can link
to a concrete terms page. All links are invented and use `example.com`.

## 2026-08-20 — Anonymous prototype access is synthetic-data only

There is no authentication by design. Row-level security permits anonymous reads
of the synthetic evidence tables and anonymous claim creation/update, while
deletes and reference-data writes remain unavailable. The service-role key is
used only by the local seed script.

## 2026-08-20 — Vague claims may ask for the order date

The named “Vague” demo must resolve after one question, but the listed candidate
questions omit order date/value even though those are the missing match keys. The
question selector will include “When did you place the order?” as a candidate.
One approximate date is sufficient to match against the user's retailer events;
the user does not have to supply a second field.

## 2026-08-20 — Order matching accepts honest intake imprecision

A claim is matched only after user and retailer filtering. An approximate order
date may differ by up to 36 hours, and an approximate value may differ by the
greater of ₹50 or 5%. At least a date or value is required. Candidates are ranked
by the normalised date and value difference, which keeps matching deterministic
while accommodating phrases such as “Tuesday” and “about ₹2,400”.

## 2026-08-20 — An old click is not the same as no click

The literal `NO_CLICK_RECORDED` wording overlaps `SESSION_EXPIRED`: a click older
than 24 hours is also absent from the 24-hour window. To keep both taxonomy codes
reachable, `NO_CLICK_RECORDED` means no pre-order click exists, while an existing
pre-order click older than 24 hours is `SESSION_EXPIRED`. This is encoded and
covered by a regression test.

## 2026-08-20 — A missing AI key is a supported operating mode

When `GROQ_API_KEY` is absent, intake uses the deterministic parser and
every diagnosis uses its complete template. This keeps the prototype usable in
local review and during provider outages. If a configured AI call returns
malformed data, the product instead asks for only retailer, date and value in a
focused manual fallback; it never guesses fields or lets the model choose a
diagnosis. The result view labels which parser and copy path were used so this
boundary is reviewable rather than implicit.

## 2026-08-20 — Use Groq for the prototype AI edge

The initial Anthropic adapter was replaced with Groq after choosing a zero-cost
API for the deployed prototype. Groq's free plan is sufficient for a short
review session, and `openai/gpt-oss-20b` supports strict JSON-schema output.
The adapter still validates parsed output with Zod, keeps all diagnosis logic in
the deterministic engine, and falls back completely when the key or provider is
unavailable.

## 2026-08-20 — One confirmed account mismatch goes to a human

`ACCOUNT_MISMATCH` needs one factual confirmation, but repeating the same email
question after the user answers would create a dead end. Once the ordering email
is supplied, the diagnosis code remains `ACCOUNT_MISMATCH` and the disposition
changes deterministically to `escalate_human`. The case packet carries both
emails, the matched order, the answer and the rule trace so a specialist can
verify ownership. If an order date still cannot produce an evidence match, the
claim also routes to a human rather than asking the same question twice.

## 2026-08-20 — Seed two visible goodwill-policy exceptions

Two platform-side cases exceed the written ₹2,000 auto-approval ceiling and
therefore arrive in the agent queue with one failed policy check. This moves the
seed mix from 37/8/15 to 35 auto-resolved, 8 needs-input and 17 escalated claims,
which remains inside the target ranges while making the policy reasoning
inspectable without requiring a reviewer to invent a special claim.

## 2026-08-20 — Impact savings are conservative and point-in-time

The impact dashboard counts only persisted `resolved` claims as avoided human
touches. Claims awaiting clarification receive no savings credit, and escalated
claims remain operational work. The ₹45 cost and 11-minute handle time are
editable assumptions applied to the current live claim set; the result is not
monthly or annualised and is labelled as an estimate rather than booked savings.

## 2026-08-20 — Demo launches bind to evidence, not canned answers

Each `/demo` link selects the scenario's synthetic user and supplies only the
same intake fields a parser would extract. The diagnosis still runs through the
production rule engine. The “Vague” order is seeded 10 hours old so its missing
date first produces `INSUFFICIENT_EVIDENCE`, while the single date answer can
honestly match the order and resolve inside the tracking SLA.

Generated resolution copy is rejected when it invents a completed credit or a
review deadline. In those cases the UI deliberately shows the rule template;
provider fluency never outranks policy accuracy.
