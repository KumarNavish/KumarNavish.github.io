import type { ProcessId } from "./types";

export interface WorkflowHandoffMapping {
  field: string;
  destination: string;
  purpose: string;
}

export interface BisWorkflowDefinition {
  processId: ProcessId;
  workflowName: string;
  headline: string;
  dayToDayContext: string;
  manualPain: string;
  transformationSummary: string;
  businessImpact: string;
  primaryTeams: string[];
  systemTargets: string[];
  policyChecks: string[];
  sampleRequest: string;
  expectedOutcome: string;
  manualCycleMinutes: number;
  automatedCycleMinutes: number;
  handoffMappings: WorkflowHandoffMapping[];
}

export const BIS_WORKFLOWS: BisWorkflowDefinition[] = [
  {
    processId: "access_request",
    workflowName: "Access Entitlement Change",
    headline: "Convert access emails into governed entitlement actions.",
    dayToDayContext:
      "Used when staff join, change role, or need temporary access to internal policy and operations platforms.",
    manualPain:
      "Requests arrive in free text and teams manually chase missing approver and justification details.",
    transformationSummary:
      "The demo extracts required access fields, applies approval policy, and creates an audit-ready routing packet.",
    businessImpact:
      "Cuts triage latency and reduces control exceptions in IAM operations.",
    primaryTeams: ["Identity Governance", "Division Line Management", "Application Owners"],
    systemTargets: ["ServiceNow", "SailPoint", "Okta Workflows"],
    policyChecks: [
      "Required justification present",
      "Line manager approval gate",
      "Application owner approval gate",
      "SLA assignment and audit logging",
    ],
    sampleRequest:
      "Please request editor access for A. Meier in Document Vault for operations_risk to support policy note preparation.",
    expectedOutcome:
      "Creates a complete entitlement change plan with owner, SLA, approvals, and required fields.",
    manualCycleMinutes: 22,
    automatedCycleMinutes: 4,
    handoffMappings: [
      {
        field: "required_fields.subject_user",
        destination: "ServiceNow.requested_for",
        purpose: "Bind request to the target employee identity.",
      },
      {
        field: "required_fields.system_name",
        destination: "SailPoint.application",
        purpose: "Select target application for entitlement assignment.",
      },
      {
        field: "approvals",
        destination: "ServiceNow.approval_chain",
        purpose: "Trigger mandatory approval workflow before provisioning.",
      },
    ],
  },
  {
    processId: "vendor_onboarding",
    workflowName: "Third-Party Due Diligence Intake",
    headline: "Structure vendor onboarding into risk and compliance tasks.",
    dayToDayContext:
      "Used when teams request new data providers, external services, or specialized support vendors.",
    manualPain:
      "Critical compliance attributes are often missing at intake, causing repeated follow-ups and delays.",
    transformationSummary:
      "The demo captures vendor risk fields, enforces compliance checks, and routes to procurement and security owners.",
    businessImpact:
      "Improves onboarding consistency and shortens cycle time for vendor decisions.",
    primaryTeams: ["Procurement Operations", "Third-Party Risk", "Information Security", "Compliance"],
    systemTargets: ["ServiceNow GRC", "Archer", "SAP Ariba"],
    policyChecks: [
      "Vendor country and scope captured",
      "Security review ticket tracked",
      "Tax form status included",
      "Multi-function approval routing",
    ],
    sampleRequest:
      "Start due diligence for Helios Data Labs in CH for market data services; include sanctions, security, and tax checks.",
    expectedOutcome:
      "Produces a complete due-diligence intake plan with compliance checkpoints and ownership.",
    manualCycleMinutes: 35,
    automatedCycleMinutes: 7,
    handoffMappings: [
      {
        field: "required_fields.vendor_name",
        destination: "Archer.third_party_name",
        purpose: "Create or update vendor record in risk inventory.",
      },
      {
        field: "required_fields.security_review_ticket",
        destination: "ServiceNowGRC.control_assessment_ref",
        purpose: "Link intake to security control review workflow.",
      },
      {
        field: "risk_tag",
        destination: "Archer.inherent_risk_tier",
        purpose: "Drive depth of due diligence and approval path.",
      },
    ],
  },
  {
    processId: "purchase_request",
    workflowName: "Policy-Compliant Procurement Request",
    headline: "Turn spend requests into policy-ready procurement packets.",
    dayToDayContext:
      "Used for software, data subscriptions, and equipment requests across operations and research teams.",
    manualPain:
      "Teams repeatedly verify budget, supplier, and approval requirements from fragmented request emails.",
    transformationSummary:
      "The demo extracts procurement fields, validates budget metadata, and prepares dual-approval handoff payloads.",
    businessImpact:
      "Speeds compliant purchasing while keeping audit evidence and policy controls intact.",
    primaryTeams: ["Procurement Operations", "Budget Owners", "Requesting Divisions"],
    systemTargets: ["SAP", "Coupa", "Jira Service Management"],
    policyChecks: [
      "Budget code captured",
      "Estimated spend normalized",
      "Preferred supplier captured",
      "Dual approval route prepared",
    ],
    sampleRequest:
      "Create a procurement request from operations for market data license renewal via EuroData Supply; estimated spend is $7800.",
    expectedOutcome:
      "Generates a procurement plan that can be posted directly to budget and purchasing workflows.",
    manualCycleMinutes: 28,
    automatedCycleMinutes: 5,
    handoffMappings: [
      {
        field: "required_fields.budget_code",
        destination: "SAP.cost_center_code",
        purpose: "Attach spend request to accountable budget entity.",
      },
      {
        field: "required_fields.estimated_cost_usd",
        destination: "Coupa.request_total",
        purpose: "Set approval thresholds and procurement policy path.",
      },
      {
        field: "required_fields.preferred_supplier",
        destination: "Coupa.supplier_name",
        purpose: "Pre-fill supplier context for sourcing and approvals.",
      },
    ],
  },
  {
    processId: "incident_escalation",
    workflowName: "Critical Operations Incident Escalation",
    headline: "Standardize high-impact incident escalation decisions.",
    dayToDayContext:
      "Used when internal operational platforms degrade and teams need rapid, policy-consistent escalation.",
    manualPain:
      "Severity and owner assignment are interpreted differently across teams, creating inconsistent response quality.",
    transformationSummary:
      "The demo determines escalation intent, enforces severity fields, and outputs a response plan with clear ownership.",
    businessImpact:
      "Reduces response ambiguity and improves reliability of major-incident operations.",
    primaryTeams: ["Operations On-call", "Platform Owners", "Service Managers"],
    systemTargets: ["PagerDuty", "ServiceNow Incident", "Opsgenie"],
    policyChecks: [
      "Incident ID and severity captured",
      "Service impact explicitly recorded",
      "On-call owner assigned",
      "Escalation SLA and controls attached",
    ],
    sampleRequest:
      "Escalate INC-33888 for market-data-ingestion due to briefing dashboards unavailable; treat as sev1.",
    expectedOutcome:
      "Creates a response-ready incident escalation plan aligned to severity policy and ownership.",
    manualCycleMinutes: 16,
    automatedCycleMinutes: 3,
    handoffMappings: [
      {
        field: "required_fields.incident_id",
        destination: "ServiceNow.incident_number",
        purpose: "Attach automation output to existing incident record.",
      },
      {
        field: "required_fields.severity",
        destination: "PagerDuty.urgency",
        purpose: "Drive incident paging urgency and escalation chain.",
      },
      {
        field: "required_fields.oncall_owner",
        destination: "Opsgenie.responder_team",
        purpose: "Route escalation to responsible on-call responders.",
      },
    ],
  },
];

export const BIS_WORKFLOW_BY_PROCESS: Record<ProcessId, BisWorkflowDefinition> = BIS_WORKFLOWS.reduce(
  (acc, workflow) => {
    acc[workflow.processId] = workflow;
    return acc;
  },
  {} as Record<ProcessId, BisWorkflowDefinition>,
);
