const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

function loadTypescript(relativePath) {
  const filename = path.join(__dirname, "..", relativePath);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const module = { exports: {} };
  new Function("module", "exports", "require", compiled.outputText)(
    module,
    module.exports,
    require,
  );
  return module.exports;
}

const { businessCardStats, isDiscoverableBusiness } = loadTypescript(
  "src/lib/discoveryBusiness.ts",
);
const { isPublicBusinessBookable } = loadTypescript(
  "src/lib/server/publicBusinessReadiness.ts",
);
const {
  canonicalDiscoveryCity,
  matchesDiscoveryCity,
  matchesDiscoverySearch,
  discoveryServerSearchTerm,
} = loadTypescript("src/lib/discoverySearch.ts");

test("a group-only business needs a departure, not appointment staff or hours", () => {
  const services = [{ id: "tour", active: true, booking_type: "group" }];
  assert.equal(
    isPublicBusinessBookable(services, [], [], new Set(["tour"])),
    true,
  );
  assert.equal(isPublicBusinessBookable(services, [], [], new Set()), false);
  const business = {
    published: true,
    bookable: true,
    services: [{ ...services[0], has_available_departures: true }],
  };
  assert.equal(isDiscoverableBusiness(business), true);
  assert.equal(businessCardStats(business).scheduledServices, 1);
  assert.equal(businessCardStats(business).activeStaff, 0);
});

test("ordinary appointments retain staff, assignment and hours requirements", () => {
  const services = [
    {
      id: "cut",
      active: true,
      booking_type: "appointment",
      staff_services: [{ staff_member_id: "staff" }],
    },
  ];
  const staff = [{ id: "staff", active: true }];
  const hours = [{ is_closed: false }];
  assert.equal(isPublicBusinessBookable(services, staff, hours), true);
  assert.equal(isPublicBusinessBookable(services, [], hours), false);
  assert.equal(isPublicBusinessBookable(services, staff, []), false);
  assert.equal(
    isPublicBusinessBookable([{ ...services[0], active: false }], staff, hours),
    false,
  );
});

test("the client respects public readiness and never exposes hidden or unready businesses", () => {
  assert.equal(
    isDiscoverableBusiness({ published: false, bookable: true }),
    false,
  );
  assert.equal(
    isDiscoverableBusiness({ published: true, bookable: false }),
    false,
  );
  assert.equal(isDiscoverableBusiness({ published: true }), false);
});

test("mixed service cards count available departures and assigned appointments separately", () => {
  const stats = businessCardStats({
    services: [
      {
        id: "tour",
        active: true,
        booking_type: "group",
        has_available_departures: true,
        staff_services: [{ staff_member_id: "staff" }],
      },
      {
        id: "sold-out",
        active: true,
        booking_type: "group",
        has_available_departures: false,
      },
      {
        id: "cut",
        active: true,
        staff_services: [{ staff_member_id: "staff" }],
      },
      {
        id: "disabled",
        active: false,
        staff_services: [{ staff_member_id: "staff" }],
      },
    ],
    staff_members: [{ id: "staff", active: true }],
  });
  assert.equal(stats.assignedServices, 1);
  assert.equal(stats.scheduledServices, 1);
});

test("city spelling accepts English, Albanian and accent-free input without cross-city matches", () => {
  for (const name of ["Tirana", "Tirane", "Tiranë", " TIRANA "]) {
    assert.equal(canonicalDiscoveryCity(name), "Tiranë");
    assert.equal(matchesDiscoveryCity("Tiranë", name), true);
  }
  assert.equal(matchesDiscoveryCity("Durrës", "Durres"), true);
  assert.equal(matchesDiscoveryCity("Vlorë", "Vlora"), true);
  assert.equal(matchesDiscoveryCity("Tiranë", "Saranda"), false);
});

test("named place queries retain accents for database matching", () => {
  assert.equal(discoveryServerSearchTerm("Çimi Stil Unik"), "Çimi Stil Unik");
  assert.equal(discoveryServerSearchTerm("Dhërmi"), "Dhërmi");
  assert.equal(
    matchesDiscoverySearch("Çimi Stil Unik", "cimi stil unik"),
    true,
  );
  assert.equal(matchesDiscoverySearch("Boat trip", "varkë"), true);
});
