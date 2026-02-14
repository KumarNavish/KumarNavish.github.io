import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DATA_ROOT = path.join(ROOT, "public", "data");
const DATASET_ROOT = path.join(DATA_ROOT, "datasets");

const PROCESS_DEFINITIONS = [
  {
    process_id: "access_request",
    display_name: "Access Entitlement Change",
    description:
      "Handle joiner/mover/leaver access changes for BIS internal policy, risk, and operations platforms.",
    required_fields: [
      "subject_user",
      "system_name",
      "access_level",
      "justification",
      "manager_approval",
    ],
    default_owner_role: "identity_governance_analyst",
    default_sla_hours: 12,
    required_approvals: ["line_manager", "application_owner"],
  },
  {
    process_id: "vendor_onboarding",
    display_name: "Third-Party Due Diligence Intake",
    description:
      "Screen, assess, and onboard external vendors with sanctions, security, and compliance checks for BIS operations.",
    required_fields: [
      "vendor_name",
      "country",
      "service_scope",
      "security_review_ticket",
      "tax_form_status",
    ],
    default_owner_role: "third_party_risk_analyst",
    default_sla_hours: 72,
    required_approvals: ["procurement_owner", "information_security", "compliance_officer"],
  },
  {
    process_id: "purchase_request",
    display_name: "Policy-Compliant Procurement Request",
    description: "Route BIS spend requests through budget, procurement, and policy controls.",
    required_fields: [
      "requester_department",
      "item_description",
      "estimated_cost_usd",
      "budget_code",
      "preferred_supplier",
    ],
    default_owner_role: "procurement_operations",
    default_sla_hours: 48,
    required_approvals: ["budget_owner", "procurement_owner"],
  },
  {
    process_id: "incident_escalation",
    display_name: "Critical Operations Incident Escalation",
    description:
      "Escalate high-impact BIS internal service incidents with clear ownership, severity, and SLA controls.",
    required_fields: [
      "incident_id",
      "severity",
      "service_name",
      "customer_impact",
      "oncall_owner",
    ],
    default_owner_role: "operations_incident_manager",
    default_sla_hours: 2,
    required_approvals: ["operations_oncall", "service_owner"],
  },
];

const STREAM_SCHEDULE = [
  { step: 1, process_id: "access_request", drift: false },
  { step: 2, process_id: "purchase_request", drift: false },
  {
    step: 3,
    process_id: "vendor_onboarding",
    drift: true,
    drift_profile: "policy_synonym_shift",
  },
  {
    step: 4,
    process_id: "incident_escalation",
    drift: true,
    drift_profile: "urgency_shift",
  },
];

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

function pick(rand, values) {
  return values[Math.floor(rand() * values.length)];
}

function roundHundreds(value) {
  return Math.round(value / 100) * 100;
}

function riskFor(processId, index) {
  const patterns = {
    access_request: ["low", "medium", "medium", "high"],
    vendor_onboarding: ["medium", "medium", "high", "high"],
    purchase_request: ["low", "low", "medium", "high"],
    incident_escalation: ["high", "high", "medium", "high"],
  };
  return patterns[processId][index % patterns[processId].length];
}

function buildAccessExample(rand, index, split) {
  const user = pick(rand, [
    "A. Meier",
    "J. Keller",
    "L. Weber",
    "R. Schmid",
    "T. Baumann",
    "M. Fischer",
    "E. Vogel",
    "S. Dubois",
  ]);
  const systems = [
    "Policy Briefing Workspace",
    "BIS Data Hub",
    "Control Evidence Vault",
    "Reserve Monitoring Dashboard",
  ];
  const levels = ["read", "editor", "approver", "admin"];
  const teams = ["monetary_and_economic", "banking_operations", "risk_control", "legal_compliance"];
  const justification = pick(rand, [
    "Monetary Policy Committee briefing preparation",
    "Basel process control evidence review",
    "quarterly risk governance reporting",
    "high-priority incident coordination",
  ]);
  const system = pick(rand, systems);
  const level = pick(rand, levels);
  const team = pick(rand, teams);
  const risk = riskFor("access_request", index);

  return {
    id: `access_request-${split}-${String(index + 1).padStart(3, "0")}`,
    process_id: "access_request",
    request_text: `Please request ${level} access for ${user} in ${system} for ${team} to support ${justification}.`,
    risk_tag: risk,
    target: {
      plan_version: "1.0",
      process_id: "access_request",
      title: `Provision ${level} access in ${system}`,
      owner_role: "identity_governance_analyst",
      sla_hours: 12,
      risk_tag: risk,
      approvals: ["line_manager", "application_owner"],
      required_fields: {
        subject_user: user,
        system_name: system,
        access_level: level,
        justification,
        manager_approval: "pending",
      },
      next_actions: [
        "Validate user identity and employment status",
        "Create entitlement change ticket in IAM queue",
        "Notify requester and log approval evidence",
      ],
      controls: ["SoD check", "Manager authorization", "Quarterly recertification"],
    },
  };
}

function buildVendorExample(rand, index, split) {
  const vendors = [
    "Helios Market Data Services",
    "Alpine Risk Analytics",
    "Nordic Compliance Support",
    "Arcadia Cloud Security Operations",
  ];
  const countries = ["US", "DE", "IN", "CH", "SG", "GB"];
  const scopes = [
    "market data feed support",
    "cyber monitoring services",
    "document processing for policy workflows",
    "cloud compliance monitoring",
  ];
  const taxStatus = ["w9_received", "w8ben_required", "pending_submission"];
  const vendor = pick(rand, vendors);
  const country = pick(rand, countries);
  const scope = pick(rand, scopes);
  const reviewTicket = `VR-${String(1200 + Math.floor(rand() * 800))}`;
  const risk = riskFor("vendor_onboarding", index);

  return {
    id: `vendor_onboarding-${split}-${String(index + 1).padStart(3, "0")}`,
    process_id: "vendor_onboarding",
    request_text: `Start due diligence for ${vendor} in ${country} for ${scope}; include sanctions, security, and tax checks for BIS onboarding.`,
    risk_tag: risk,
    target: {
      plan_version: "1.0",
      process_id: "vendor_onboarding",
      title: `Assess and onboard vendor ${vendor}`,
      owner_role: "third_party_risk_analyst",
      sla_hours: 72,
      risk_tag: risk,
      approvals: ["procurement_owner", "information_security", "compliance_officer"],
      required_fields: {
        vendor_name: vendor,
        country,
        service_scope: scope,
        security_review_ticket: reviewTicket,
        tax_form_status: pick(rand, taxStatus),
      },
      next_actions: [
        "Run sanctions and beneficial ownership checks",
        "Complete security questionnaire and data handling review",
        "Record onboarding decision in third-party register",
      ],
      controls: ["Third-party risk tiering", "Data processing addendum", "Tax compliance check"],
    },
  };
}

function buildPurchaseExample(rand, index, split) {
  const departments = ["monetary_and_economic", "banking", "it_services", "communications"];
  const items = [
    "market data terminal license renewal",
    "secure workstation fleet refresh",
    "policy document workflow subscription",
    "compliance archival storage extension",
  ];
  const suppliers = ["Arcadia Tech", "EuroData Supply", "Summit Systems", "Helix Procurement"];
  const budgetCodes = ["BUD-4012", "BUD-7731", "BUD-5590", "BUD-6604", "BUD-7810"];
  const dept = pick(rand, departments);
  const item = pick(rand, items);
  const supplier = pick(rand, suppliers);
  const estimatedCost = roundHundreds(900 + rand() * 11000);
  const risk = riskFor("purchase_request", index);

  return {
    id: `purchase_request-${split}-${String(index + 1).padStart(3, "0")}`,
    process_id: "purchase_request",
    request_text: `Create a procurement request from ${dept} for ${item} via ${supplier}; estimated spend is $${estimatedCost} for BIS operations.`,
    risk_tag: risk,
    target: {
      plan_version: "1.0",
      process_id: "purchase_request",
      title: `Approve ${item} purchase`,
      owner_role: "procurement_operations",
      sla_hours: 48,
      risk_tag: risk,
      approvals: ["budget_owner", "procurement_owner"],
      required_fields: {
        requester_department: dept,
        item_description: item,
        estimated_cost_usd: String(estimatedCost),
        budget_code: pick(rand, budgetCodes),
        preferred_supplier: supplier,
      },
      next_actions: [
        "Validate budget availability",
        "Compare supplier quote against procurement policy thresholds",
        "Issue purchase order after approvals and audit log",
      ],
      controls: ["Budget limit validation", "Preferred supplier check", "Dual approval policy"],
    },
  };
}

function buildIncidentExample(rand, index, split) {
  const services = [
    "policy-briefing-portal",
    "market-data-ingestion",
    "document-collaboration",
    "internal-auth-gateway",
  ];
  const impacts = [
    "briefing dashboards unavailable for policy teams",
    "elevated login failures for BIS staff",
    "delayed central reporting jobs",
    "intermittent outage in internal operations portal",
  ];
  const oncall = ["ops-oncall-eu", "platform-oncall", "infra-oncall", "security-oncall"];
  const severities = ["sev1", "sev2", "sev3"];
  const service = pick(rand, services);
  const impact = pick(rand, impacts);
  const severity = pick(rand, severities);
  const incidentId = `INC-${String(31000 + Math.floor(rand() * 6000))}`;
  const risk = riskFor("incident_escalation", index);

  return {
    id: `incident_escalation-${split}-${String(index + 1).padStart(3, "0")}`,
    process_id: "incident_escalation",
    request_text: `Escalate ${incidentId} for ${service} due to ${impact}; treat as ${severity} and start major-incident protocol.`,
    risk_tag: risk,
    target: {
      plan_version: "1.0",
      process_id: "incident_escalation",
      title: `Escalate incident ${incidentId}`,
      owner_role: "operations_incident_manager",
      sla_hours: 2,
      risk_tag: risk,
      approvals: ["operations_oncall", "service_owner"],
      required_fields: {
        incident_id: incidentId,
        severity,
        service_name: service,
        customer_impact: impact,
        oncall_owner: pick(rand, oncall),
      },
      next_actions: [
        "Open incident bridge and page internal stakeholders",
        "Assign triage and communications leads",
        "Publish first internal status update",
      ],
      controls: ["Severity rubric enforcement", "Escalation SLA timer", "Post-incident review requirement"],
    },
  };
}

function buildExamples(processId, count, split, rand) {
  const builders = {
    access_request: buildAccessExample,
    vendor_onboarding: buildVendorExample,
    purchase_request: buildPurchaseExample,
    incident_escalation: buildIncidentExample,
  };

  return Array.from({ length: count }, (_, index) =>
    builders[processId](rand, index, split),
  );
}

function main() {
  ensureDir(DATASET_ROOT);

  writeJson(path.join(DATA_ROOT, "processes.json"), {
    version: "1.0",
    processes: PROCESS_DEFINITIONS.map((definition) => ({
      ...definition,
      target_schema: {
        required_keys: [
          "plan_version",
          "process_id",
          "title",
          "owner_role",
          "sla_hours",
          "risk_tag",
          "approvals",
          "required_fields",
          "next_actions",
          "controls",
        ],
        required_fields: definition.required_fields,
      },
    })),
  });

  writeJson(path.join(DATA_ROOT, "stream_schedule.json"), {
    version: "1.0",
    steps: STREAM_SCHEDULE,
  });

  for (const definition of PROCESS_DEFINITIONS) {
    const trainRand = mulberry32(7000 + definition.process_id.length);
    const testRand = mulberry32(9000 + definition.process_id.length);

    const trainExamples = buildExamples(definition.process_id, 40, "train", trainRand);
    const testExamples = buildExamples(definition.process_id, 20, "test", testRand);

    writeJson(
      path.join(DATASET_ROOT, `${definition.process_id}.train.json`),
      trainExamples,
    );
    writeJson(
      path.join(DATASET_ROOT, `${definition.process_id}.test.json`),
      testExamples,
    );
  }

  console.log("Step 3 datasets generated in public/data");
}

main();
