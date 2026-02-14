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
    display_name: "Access Request",
    description: "Provision, modify, or revoke system access for users.",
    required_fields: [
      "subject_user",
      "system_name",
      "access_level",
      "justification",
      "manager_approval",
    ],
    default_owner_role: "iam_analyst",
    default_sla_hours: 24,
    required_approvals: ["line_manager", "system_owner"],
  },
  {
    process_id: "vendor_onboarding",
    display_name: "Vendor Onboarding",
    description: "Assess and onboard external vendors under security and compliance rules.",
    required_fields: [
      "vendor_name",
      "country",
      "service_scope",
      "security_review_ticket",
      "tax_form_status",
    ],
    default_owner_role: "vendor_risk_analyst",
    default_sla_hours: 72,
    required_approvals: ["procurement_manager", "security_officer"],
  },
  {
    process_id: "purchase_request",
    display_name: "Purchase Request",
    description: "Evaluate and approve internal spending and procurement requests.",
    required_fields: [
      "requester_department",
      "item_description",
      "estimated_cost_usd",
      "budget_code",
      "preferred_supplier",
    ],
    default_owner_role: "procurement_specialist",
    default_sla_hours: 48,
    required_approvals: ["budget_owner", "procurement_lead"],
  },
  {
    process_id: "incident_escalation",
    display_name: "Incident Escalation",
    description: "Escalate incidents by severity and coordinate incident response.",
    required_fields: [
      "incident_id",
      "severity",
      "service_name",
      "customer_impact",
      "oncall_owner",
    ],
    default_owner_role: "incident_commander",
    default_sla_hours: 4,
    required_approvals: ["oncall_manager", "sre_lead"],
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
    "A. Patel",
    "J. Kim",
    "L. Rodriguez",
    "R. Singh",
    "T. Nguyen",
    "M. Carter",
    "E. Miller",
    "S. Hassan",
  ]);
  const systems = ["Finance BI", "CRM Portal", "Payroll Hub", "Audit Vault"];
  const levels = ["read", "editor", "approver"];
  const teams = ["finance ops", "internal audit", "revops", "compliance"];
  const justification = pick(rand, [
    "quarter-end reconciliation",
    "control evidence review",
    "customer account correction",
    "exception handling during close",
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
      owner_role: "iam_analyst",
      sla_hours: 24,
      risk_tag: risk,
      approvals: ["line_manager", "system_owner"],
      required_fields: {
        subject_user: user,
        system_name: system,
        access_level: level,
        justification,
        manager_approval: "pending",
      },
      next_actions: [
        "Validate user employment status",
        "Create IAM entitlement change ticket",
        "Notify requester when provisioning completes",
      ],
      controls: ["SoD check", "Manager authorization", "Quarterly recertification"],
    },
  };
}

function buildVendorExample(rand, index, split) {
  const vendors = [
    "Northwind Data Services",
    "BluePeak Consulting",
    "OrbitFulfill Logistics",
    "Cedar Compliance Labs",
  ];
  const countries = ["US", "DE", "IN", "CH", "SG"];
  const scopes = ["analytics support", "payment processing", "cloud hosting", "KYC operations"];
  const taxStatus = ["w9_received", "w8ben_required", "pending_submission"];
  const vendor = pick(rand, vendors);
  const country = pick(rand, countries);
  const scope = pick(rand, scopes);
  const reviewTicket = `VR-${String(1200 + Math.floor(rand() * 800))}`;
  const risk = riskFor("vendor_onboarding", index);

  return {
    id: `vendor_onboarding-${split}-${String(index + 1).padStart(3, "0")}`,
    process_id: "vendor_onboarding",
    request_text: `Start vendor onboarding for ${vendor} in ${country} for ${scope}; include security and tax checks.`,
    risk_tag: risk,
    target: {
      plan_version: "1.0",
      process_id: "vendor_onboarding",
      title: `Onboard vendor ${vendor}`,
      owner_role: "vendor_risk_analyst",
      sla_hours: 72,
      risk_tag: risk,
      approvals: ["procurement_manager", "security_officer"],
      required_fields: {
        vendor_name: vendor,
        country,
        service_scope: scope,
        security_review_ticket: reviewTicket,
        tax_form_status: pick(rand, taxStatus),
      },
      next_actions: [
        "Run sanctions and legal entity checks",
        "Complete security questionnaire review",
        "Record onboarding decision in vendor register",
      ],
      controls: ["Third-party risk tiering", "Data processing addendum", "Tax compliance check"],
    },
  };
}

function buildPurchaseExample(rand, index, split) {
  const departments = ["finance", "engineering", "marketing", "customer_support"];
  const items = [
    "security license expansion",
    "GPU workstation",
    "customer survey package",
    "backup storage extension",
  ];
  const suppliers = ["Contoso Supply", "Apex Systems", "Nexa Devices", "Summit Retail"];
  const budgetCodes = ["BUD-4012", "BUD-7731", "BUD-5590", "BUD-6604"];
  const dept = pick(rand, departments);
  const item = pick(rand, items);
  const supplier = pick(rand, suppliers);
  const estimatedCost = roundHundreds(900 + rand() * 11000);
  const risk = riskFor("purchase_request", index);

  return {
    id: `purchase_request-${split}-${String(index + 1).padStart(3, "0")}`,
    process_id: "purchase_request",
    request_text: `Create a purchase request from ${dept} for ${item} via ${supplier}; estimated spend is $${estimatedCost}.`,
    risk_tag: risk,
    target: {
      plan_version: "1.0",
      process_id: "purchase_request",
      title: `Approve ${item} purchase`,
      owner_role: "procurement_specialist",
      sla_hours: 48,
      risk_tag: risk,
      approvals: ["budget_owner", "procurement_lead"],
      required_fields: {
        requester_department: dept,
        item_description: item,
        estimated_cost_usd: String(estimatedCost),
        budget_code: pick(rand, budgetCodes),
        preferred_supplier: supplier,
      },
      next_actions: [
        "Validate budget availability",
        "Compare supplier quote against policy threshold",
        "Issue purchase order after approval",
      ],
      controls: ["Budget limit validation", "Preferred supplier check", "Dual approval policy"],
    },
  };
}

function buildIncidentExample(rand, index, split) {
  const services = ["payments-api", "auth-gateway", "data-pipeline", "customer-portal"];
  const impacts = [
    "intermittent checkout failures",
    "elevated login errors",
    "delayed reporting jobs",
    "dashboard unavailable for premium customers",
  ];
  const oncall = ["sre-west", "sre-eu", "platform-oncall", "infra-oncall"];
  const severities = ["sev1", "sev2", "sev3"];
  const service = pick(rand, services);
  const impact = pick(rand, impacts);
  const severity = pick(rand, severities);
  const incidentId = `INC-${String(31000 + Math.floor(rand() * 6000))}`;
  const risk = riskFor("incident_escalation", index);

  return {
    id: `incident_escalation-${split}-${String(index + 1).padStart(3, "0")}`,
    process_id: "incident_escalation",
    request_text: `Escalate ${incidentId} for ${service} due to ${impact}; treat as ${severity}.`,
    risk_tag: risk,
    target: {
      plan_version: "1.0",
      process_id: "incident_escalation",
      title: `Escalate incident ${incidentId}`,
      owner_role: "incident_commander",
      sla_hours: 4,
      risk_tag: risk,
      approvals: ["oncall_manager", "sre_lead"],
      required_fields: {
        incident_id: incidentId,
        severity,
        service_name: service,
        customer_impact: impact,
        oncall_owner: pick(rand, oncall),
      },
      next_actions: [
        "Open incident bridge and page stakeholders",
        "Assign triage and communications leads",
        "Publish first external status update",
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
