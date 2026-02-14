import { LinearSoftmaxClassifier } from "../cl/router";
import type { Example, ProcessDefinition, ProcessId, RiskTag, TargetPlan } from "../domain/types";
import { buildTargetPlanSchema, validateAndRepairPlan, type PlanValidationResult } from "../eval/validate";
import type { JsonSchema, LlmMessage } from "../llm/webllm_client";
import type { VectorStore, VectorStoreHit } from "../retrieval/vector_store";

export type PipelineMode = "template" | "llm";

export interface PipelineDependencies {
  embed: (texts: string[]) => Promise<Float32Array[]>;
  memoryStore: Pick<VectorStore<Example>, "topK">;
  router: Pick<LinearSoftmaxClassifier, "predict">;
  processDefinitions: Record<ProcessId, ProcessDefinition>;
  intentOrder: readonly ProcessId[];
  retrievalK: number;
  mode: PipelineMode;
  llmGeneratePlan?: (messages: LlmMessage[], schema: JsonSchema) => Promise<Record<string, unknown>>;
}

export interface RetrievedExemplar {
  id: string;
  score: number;
  example: Example;
}

export interface PipelineResult {
  requestText: string;
  predictedIntent: ProcessId;
  queryEmbedding: Float32Array;
  retrievedExemplars: RetrievedExemplar[];
  modeUsed: PipelineMode;
  plan: TargetPlan;
  validation: Omit<PlanValidationResult, "plan">;
}

const PROCESS_KEYWORDS: Record<ProcessId, string[]> = {
  access_request: ["access", "permission", "entitlement", "provision", "iam", "joiner", "mover", "leaver"],
  vendor_onboarding: ["vendor", "supplier", "onboard", "third-party", "due diligence", "sanctions", "kyc"],
  purchase_request: ["purchase", "buy", "spend", "budget", "invoice", "procurement", "po", "license"],
  incident_escalation: ["incident", "outage", "sev", "escalate", "oncall", "major incident", "degradation"],
};

function inferRiskTag(requestText: string, processId: ProcessId): RiskTag {
  const text = requestText.toLowerCase();
  if (
    /\b(sev1|critical|urgent|outage|breach|major incident|high-priority)\b/.test(text)
  ) {
    return "high";
  }
  if (/\b(sev2|priority|production|manager review)\b/.test(text)) {
    return "medium";
  }
  if (processId === "incident_escalation") {
    return "high";
  }
  return "low";
}

function matchOrFallback(
  text: string,
  regex: RegExp,
  fallback: string,
  transform?: (value: string) => string,
): string {
  const match = text.match(regex)?.[1];
  if (!match) {
    return fallback;
  }
  const trimmed = match.trim();
  if (trimmed.length === 0) {
    return fallback;
  }
  return transform ? transform(trimmed) : trimmed;
}

function extractRequiredFields(
  process: ProcessDefinition,
  requestText: string,
  predictedRisk: RiskTag,
): Record<string, string> {
  const text = requestText;

  if (process.process_id === "access_request") {
    return {
      subject_user: matchOrFallback(text, /for\s+([A-Za-z][A-Za-z. -]+?)\s+(?:in|to)\b/i, "unknown_subject_user"),
      system_name: matchOrFallback(text, /\b(?:in|to)\s+([A-Za-z0-9 .-]+?)\s+(?:for|to|with)\b/i, "unknown_system_name"),
      access_level: matchOrFallback(
        text,
        /\b(read|viewer|editor|approver|admin)\b/i,
        "read",
        (value) => value.toLowerCase(),
      ),
      justification: matchOrFallback(text, /\b(?:for|because|to support)\s+(.+?)\.?$/i, "request fulfillment"),
      manager_approval: "pending",
    };
  }

  if (process.process_id === "vendor_onboarding") {
    return {
      vendor_name: matchOrFallback(text, /for\s+([A-Za-z0-9 .,&-]+?)(?:\s+in|\s+for|\s*;|$)/i, "unknown_vendor_name"),
      country: matchOrFallback(text, /\bin\s+([A-Za-z]{2})\b/, "US", (value) => value.toUpperCase()),
      service_scope: matchOrFallback(text, /\bfor\s+([A-Za-z0-9 -]+?)(?:\s*;|$)/i, "general services"),
      security_review_ticket: matchOrFallback(text, /\b(VR-\d+)\b/i, "VR-0000", (value) => value.toUpperCase()),
      tax_form_status: "pending_submission",
    };
  }

  if (process.process_id === "purchase_request") {
    return {
      requester_department: matchOrFallback(text, /\bfrom\s+([A-Za-z_ -]+?)\s+(?:for|to)\b/i, "unknown_department"),
      item_description: matchOrFallback(text, /\bfor\s+(.+?)(?:\s+via|\s*;|$)/i, "unknown_item"),
      estimated_cost_usd: matchOrFallback(text, /\$([0-9]+(?:\.[0-9]+)?)/, "1000"),
      budget_code: matchOrFallback(text, /\b(BUD-[0-9]{3,5})\b/i, "BUD-0000", (value) => value.toUpperCase()),
      preferred_supplier: matchOrFallback(text, /\bvia\s+([A-Za-z0-9 .,&-]+?)(?:\s*;|$)/i, "unknown_supplier"),
    };
  }

  return {
    incident_id: matchOrFallback(text, /\b(INC-\d+)\b/i, "INC-0000", (value) => value.toUpperCase()),
    severity: matchOrFallback(text, /\b(sev[1-3])\b/i, predictedRisk === "high" ? "sev1" : "sev2", (value) =>
      value.toLowerCase(),
    ),
    service_name: matchOrFallback(text, /\bfor\s+([A-Za-z0-9.\-_]+)\b/i, "unknown_service"),
    customer_impact: matchOrFallback(text, /\bdue to\s+(.+?)(?:;|$|\.)/i, "service disruption"),
    oncall_owner: "oncall_manager_pending",
  };
}

function buildTemplatePlan(
  process: ProcessDefinition,
  requestText: string,
  riskTag: RiskTag,
  exemplars: RetrievedExemplar[],
): TargetPlan {
  const requiredFields = extractRequiredFields(process, requestText, riskTag);
  const exemplarHint = exemplars[0]?.example.request_text ?? "";

  return {
    plan_version: "1.0",
    process_id: process.process_id,
    title: `${process.display_name} automation plan`,
    owner_role: process.default_owner_role,
    sla_hours: process.default_sla_hours,
    risk_tag: riskTag,
    approvals: process.required_approvals,
    required_fields: requiredFields,
    next_actions: [
      `Validate ${process.display_name} required fields`,
      "Route to required approvers",
      exemplarHint ? `Cross-check against exemplar pattern: ${exemplarHint.slice(0, 72)}` : "Log execution audit event",
    ],
    controls: [
      `${process.display_name} schema validation`,
      "Approval workflow enforcement",
      "Risk and SLA checkpoint review",
    ],
  };
}

function buildLlmMessages(
  requestText: string,
  process: ProcessDefinition,
  exemplars: RetrievedExemplar[],
): LlmMessage[] {
  const compactExemplars = exemplars.slice(0, 3).map((hit) => ({
    id: hit.id,
    score: Number(hit.score.toFixed(4)),
    request_text: hit.example.request_text,
    target: hit.example.target,
  }));

  return [
    {
      role: "system",
      content:
        "You are an automation copilot. Return only valid JSON that matches the provided schema and contains no extra keys.",
    },
    {
      role: "user",
      content: JSON.stringify({
        instruction: "Generate a strict TargetPlan JSON response.",
        request_text: requestText,
        process_definition: process,
        exemplars: compactExemplars,
      }),
    },
  ];
}

function resolveIntent(index: number, intentOrder: readonly ProcessId[]): ProcessId {
  if (intentOrder.length === 0) {
    throw new Error("intentOrder cannot be empty.");
  }
  if (index >= 0 && index < intentOrder.length) {
    return intentOrder[index];
  }
  return intentOrder[0];
}

export function keywordEmbedText(text: string): Float32Array {
  const normalized = text.toLowerCase();
  const features = new Float32Array(4);

  const processIds: ProcessId[] = [
    "access_request",
    "vendor_onboarding",
    "purchase_request",
    "incident_escalation",
  ];

  for (let i = 0; i < processIds.length; i += 1) {
    const processId = processIds[i];
    let score = 0;
    for (const keyword of PROCESS_KEYWORDS[processId]) {
      if (normalized.includes(keyword)) {
        score += 1;
      }
    }
    features[i] = score;
  }

  const total = features[0] + features[1] + features[2] + features[3];
  if (total === 0) {
    features[0] = 1;
    return features;
  }
  return features;
}

export async function runAutomationPipeline(
  requestText: string,
  deps: PipelineDependencies,
): Promise<PipelineResult> {
  const [queryEmbedding] = await deps.embed([requestText]);
  if (!queryEmbedding) {
    throw new Error("Embedding function returned no vectors for request.");
  }

  const rawHits = deps.memoryStore.topK(queryEmbedding, deps.retrievalK) as VectorStoreHit<Example>[];
  const retrievedExemplars: RetrievedExemplar[] = rawHits.map((hit) => ({
    id: hit.id,
    score: hit.score,
    example: hit.payload,
  }));

  const predictedClass = deps.router.predict(queryEmbedding);
  const predictedIntent = resolveIntent(predictedClass, deps.intentOrder);
  const process = deps.processDefinitions[predictedIntent];
  if (!process) {
    throw new Error(`Missing process definition for predicted intent: ${predictedIntent}`);
  }

  const riskTag = inferRiskTag(requestText, predictedIntent);

  let rawPlan: unknown;
  let modeUsed: PipelineMode = "template";
  if (deps.mode === "llm" && deps.llmGeneratePlan) {
    const schema = buildTargetPlanSchema(process);
    const messages = buildLlmMessages(requestText, process, retrievedExemplars);
    rawPlan = await deps.llmGeneratePlan(messages, schema);
    modeUsed = "llm";
  } else {
    rawPlan = buildTemplatePlan(process, requestText, riskTag, retrievedExemplars);
  }

  const validation = validateAndRepairPlan(rawPlan, process, {
    defaultRiskTag: riskTag,
    requestText,
  });

  return {
    requestText,
    predictedIntent,
    queryEmbedding: new Float32Array(queryEmbedding),
    retrievedExemplars,
    modeUsed,
    plan: validation.plan,
    validation: {
      valid: validation.valid,
      errors: validation.errors,
      repaired: validation.repaired,
    },
  };
}
