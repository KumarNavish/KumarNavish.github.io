import { describe, expect, it } from "vitest";
import { LinearSoftmaxClassifier } from "../cl/router";
import type { Example, ProcessDefinition, ProcessId } from "../domain/types";
import { VectorStore } from "../retrieval/vector_store";
import { keywordEmbedText, runAutomationPipeline } from "./pipeline";

const PROCESS_DEFINITIONS: Record<ProcessId, ProcessDefinition> = {
  access_request: {
    process_id: "access_request",
    display_name: "Access Request",
    description: "Provision access.",
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
  vendor_onboarding: {
    process_id: "vendor_onboarding",
    display_name: "Vendor Onboarding",
    description: "Onboard vendor.",
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
  purchase_request: {
    process_id: "purchase_request",
    display_name: "Purchase Request",
    description: "Purchase processing.",
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
  incident_escalation: {
    process_id: "incident_escalation",
    display_name: "Incident Escalation",
    description: "Escalate incidents.",
    required_fields: ["incident_id", "severity", "service_name", "customer_impact", "oncall_owner"],
    default_owner_role: "incident_commander",
    default_sla_hours: 4,
    required_approvals: ["oncall_manager", "sre_lead"],
  },
};

const INTENT_ORDER: ProcessId[] = [
  "access_request",
  "vendor_onboarding",
  "purchase_request",
  "incident_escalation",
];

function makeClassifier() {
  const model = new LinearSoftmaxClassifier(4, 4, { seed: 4, initScale: 0.001 });
  model.setParams({
    W: new Float32Array([
      6, 0, 0, 0, // access_request
      0, 6, 0, 0, // vendor_onboarding
      0, 0, 6, 0, // purchase_request
      0, 0, 0, 6, // incident_escalation
    ]),
    b: new Float32Array([0, 0, 0, 0]),
  });
  return model;
}

function makeMemoryStore() {
  const store = new VectorStore<Example>();
  const examples: Example[] = [
    {
      id: "ex-1",
      process_id: "access_request",
      request_text: "Request read access for Ana in Finance BI for reconciliation.",
      risk_tag: "low",
      target: {
        plan_version: "1.0",
        process_id: "access_request",
        title: "Access plan",
        owner_role: "iam_analyst",
        sla_hours: 24,
        risk_tag: "low",
        approvals: ["line_manager", "system_owner"],
        required_fields: {
          subject_user: "Ana",
          system_name: "Finance BI",
          access_level: "read",
          justification: "reconciliation",
          manager_approval: "pending",
        },
        next_actions: ["Validate request"],
        controls: ["SoD check"],
      },
    },
    {
      id: "ex-2",
      process_id: "incident_escalation",
      request_text: "Escalate INC-1201 outage in payments-api as sev1.",
      risk_tag: "high",
      target: {
        plan_version: "1.0",
        process_id: "incident_escalation",
        title: "Incident plan",
        owner_role: "incident_commander",
        sla_hours: 4,
        risk_tag: "high",
        approvals: ["oncall_manager", "sre_lead"],
        required_fields: {
          incident_id: "INC-1201",
          severity: "sev1",
          service_name: "payments-api",
          customer_impact: "checkout down",
          oncall_owner: "sre",
        },
        next_actions: ["Page oncall"],
        controls: ["SLA timer"],
      },
    },
  ];

  for (const example of examples) {
    store.add(example.id, keywordEmbedText(example.request_text), example);
  }
  return store;
}

describe("automation pipeline", () => {
  it("deterministic mode always produces a valid TargetPlan JSON", async () => {
    const result = await runAutomationPipeline(
      "Please request read access for Mina in CRM Portal for audit review.",
      {
        mode: "template",
        retrievalK: 2,
        processDefinitions: PROCESS_DEFINITIONS,
        intentOrder: INTENT_ORDER,
        embed: async (texts) => texts.map((text) => keywordEmbedText(text)),
        router: makeClassifier(),
        memoryStore: makeMemoryStore(),
      },
    );

    expect(result.modeUsed).toBe("template");
    expect(result.predictedIntent).toBe("access_request");
    expect(result.validation.valid).toBe(true);
    expect(result.plan.process_id).toBe("access_request");
    expect(result.plan.required_fields.subject_user.length).toBeGreaterThan(0);
  });

  it("handles missing fields gracefully in LLM mode by repairing output", async () => {
    const result = await runAutomationPipeline(
      "Escalate INC-9001 for checkout outage with sev1 urgency.",
      {
        mode: "llm",
        retrievalK: 1,
        processDefinitions: PROCESS_DEFINITIONS,
        intentOrder: INTENT_ORDER,
        embed: async (texts) => texts.map((text) => keywordEmbedText(text)),
        router: makeClassifier(),
        memoryStore: makeMemoryStore(),
        llmGeneratePlan: async () => ({
          title: "Incomplete incident plan",
          process_id: "incident_escalation",
          required_fields: {
            incident_id: "INC-9001",
          },
        }),
      },
    );

    expect(result.modeUsed).toBe("llm");
    expect(result.predictedIntent).toBe("incident_escalation");
    expect(result.validation.valid).toBe(true);
    expect(result.validation.repaired).toBe(true);
    expect(result.plan.required_fields.severity.length).toBeGreaterThan(0);
    expect(result.plan.required_fields.oncall_owner.length).toBeGreaterThan(0);
  });
});
