#!/usr/bin/env node

const DEFAULT_BASE_URL = "https://mirebook.com";
const REQUEST_TIMEOUT_MS = 15_000;

const baseURL = new URL(
  process.argv[2] ||
    process.env.MIREBOOK_CUSTOMER_API_BASE_URL ||
    DEFAULT_BASE_URL,
);

if (baseURL.protocol !== "https:" && baseURL.hostname !== "localhost") {
  throw new Error("Customer iOS production checks require HTTPS.");
}

const checks = [
  {
    name: "public businesses",
    method: "GET",
    path: "/api/public/explore-businesses",
    expectedStatus: 200,
  },
  {
    name: "public directory",
    method: "GET",
    path: "/api/public/directory-places",
    expectedStatus: 200,
  },
  {
    name: "registration completion",
    method: "POST",
    path: "/api/app/complete-registration",
    expectedStatus: 401,
  },
  {
    name: "customer session context",
    method: "GET",
    path: "/api/customer/app/session-context",
    expectedStatus: 401,
  },
  {
    name: "customer profile",
    method: "POST",
    path: "/api/customer/app/profile",
    expectedStatus: 401,
  },
  {
    name: "customer notifications",
    method: "GET",
    path: "/api/customer/app/notifications",
    expectedStatus: 401,
  },
  {
    name: "customer bookings",
    method: "GET",
    path: "/api/customer/bookings",
    expectedStatus: 401,
  },
  {
    name: "customer booking creation",
    method: "POST",
    path: "/api/customer/app/bookings/create",
    expectedStatus: 401,
  },
  {
    name: "customer booking actions",
    method: "POST",
    path: "/api/customer/app/bookings/actions",
    expectedStatus: 401,
  },
  {
    name: "account deletion",
    method: "DELETE",
    path: "/api/app/account-deletion",
    expectedStatus: 401,
  },
];

async function verify(check) {
  const url = new URL(check.path, baseURL);
  const response = await fetch(url, {
    method: check.method,
    headers: {
      Accept: "application/json",
      ...(check.method === "GET"
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body: check.method === "GET" ? undefined : "{}",
    redirect: "error",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const contentType = response.headers.get("content-type") || "";
  const body = await response.text();

  if (response.status !== check.expectedStatus) {
    throw new Error(
      `${check.method} ${check.path} returned ${response.status}; expected ${check.expectedStatus}`,
    );
  }

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(
      `${check.method} ${check.path} returned non-JSON content (${contentType || "missing content type"})`,
    );
  }

  try {
    JSON.parse(body);
  } catch {
    throw new Error(`${check.method} ${check.path} returned invalid JSON`);
  }

  console.log(
    `PASS ${check.expectedStatus} ${check.method.padEnd(6)} ${check.path} (${check.name})`,
  );
}

const failures = [];

for (const check of checks) {
  try {
    await verify(check);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

if (failures.length > 0) {
  console.error("\nCustomer iOS production contract check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `\nCustomer iOS production contract passed: ${checks.length} routes at ${baseURL.origin}.`,
);
