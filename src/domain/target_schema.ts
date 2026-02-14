import type { ProcessDefinition, TargetPlan } from "./types";

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.length > 0 && value.every((item) => isNonEmptyString(item))
  );
}

function hasObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateTargetPlan(
  target: TargetPlan,
  processDefinition: ProcessDefinition,
): ValidationResult {
  const errors: string[] = [];

  if (!isNonEmptyString(target.plan_version)) {
    errors.push("plan_version must be non-empty string");
  }

  if (target.process_id !== processDefinition.process_id) {
    errors.push("target.process_id must match process definition");
  }

  if (!isNonEmptyString(target.title)) {
    errors.push("title must be non-empty string");
  }

  if (!isNonEmptyString(target.owner_role)) {
    errors.push("owner_role must be non-empty string");
  }

  if (!Number.isInteger(target.sla_hours) || target.sla_hours <= 0) {
    errors.push("sla_hours must be a positive integer");
  }

  if (!hasStringArray(target.approvals)) {
    errors.push("approvals must be non-empty string array");
  }

  if (!hasStringArray(target.next_actions)) {
    errors.push("next_actions must be non-empty string array");
  }

  if (!hasStringArray(target.controls)) {
    errors.push("controls must be non-empty string array");
  }

  if (!hasObject(target.required_fields)) {
    errors.push("required_fields must be an object");
  } else {
    for (const key of processDefinition.required_fields) {
      if (!isNonEmptyString(target.required_fields[key])) {
        errors.push(`required_fields.${key} must be non-empty string`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
