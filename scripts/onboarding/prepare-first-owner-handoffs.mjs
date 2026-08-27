#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const CASE_FILTER =
  process.argv
    .find((argument) => argument.startsWith("--case="))
    ?.slice("--case=".length)
    .trim()
    .toLowerCase() || "";
const OWNER_EMAIL =
  process.argv
    .find((argument) => argument.startsWith("--owner-email="))
    ?.slice("--owner-email=".length)
    .trim()
    .toLowerCase() || "";

function loadLocalEnv() {
  const source = readFileSync(".env.local", "utf8");
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/,
    );
    if (!match) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

loadLocalEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
}

const businessOrigin = (
  process.env.NEXT_PUBLIC_BUSINESS_APP_URL || "https://business.mirebook.com"
).replace(/\/$/, "");
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const plans = [
  {
    caseId: "72fce64d-a5a9-4ff6-858a-9423291ebf3f",
    label: "Emilio's Barber Shop",
    profile: {
      name: "Emilio's Barber Shop",
      description:
        "Berberi dhe studio kujdesi në qendër të Sarandës, me prerje flokësh, kujdes për mjekrën, ngjyrosje, trajtime dhe stilim. Pronari mund t'i kontrollojë dhe ndryshojë të gjitha shërbimet para publikimit.",
      phone: "+355 69 996 3838",
      address: "Lagjja nr. 3, Rruga Onhezmi, Sarandë",
      city: "Sarandë",
      country: "Albania",
      category: "Barber",
      timezone: "Europe/Tirane",
      currency: "ALL",
      ownerTakesBookings: true,
    },
    services: [
      ["Prerje flokësh", 30, 1200],
      ["Rregullim mjekre", 20, 500],
      ["Depilim", 20, 400],
      ["Heqje qimesh me pe", 20, 300],
      ["Trajtim fytyre", 30, 1500],
      ["Ngjyrosje mjekre", 30, 1000],
      ["Ngjyrosje flokësh", 60, 2500],
      ["Flokë kaçurrela / permanent", 90, 5000],
      ["Trajtim keratine", 90, 5000],
      ["Masazh koke", 15, 500],
      ["Masazh fytyre", 15, 700],
    ].map(([name, durationMinutes, price], index) => ({
      id: `emilio-${index + 1}`,
      name,
      description:
        "Kohëzgjatja dhe çmimi janë vlera fillestare dhe duhen konfirmuar nga pronari.",
      durationMinutes,
      price,
      priceKnown: false,
      bookingType: "appointment",
      groupCapacity: null,
      privateBookingEnabled: false,
      privatePrice: null,
    })),
  },
  {
    caseId: "1269f1b2-0f56-4e8f-946c-8ad982a16dd4",
    label: "Toni's Boat Trip",
    profile: {
      name: "Toni's Boat Trip",
      description:
        "Udhëtime me varkë nga Dhërmiu drejt shpellave, Gjipesë, Gjirit të Gramës dhe ndalesave të tjera të bregdetit. Oraret, pika e saktë e nisjes dhe kapaciteti përfundimtar konfirmohen nga operatori para publikimit.",
      phone: "+355 69 395 3337",
      address: "Dhërmi, Albania",
      city: "Dhërmi",
      country: "Albania",
      category: "Tours and activities",
      timezone: "Europe/Tirane",
      currency: "EUR",
      ownerTakesBookings: false,
    },
    services: [
      {
        id: "toni-guide-1",
        name: "Dhërmi Caves & Gjipe Tour",
        description:
          "Rreth 1 orë me Pirate Cave, dy shpella, Gjipe, Pigeon Cave, Jal Cave dhe Secret Tunnel, me dy ndalesa noti. Pronari dha maksimumin 16 persona, grupin nga Dhërmiu 30 për person, privat nga Dhërmiu deri në 6 persona 200 për orë dhe një variant tjetër privat 250 për orë nga një pikë që duhet sqaruar. Monedha, pika e nisjes dhe nëse kapaciteti përfshin ekuipazhin duhen konfirmuar para aktivizimit.",
        durationMinutes: 60,
        price: 30,
        priceKnown: false,
        bookingType: "group",
        groupCapacity: 16,
        privateBookingEnabled: true,
        privatePrice: 200,
      },
      {
        id: "toni-guide-2",
        name: "Grama Bay & Blue Cave Tour",
        description:
          "Minimumi 3 orë: Palasë, St Andrew Bay, Lost Bay, Blue Cave, Grama Bay dhe Secret Cave. Grupi është 50 € për person; udhëtimi privat është 200 € për orë, pra 600 € për minimumin 3-orësh. Oraret dhe itinerari përfundimtar kontrollohen nga pronari.",
        durationMinutes: 180,
        price: 50,
        priceKnown: true,
        bookingType: "group",
        groupCapacity: 16,
        privateBookingEnabled: true,
        privatePrice: 600,
      },
      {
        id: "toni-full-day",
        name: "Private Full-Day Boat Charter",
        description:
          "Udhëtim privat gjithëditor. Kohëzgjatja 8-orëshe është vlerë fillestare dhe duhet konfirmuar para aktivizimit.",
        durationMinutes: 480,
        price: 1700,
        priceKnown: true,
        bookingType: "appointment",
        groupCapacity: null,
        privateBookingEnabled: false,
        privatePrice: null,
      },
    ],
  },
];

const selectedPlans = CASE_FILTER
  ? plans.filter(
      (plan) =>
        plan.caseId.toLowerCase() === CASE_FILTER ||
        plan.label.toLowerCase().includes(CASE_FILTER),
    )
  : plans;

if (selectedPlans.length === 0) {
  throw new Error(`No prepared owner handoff matches --case=${CASE_FILTER}`);
}
if (OWNER_EMAIL && selectedPlans.length !== 1) {
  throw new Error("Use --owner-email only with one explicit --case selection.");
}
if (OWNER_EMAIL && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(OWNER_EMAIL)) {
  throw new Error("Use a valid owner email address.");
}

const { data: cases, error: caseError } = await supabase
  .from("business_onboarding_cases")
  .select("id, prospect_name, created_by, business_id, status")
  .in(
    "id",
    selectedPlans.map((plan) => plan.caseId),
  );
if (caseError) throw caseError;

const caseMap = new Map((cases || []).map((item) => [item.id, item]));
for (const plan of selectedPlans) {
  if (!caseMap.has(plan.caseId))
    throw new Error(`Missing onboarding case: ${plan.label}`);
}

if (!APPLY) {
  console.log(
    JSON.stringify(
      {
        mode: "dry-run",
        safety: {
          publishesBusinesses: false,
          activatesServices: false,
          createsDepartures: false,
          grantsMediaPermission: false,
        },
        plans: selectedPlans.map((plan) => ({
          caseId: plan.caseId,
          business: plan.label,
          ownerEmailSupplied: Boolean(OWNER_EMAIL),
          currency: plan.profile.currency,
          preparedServices: plan.services.length,
          unknownPrices: plan.services.filter((service) => !service.priceKnown)
            .length,
        })),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const results = [];
for (const plan of selectedPlans) {
  const onboardingCase = caseMap.get(plan.caseId);
  const { error: saveError } = await supabase.rpc(
    "mirebook_save_onboarding_profile_draft",
    {
      p_actor_user_id: onboardingCase.created_by,
      p_case_id: plan.caseId,
      p_profile: plan.profile,
      p_services: plan.services,
    },
  );
  if (saveError) throw saveError;

  if (!OWNER_EMAIL) {
    results.push({
      business: plan.label,
      caseId: plan.caseId,
      status: "awaiting-owner-email",
    });
    continue;
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { error: issueError } = await supabase.rpc(
    "mirebook_issue_email_bound_onboarding_handoff",
    {
      p_actor_user_id: onboardingCase.created_by,
      p_case_id: plan.caseId,
      p_owner_email: OWNER_EMAIL,
      p_token_hash: tokenHash,
      p_expires_at: expiresAt,
    },
  );
  if (issueError) throw issueError;

  results.push({
    business: plan.label,
    caseId: plan.caseId,
    status: "email-bound-link-created",
    handoffUrl: `${businessOrigin}/join/${rawToken}`,
    expiresAt,
  });
}

console.log(
  JSON.stringify(
    {
      mode: "apply",
      safety: {
        businessesPublished: 0,
        activeServicesCreated: 0,
        departuresCreated: 0,
        mediaPermissionsChanged: 0,
      },
      results,
    },
    null,
    2,
  ),
);
