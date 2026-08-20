import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const seedDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.dirname(seedDirectory);
const now = new Date();

const AUTO_RESOLVE_CODES = new Set([
  "WITHIN_TRACKING_SLA",
  "PENDING_CONFIRMATION_WINDOW",
  "ORDER_CANCELLED_OR_RETURNED",
  "EXCLUDED_CATEGORY",
  "NO_CLICK_RECORDED",
  "REFERRER_STRIPPED",
  "NATIVE_APP_HANDOFF",
  "COUPON_ATTRIBUTION_LOSS",
  "SESSION_EXPIRED",
  "CART_PRELOADED",
]);

const NEEDS_INPUT_CODES = new Set([
  "ACCOUNT_MISMATCH",
  "INSUFFICIENT_EVIDENCE",
]);

const DEVICE_ROTATION = ["desktop", "mweb", "android_app", "ios_app"];

function needsGoodwillHumanReview(scenario) {
  return (
    ["REFERRER_STRIPPED", "NATIVE_APP_HANDOFF"].includes(
      scenario.diagnosis,
    ) && scenario.value > 2_000
  );
}

function deterministicUuid(value) {
  const bytes = createHash("sha256").update(`claimdesk:${value}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function hoursAgo(hours) {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function daysAgo(days) {
  return hoursAgo(days * 24);
}

async function readJson(filename) {
  return JSON.parse(await readFile(path.join(seedDirectory, filename), "utf8"));
}

async function loadLocalEnvironment() {
  try {
    const contents = await readFile(path.join(projectDirectory, ".env.local"), "utf8");
    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const equalsAt = line.indexOf("=");
      if (equalsAt < 1) continue;
      const key = line.slice(0, equalsAt).trim();
      let value = line.slice(equalsAt + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function assertUnique(items, label) {
  const keys = items.map((item) => item.key ?? `${item.code}:${item.retailer}`);
  if (new Set(keys).size !== keys.length) {
    throw new Error(`${label} contains duplicate seed keys.`);
  }
}

function resolutionFor(scenario, retailer) {
  switch (scenario.diagnosis) {
    case "WITHIN_TRACKING_SLA":
      return `This order is still inside ${retailer.name}'s ${retailer.trackingSlaHours}-hour tracking window.`;
    case "PENDING_CONFIRMATION_WINDOW":
      return `The cashback is pending while ${retailer.name} completes its ${retailer.confirmationWindowDays}-day confirmation window.`;
    case "ORDER_CANCELLED_OR_RETURNED":
      return "Cashback reverses when the underlying order is cancelled or returned.";
    case "EXCLUDED_CATEGORY":
      return `${scenario.category} is excluded from cashback under this retailer's terms.`;
    case "NO_CLICK_RECORDED":
      return "No eligible click reached the tracking log before this order.";
    case "REFERRER_STRIPPED":
      return "The click arrived without the referral data needed for attribution.";
    case "NATIVE_APP_HANDOFF":
      return "The retailer app handoff broke attribution on a known deep-link issue.";
    case "COUPON_ATTRIBUTION_LOSS":
      return "The external coupon provider became the final referring source at checkout.";
    case "SESSION_EXPIRED":
      return "The purchase happened more than 24 hours after the tracked click.";
    case "CART_PRELOADED":
      return "The basket was created before the tracked visit, which this retailer excludes.";
    default:
      return null;
  }
}

function buildScenarioRows(scenario, index, usersByKey, retailersByKey) {
  const user = usersByKey.get(scenario.user);
  const retailer = retailersByKey.get(scenario.retailer);
  if (!user || !retailer) {
    throw new Error(`Unknown user or retailer in scenario ${scenario.key}.`);
  }

  const claimId = deterministicUuid(`claim:${scenario.key}`);
  const clickId = deterministicUuid(`click:${scenario.key}`);
  const orderId = deterministicUuid(`order:${scenario.key}`);
  const orderTimestamp = hoursAgo(scenario.ageHours);
  const clickLeadHours = scenario.clickLeadHours ?? 0.35;
  const clickTimestamp = new Date(
    new Date(orderTimestamp).getTime() - clickLeadHours * 60 * 60 * 1000,
  ).toISOString();
  const hasClick = scenario.diagnosis !== "NO_CLICK_RECORDED";
  const inputNeeded = NEEDS_INPUT_CODES.has(scenario.diagnosis);
  const networkEscalation = scenario.diagnosis === "GENUINE_TRACKING_FAILURE";
  const goodwillHumanReview = needsGoodwillHumanReview(scenario);
  const escalated = networkEscalation || goodwillHumanReview;
  const category = scenario.category ?? ["Apparel", "Electronics", "Home", "Books"][index % 4];
  const orderStatus = scenario.orderStatus ??
    (scenario.diagnosis === "WITHIN_TRACKING_SLA" ? "placed" : "delivered");
  const rawText = scenario.rawText ??
    `My ${retailer.name} order for ₹${scenario.value.toLocaleString("en-IN")} has not tracked.`;
  const platformClickId = `clk_${createHash("sha1").update(scenario.key).digest("hex").slice(0, 12)}`;

  const click = hasClick
    ? {
        id: clickId,
        user_id: user.id,
        retailer_id: retailer.id,
        clicked_at: clickTimestamp,
        click_id: platformClickId,
        device:
          scenario.diagnosis === "NATIVE_APP_HANDOFF"
            ? index % 2 === 0 ? "android_app" : "ios_app"
            : DEVICE_ROTATION[index % DEVICE_ROTATION.length],
        handoff_to_native_app: scenario.diagnosis === "NATIVE_APP_HANDOFF",
        referrer_intact: scenario.diagnosis !== "REFERRER_STRIPPED",
        cart_preloaded: scenario.diagnosis === "CART_PRELOADED",
      }
    : null;

  const order = {
    id: orderId,
    user_id: user.id,
    retailer_id: retailer.id,
    ordered_at: orderTimestamp,
    order_value: scenario.value,
    category,
    status: orderStatus,
    coupon_code_used:
      scenario.diagnosis === "COUPON_ATTRIBUTION_LOSS" ? scenario.couponCode : null,
    email_used:
      scenario.diagnosis === "ACCOUNT_MISMATCH" ? scenario.orderEmail : user.email,
  };

  let cashbackRecord = null;
  if (scenario.diagnosis === "PENDING_CONFIRMATION_WINDOW") {
    cashbackRecord = {
      id: deterministicUuid(`cashback:${scenario.key}`),
      click_id: clickId,
      order_id: orderId,
      status: "pending",
      amount: Math.round(scenario.value * 0.03 * 100) / 100,
      reported_at: hoursAgo(scenario.ageHours - 2),
    };
  } else if (scenario.diagnosis === "ORDER_CANCELLED_OR_RETURNED") {
    cashbackRecord = {
      id: deterministicUuid(`cashback:${scenario.key}`),
      click_id: clickId,
      order_id: orderId,
      status: "cancelled",
      amount: 0,
      reported_at: hoursAgo(Math.max(scenario.ageHours - 3, 1)),
    };
  }

  const escalationPacket = networkEscalation
    ? {
        caseId: `NET-${claimId.slice(0, 8).toUpperCase()}`,
        retailer: retailer.name,
        clickId: platformClickId,
        orderedAt: orderTimestamp,
        orderValue: scenario.value,
        evidenceSummary: [
          "Click recorded with intact referrer",
          "Order matched to user, retailer, date and value",
          `${retailer.trackingSlaHours}-hour tracking SLA elapsed`,
          "No cashback record returned",
        ],
        requestedAction: "Validate transaction and create the missing cashback record.",
      }
    : goodwillHumanReview
      ? {
          caseId: `HUM-${claimId.slice(0, 8).toUpperCase()}`,
          diagnosisCode: scenario.diagnosis,
          retailer: retailer.name,
          recommendation:
            "Route to a human with a goodwill-credit recommendation and the failed policy checks.",
          policyChecks: [
            {
              id: "platform_cause",
              label: "Platform-side cause",
              passed: true,
              evidence: `${scenario.diagnosis} is an eligible platform-side cause.`,
            },
            {
              id: "claim_value",
              label: "Claimed value at or below ₹2,000",
              passed: false,
              evidence: `Claimed value is ₹${scenario.value.toLocaleString("en-IN")}.`,
            },
            {
              id: "recent_credit_count",
              label: "No more than 2 prior credits in 90 days",
              passed: true,
              evidence: "0 goodwill credits were awarded in the last 90 days.",
            },
          ],
          requestedAction:
            "Review the failed claim-value check and decide whether to make a goodwill exception.",
        }
      : null;

  const claim = {
    id: claimId,
    user_id: user.id,
    raw_text: rawText,
    submitted_at: hoursAgo(Math.max(scenario.ageHours - 1, 0.2)),
    claimed_order_value: scenario.omitClaimValue ? null : scenario.value,
    claimed_retailer_id: retailer.id,
    claimed_order_date: scenario.omitClaimDate ? null : orderTimestamp,
    status: inputNeeded ? "needs_input" : escalated ? "escalated" : "resolved",
    diagnosis_code: scenario.diagnosis,
    confidence: inputNeeded ? 0.58 : escalated ? 0.98 : 0.96,
    resolution_text: AUTO_RESOLVE_CODES.has(scenario.diagnosis) && !escalated
      ? resolutionFor(scenario, retailer)
      : null,
    clarifying_question:
      scenario.diagnosis === "ACCOUNT_MISMATCH"
        ? "Which email address did you use for this order?"
        : scenario.diagnosis === "INSUFFICIENT_EVIDENCE"
          ? "When did you place the order?"
          : null,
    clarifying_answer: null,
    escalation_packet: escalationPacket,
    resolved_at: AUTO_RESOLVE_CODES.has(scenario.diagnosis) && !escalated
      ? hoursAgo(Math.max(scenario.ageHours - 1.1, 0.1))
      : null,
  };

  return { click, order, cashbackRecord, claim };
}

async function buildSeedData() {
  const [userFixtures, retailerFixtures, coupons, scenarios, goodwillHistory, demos] =
    await Promise.all([
      readJson("users.json"),
      readJson("retailers.json"),
      readJson("coupons.json"),
      readJson("claim-scenarios.json"),
      readJson("goodwill-history.json"),
      readJson("demo-scenarios.json"),
    ]);

  assertUnique(userFixtures, "users.json");
  assertUnique(retailerFixtures, "retailers.json");
  assertUnique(scenarios, "claim-scenarios.json");
  assertUnique(goodwillHistory, "goodwill-history.json");
  assertUnique(demos, "demo-scenarios.json");

  if (userFixtures.length !== 25 || retailerFixtures.length !== 6 || scenarios.length !== 60) {
    throw new Error("Seed contract requires 25 users, 6 retailers, and 60 claims.");
  }

  const users = userFixtures.map((user) => ({
    id: deterministicUuid(`user:${user.key}`),
    email: user.email,
    name: user.name,
    signup_date: daysAgo(user.signupDaysAgo),
    lifetime_cashback: user.lifetimeCashback,
    tier: user.tier,
    seedKey: user.key,
  }));
  const retailers = retailerFixtures.map((retailer) => ({
    id: deterministicUuid(`retailer:${retailer.key}`),
    name: retailer.name,
    tracking_sla_hours: retailer.trackingSlaHours,
    confirmation_window_days: retailer.confirmationWindowDays,
    excluded_categories: retailer.excludedCategories,
    allows_coupon_stacking: retailer.allowsCouponStacking,
    allows_cart_preloading: retailer.allowsCartPreloading,
    known_deeplink_issue: retailer.knownDeeplinkIssue,
    terms_url: retailer.termsUrl,
    seedKey: retailer.key,
  }));
  const usersByKey = new Map(users.map((user) => [user.seedKey, user]));
  const retailersByKey = new Map(retailers.map((retailer) => [retailer.seedKey, retailer]));
  const scenarioRows = scenarios.map((scenario, index) =>
    buildScenarioRows(scenario, index, usersByKey, retailersByKey),
  );

  const diagnosisCounts = Object.fromEntries(
    [...new Set(scenarios.map((scenario) => scenario.diagnosis))].map((code) => [
      code,
      scenarios.filter((scenario) => scenario.diagnosis === code).length,
    ]),
  );
  const autoResolved = scenarios.filter(
    (scenario) =>
      AUTO_RESOLVE_CODES.has(scenario.diagnosis) &&
      !needsGoodwillHumanReview(scenario),
  ).length;
  const needsInput = scenarios.filter((scenario) => NEEDS_INPUT_CODES.has(scenario.diagnosis)).length;
  const escalated = scenarios.length - autoResolved - needsInput;

  if (autoResolved !== 35 || needsInput !== 8 || escalated !== 17) {
    throw new Error("Seed distribution must remain 35 auto-resolved, 8 needs-input, 17 escalated.");
  }
  for (const demo of demos) {
    const scenario = scenarios.find((candidate) => candidate.key === demo.key);
    if (!scenario || scenario.diagnosis !== demo.expectedCode) {
      throw new Error(`Demo scenario ${demo.key} does not match ${demo.expectedCode}.`);
    }
  }

  return {
    summary: {
      users: users.length,
      retailers: retailers.length,
      claims: scenarios.length,
      autoResolved,
      needsInput,
      escalated,
      diagnosisCounts,
    },
    users: users.map((user) => {
      const row = { ...user };
      delete row.seedKey;
      return row;
    }),
    retailers: retailers.map((retailer) => {
      const row = { ...retailer };
      delete row.seedKey;
      return row;
    }),
    clicks: scenarioRows.flatMap((row) => row.click ? [row.click] : []),
    orders: scenarioRows.map((row) => row.order),
    cashbackRecords: scenarioRows.flatMap((row) =>
      row.cashbackRecord ? [row.cashbackRecord] : [],
    ),
    claims: scenarioRows.map((row) => row.claim),
    platformCoupons: coupons.map((coupon) => ({
      code: coupon.code,
      retailer_id: retailersByKey.get(coupon.retailer).id,
      active: true,
    })),
    goodwillCredits: goodwillHistory.map((credit) => ({
      id: deterministicUuid(`goodwill:${credit.key}`),
      user_id: usersByKey.get(credit.user).id,
      claim_id: null,
      amount: credit.amount,
      awarded_at: daysAgo(credit.daysAgo),
      reason_code: credit.reason,
    })),
  };
}

async function upsertRows(supabase, table, rows, options = {}) {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows, options);
  if (error) throw new Error(`Could not seed ${table}: ${error.message}`);
}

async function main() {
  const data = await buildSeedData();
  const dryRun = process.argv.includes("--dry-run");
  const resetClaims = process.argv.includes("--reset-claims");

  if (dryRun) {
    console.log(JSON.stringify(data.summary, null, 2));
    console.log("Seed validation passed; no database writes were made.");
    return;
  }

  await loadLocalEnvironment();
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, or run npm run seed -- --dry-run.",
    );
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (resetClaims) {
    const seededClaimIds = new Set(data.claims.map((claim) => claim.id));
    const existingClaims = await supabase.from("claims").select("id");
    if (existingClaims.error) {
      throw new Error(`Could not inspect claims before reset: ${existingClaims.error.message}`);
    }
    const extraClaimIds = (existingClaims.data ?? [])
      .map((claim) => claim.id)
      .filter((claimId) => !seededClaimIds.has(claimId));
    if (extraClaimIds.length > 0) {
      const removal = await supabase.from("claims").delete().in("id", extraClaimIds);
      if (removal.error) {
        throw new Error(`Could not reset synthetic test claims: ${removal.error.message}`);
      }
    }
    console.log(`Removed ${extraClaimIds.length} non-seed synthetic test claims.`);
  }
  await upsertRows(supabase, "users", data.users);
  await upsertRows(supabase, "retailers", data.retailers);
  await upsertRows(supabase, "platform_coupons", data.platformCoupons, {
    onConflict: "code,retailer_id",
  });
  await upsertRows(supabase, "clicks", data.clicks);
  await upsertRows(supabase, "orders", data.orders);
  await upsertRows(supabase, "cashback_records", data.cashbackRecords);
  await upsertRows(supabase, "claims", data.claims);
  await upsertRows(supabase, "goodwill_credits", data.goodwillCredits);

  console.log(
    `Seeded ${data.summary.claims} claims across ${data.summary.retailers} retailers and ${data.summary.users} users.`,
  );
  console.log(
    `Distribution: ${data.summary.autoResolved} auto-resolved, ${data.summary.needsInput} needs input, ${data.summary.escalated} escalated.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Seed failed.");
  process.exitCode = 1;
});
