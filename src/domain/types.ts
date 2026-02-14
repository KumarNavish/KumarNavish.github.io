export const PROCESS_IDS = [
  "access_request",
  "vendor_onboarding",
  "purchase_request",
  "incident_escalation",
] as const;

export type ProcessId = (typeof PROCESS_IDS)[number];
export type RiskTag = "low" | "medium" | "high";

export interface TargetPlan {
  plan_version: string;
  process_id: ProcessId;
  title: string;
  owner_role: string;
  sla_hours: number;
  risk_tag: RiskTag;
  approvals: string[];
  required_fields: Record<string, string>;
  next_actions: string[];
  controls: string[];
}

export interface Example {
  id: string;
  process_id: ProcessId;
  request_text: string;
  target: TargetPlan;
  risk_tag: RiskTag;
}

export interface ProcessDefinition {
  process_id: ProcessId;
  display_name: string;
  description: string;
  required_fields: string[];
  default_owner_role: string;
  default_sla_hours: number;
  required_approvals: string[];
}

export interface StreamStep {
  step: number;
  process_id: ProcessId;
  drift: boolean;
  drift_profile?: "policy_synonym_shift" | "urgency_shift";
}
