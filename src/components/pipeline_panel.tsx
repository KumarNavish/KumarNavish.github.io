import { useMemo, useState } from "react";
import { LinearSoftmaxClassifier } from "../cl/router";
import type { Example, ProcessDefinition, ProcessId } from "../domain/types";
import { VectorStore } from "../retrieval/vector_store";
import { keywordEmbedText, runAutomationPipeline } from "../agent/pipeline";

const INTENT_ORDER: ProcessId[] = [
  "access_request",
  "vendor_onboarding",
  "purchase_request",
  "incident_escalation",
];

const PROCESS_DEFINITIONS: Record<ProcessId, ProcessDefinition> = {
  access_request: {
    process_id: "access_request",
    display_name: "Access Request",
    description: "Provision, modify, or revoke access.",
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
    description: "Third-party onboarding controls.",
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
    description: "Procurement and spend approval.",
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
    description: "Escalate high-impact incidents.",
    required_fields: ["incident_id", "severity", "service_name", "customer_impact", "oncall_owner"],
    default_owner_role: "incident_commander",
    default_sla_hours: 4,
    required_approvals: ["oncall_manager", "sre_lead"],
  },
};

function makeRouter() {
  const model = new LinearSoftmaxClassifier(4, 4, { seed: 5, initScale: 0.001 });
  model.setParams({
    W: new Float32Array([
      6, 0, 0, 0,
      0, 6, 0, 0,
      0, 0, 6, 0,
      0, 0, 0, 6,
    ]),
    b: new Float32Array([0, 0, 0, 0]),
  });
  return model;
}

function makeMemoryStore() {
  const store = new VectorStore<Example>();
  const exemplars: Example[] = [
    {
      id: "mem-acc-1",
      process_id: "access_request",
      request_text: "Request read access for A. Patel in Finance BI for reconciliation.",
      risk_tag: "low",
      target: {
        plan_version: "1.0",
        process_id: "access_request",
        title: "Provision read access",
        owner_role: "iam_analyst",
        sla_hours: 24,
        risk_tag: "low",
        approvals: ["line_manager", "system_owner"],
        required_fields: {
          subject_user: "A. Patel",
          system_name: "Finance BI",
          access_level: "read",
          justification: "reconciliation",
          manager_approval: "pending",
        },
        next_actions: ["Validate request", "Provision entitlement"],
        controls: ["SoD check", "Approval gate"],
      },
    },
    {
      id: "mem-inc-1",
      process_id: "incident_escalation",
      request_text: "Escalate INC-3001 for checkout outage as sev1.",
      risk_tag: "high",
      target: {
        plan_version: "1.0",
        process_id: "incident_escalation",
        title: "Escalate incident",
        owner_role: "incident_commander",
        sla_hours: 4,
        risk_tag: "high",
        approvals: ["oncall_manager", "sre_lead"],
        required_fields: {
          incident_id: "INC-3001",
          severity: "sev1",
          service_name: "checkout-api",
          customer_impact: "payments failing",
          oncall_owner: "sre-oncall",
        },
        next_actions: ["Page oncall", "Open bridge"],
        controls: ["SLA timer", "Incident policy"],
      },
    },
  ];

  for (const exemplar of exemplars) {
    store.add(exemplar.id, keywordEmbedText(exemplar.request_text), exemplar);
  }
  return store;
}

export function PipelinePanel() {
  const [requestText, setRequestText] = useState(
    "Please escalate INC-9901 for checkout outage and treat as sev1.",
  );
  const [stateText, setStateText] = useState("Idle");
  const [resultJson, setResultJson] = useState("");

  const router = useMemo(() => makeRouter(), []);
  const memoryStore = useMemo(() => makeMemoryStore(), []);

  const runPipeline = async () => {
    setStateText("Running request -> embed -> retrieve -> intent -> plan...");
    setResultJson("");
    try {
      const result = await runAutomationPipeline(requestText, {
        mode: "template",
        retrievalK: 2,
        processDefinitions: PROCESS_DEFINITIONS,
        intentOrder: INTENT_ORDER,
        router,
        memoryStore,
        embed: async (texts) => texts.map((text) => keywordEmbedText(text)),
      });
      setStateText("Pipeline run succeeded.");
      setResultJson(JSON.stringify(result, null, 2));
      console.log("Pipeline demo result", result);
    } catch (error) {
      setStateText("Pipeline run failed.");
      setResultJson(error instanceof Error ? error.message : "Unknown pipeline error");
    }
  };

  return (
    <div className="smoke-box">
      <h3>Automation Pipeline Demo</h3>
      <textarea
        className="pipeline-input"
        value={requestText}
        onChange={(event) => setRequestText(event.target.value)}
      />
      <button type="button" onClick={runPipeline}>
        Run automation pipeline
      </button>
      <p className="status">{stateText}</p>
      {resultJson ? <pre className="summary summary-block">{resultJson}</pre> : null}
    </div>
  );
}
