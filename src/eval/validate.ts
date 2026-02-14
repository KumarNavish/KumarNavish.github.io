import { validateTargetPlan } from "../domain/target_schema";
import type { ProcessDefinition, RiskTag, TargetPlan } from "../domain/types";

export interface PlanValidationResult {
  valid: boolean;
  errors: string[];
  repaired: boolean;
  plan: TargetPlan;
}

interface ValidationFallback {
  defaultRiskTag: RiskTag;
  requestText: string;
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function asPositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.round(value);
  return rounded > 0 ? rounded : fallback;
}

function asRiskTag(value: unknown, fallback: RiskTag): RiskTag {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return fallback;
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const cleaned = value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  return cleaned.length > 0 ? cleaned : fallback;
}

function defaultActions(process: ProcessDefinition): string[] {
  return [
    `Validate required fields for ${process.display_name}`,
    `Route ${process.display_name} for required approvals`,
    "Record plan and execution audit event",
  ];
}

function defaultControls(process: ProcessDefinition): string[] {
  return [
    `${process.display_name} schema validation`,
    "Required approvals enforcement",
    "Risk-tag review checkpoint",
  ];
}

export function buildTargetPlanSchema(process: ProcessDefinition): Record<string, unknown> {
  const requiredFieldProps: Record<string, unknown> = {};
  for (const field of process.required_fields) {
    requiredFieldProps[field] = { type: "string" };
  }

  return {
    type: "object",
    additionalProperties: false,
    required: [
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
    properties: {
      plan_version: { type: "string" },
      process_id: { type: "string", enum: [process.process_id] },
      title: { type: "string" },
      owner_role: { type: "string" },
      sla_hours: { type: "integer", minimum: 1 },
      risk_tag: { type: "string", enum: ["low", "medium", "high"] },
      approvals: {
        type: "array",
        minItems: 1,
        items: { type: "string" },
      },
      required_fields: {
        type: "object",
        additionalProperties: false,
        required: process.required_fields,
        properties: requiredFieldProps,
      },
      next_actions: {
        type: "array",
        minItems: 1,
        items: { type: "string" },
      },
      controls: {
        type: "array",
        minItems: 1,
        items: { type: "string" },
      },
    },
  };
}

export function validateAndRepairPlan(
  rawPlan: unknown,
  process: ProcessDefinition,
  fallback: ValidationFallback,
): PlanValidationResult {
  const obj = asObject(rawPlan);
  const rawRequired = asObject(obj.required_fields);

  const requiredFields: Record<string, string> = {};
  for (const key of process.required_fields) {
    requiredFields[key] = asString(rawRequired[key], `unknown_${key}`);
  }

  const repairedPlan: TargetPlan = {
    plan_version: asString(obj.plan_version, "1.0"),
    process_id: process.process_id,
    title: asString(obj.title, `${process.display_name} automation plan`),
    owner_role: asString(obj.owner_role, process.default_owner_role),
    sla_hours: asPositiveInt(obj.sla_hours, process.default_sla_hours),
    risk_tag: asRiskTag(obj.risk_tag, fallback.defaultRiskTag),
    approvals: asStringArray(obj.approvals, process.required_approvals),
    required_fields: requiredFields,
    next_actions: asStringArray(obj.next_actions, defaultActions(process)),
    controls: asStringArray(obj.controls, defaultControls(process)),
  };

  if (repairedPlan.title === `${process.display_name} automation plan`) {
    repairedPlan.title = `${process.display_name}: ${fallback.requestText.slice(0, 64)}`.trim();
  }

  const validation = validateTargetPlan(repairedPlan, process);
  const repaired = JSON.stringify(obj) !== JSON.stringify(repairedPlan);

  return {
    valid: validation.valid,
    errors: validation.errors,
    repaired,
    plan: repairedPlan,
  };
}
