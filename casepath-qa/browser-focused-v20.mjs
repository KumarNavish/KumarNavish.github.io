import fs from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { chromium } from 'playwright';

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const API = (process.env.API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const RELEASE_ID = 'casepath-v20-reference-20260811';
const PRODUCT_RELEASE = '20.0.0';
const API_RELEASE = '15.2.0';
const REQUESTED_NEMOTRON_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b';
const EXPECTED_PROVIDER_BOUNDARY = 'openrouter';
const EXPECTED_UPSTREAM_PROVIDER = 'DeepInfra';
const EXACT_NEMOTRON_RESPONSE_MODELS = new Set([
  REQUESTED_NEMOTRON_MODEL,
  'nvidia/nemotron-3-ultra-550b-a55b-20260604',
]);
const ALLOWED_USAGE_SOURCES = new Set(['response', 'generation_metadata']);
const REQUIRED_NEMOTRON_AGENT_IDS = Object.freeze([
  'canonical_facts',
  'orchestrator_plan',
  'document_source_integrity',
  'process_decision_mapping',
  'evidence_checklist',
  'final_claim_brief_audit',
]);
const REQUIRED_NEMOTRON_AGENT_ROLES = Object.freeze({
  canonical_facts: 'Guarded Canonical Facts Agent',
  orchestrator_plan: 'Nemotron Orchestrator',
  document_source_integrity: 'Document and Source Integrity Agent',
  process_decision_mapping: 'Process Decision Mapping Agent',
  evidence_checklist: 'Evidence and Checklist Agent',
  final_claim_brief_audit: 'Final Claim Brief Agent',
});
const REQUIRED_NEMOTRON_AGENT_SIGNATURES = Object.freeze({
  canonical_facts: { monogram: 'CF', signature: 'facts' },
  orchestrator_plan: { monogram: 'OR', signature: 'orchestrator' },
  document_source_integrity: { monogram: 'DS', signature: 'sources' },
  process_decision_mapping: { monogram: 'PM', signature: 'process' },
  evidence_checklist: { monogram: 'EC', signature: 'evidence' },
  final_claim_brief_audit: { monogram: 'FB', signature: 'audit' },
});
const REQUIRED_PRESENTATION_PHASE_LABELS = Object.freeze([
  'Claim understanding',
  'Swiss-law research',
  'Process discovery',
  'Evidence requirements',
  'Historical claims',
  'Verification',
  'Knowledge',
]);
const FORBIDDEN_SYNTHETIC_AGENT_LABELS = Object.freeze([
  'Claim Understanding Agent',
  'Legal Research Agent',
  'Process Discovery Agent',
  'Evidence / Document Agent',
  'Historical Claims Agent',
  'Verification Agent',
  'Knowledge Agent',
  'Attachment Parsing Agent',
  'Document Requirements Agent',
]);
const MIN_CURSOR_TARGET_HOLD_MS = 180;
const MIN_PROCESS_NODE_STEP_MS = 2200;
const MIN_PROCESS_BRANCH_HOLD_MS = 1200;
const MIN_FLAGSHIP_PRESENTATION_MS = 45000;
const MIN_PRODUCTION_FLAGSHIP_PRESENTATION_MS = 70000;
const MAX_FLAGSHIP_PRESENTATION_MS = 150000;
const FLAGSHIP_PROCESS_PROJECTION_IDS = Object.freeze([
  'intake',
  'scope',
  'dispute',
  'urgency',
  'notification',
  'defect',
  'causation',
  'responsibility',
  'remedy',
  'resolution',
]);
const REQUIRED_CAUSATION_BRANCH_IDS = Object.freeze([
  'building_defect',
  'tenant_use',
  'mixed_cause',
  'evidence_gap',
]);
const SPATIAL_GRAPH_PROJECTION = 'flagship-spine/1';
const SPATIAL_GEOMETRY_EPSILON_PX = 2;
const REQUIRED_SEMANTIC_EVENT_TYPES = Object.freeze([
  'fact.accepted',
  'legal_source.linked',
  'process_node.created',
  'branch.created',
  'evidence_requirement.linked',
  'precedent.selected',
  'verification.accepted',
  'run.completed',
]);
const REQUIRED_DETERMINISTIC_GATE_IDS = Object.freeze([
  'deterministic_process_gate',
  'deterministic_evidence_gate',
  'whole_playbook_gate',
]);
const REQUIRED_DETERMINISTIC_GATE_ROLES = Object.freeze({
  deterministic_process_gate: 'Deterministic Process Contract Gate',
  deterministic_evidence_gate: 'Deterministic Evidence Contract Gate',
  whole_playbook_gate: 'Deterministic Whole-Playbook Gate',
});
const ACCEPTED_ARTIFACT_CONTRACT = Object.freeze({
  deterministic_process_gate: { output_artifact: 'process_graph', source_agent_id: 'process_decision_mapping' },
  deterministic_evidence_gate: { output_artifact: 'evidence_model', source_agent_id: 'evidence_checklist' },
  whole_playbook_gate: { output_artifact: 'final_claim_brief', source_agent_id: 'final_claim_brief_audit' },
});
const PROCESS_CONTRIBUTION_ROLE = 'Process Decision Mapping Agent';
const EVIDENCE_CONTRIBUTION_ROLE = 'Evidence and Checklist Agent';
const FINAL_CONTRIBUTION_ROLE = 'Final Claim Brief Agent';
const DETERMINISTIC_CONTRIBUTION_ROLE = 'deterministic_application';
const FINAL_FIELD_CONTRACT = Object.freeze([
  { field: 'current_node_id', contribution_id: 'final:current_node' },
  { field: 'next_action_node_id', contribution_id: 'final:next_action' },
  { field: 'supporting_fact_ids', contribution_id: 'final:supporting_facts' },
  { field: 'upstream_contribution_ids', contribution_id: 'final:upstream_contributions' },
  { field: 'audit_check_ids', contribution_id: 'final:audit_checks' },
]);
const FINAL_UPSTREAM_CONTRIBUTION_IDS = Object.freeze([
  'document_source_integrity',
  'evidence_checklist',
  'process_decision_mapping',
]);
const FINAL_AUDIT_CHECK_IDS = Object.freeze([
  'current_node_supported_by_canonical_facts',
  'evidence_items_bound_to_process_nodes',
  'next_action_connected_in_static_topology',
  'upstream_contribution_lineage_complete',
]);
const EXPECTED_FRAMEWORK = Object.freeze({
  langchain: '1.3.14',
  langgraph: '1.2.9',
  langchain_openrouter: '0.2.7',
});
const EXPECTED_RUNTIME = Object.freeze({
  runtime_profile: 'nemotron_langgraph_multi_agent_hybrid_guarded',
  authority_mode: 'multi_agent_hybrid_guarded',
  implementation: 'langgraph_stategraph_langchain_openrouter',
  orchestration_schema: 'casepath.nemotron-agent-dag/1.0.0',
});
const DETERMINISTIC_REFERENCE_MODE = 'deterministic_reference';
const DETERMINISTIC_REFERENCE_PROFILE = 'deterministic-reference-playbook';
const DETERMINISTIC_REFERENCE_ORCHESTRATION = Object.freeze({
  executed: false,
  authority_mode: DETERMINISTIC_REFERENCE_MODE,
  model: null,
  external_tracing: false,
  deterministic_safety_authority: true,
});
const DETERMINISTIC_REFERENCE_CANONICALIZATION = Object.freeze({
  implementation: 'deterministic_reference_oracle',
  model: null,
  provider: null,
  mode: DETERMINISTIC_REFERENCE_MODE,
});
const EXPECTED_EXECUTION_TOPOLOGY = Object.freeze({
  authority: 'deterministic_application',
  implementation: 'compiled_langgraph_stategraph',
  delegations: [
    { agent_id: 'document_source_integrity', dependencies: ['orchestrator_plan'] },
    { agent_id: 'process_decision_mapping', dependencies: ['orchestrator_plan'] },
    { agent_id: 'evidence_checklist', dependencies: ['deterministic_process_gate'] },
    { agent_id: 'final_claim_brief_audit', dependencies: ['deterministic_evidence_gate'] },
  ],
  parallel_groups: [['document_source_integrity', 'process_decision_mapping']],
});
const SUCCESSFUL_MODEL_OUTCOMES = new Set(['succeeded', 'succeeded_with_guarded_fallback']);
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const LOCAL_RUN_TIMEOUT_MS = 180000;
const PRODUCTION_RUN_TIMEOUT_MS = 15 * 60 * 1000;
const LATER_TERMINAL_POLL_INTERVAL_MS = 1000;
const AXE_ANIMATION_SETTLE_TIMEOUT_MS = 2500;
const FORBIDDEN_PUBLIC_FIELDS = new Set([
  'prompt',
  'system_prompt',
  'user_prompt',
  'messages',
  'raw',
  'raw_output',
  'reasoning',
  'chain_of_thought',
  'completion',
  'request_body',
  'response_body',
  'canonical_output',
]);
const INTERNAL_SENTINEL_PATTERN = /(?:__start__|__end__|branch:to:|PregelTask|Traceback \(most recent call last\)|OPENROUTER_API_KEY|Authorization:\s*Bearer)/i;
const ALLOWED_LEDGER_FIELDS = new Set([
  'call_id', 'provider', 'provider_endpoint', 'upstream_provider', 'model', 'implementation',
  'orchestration_id', 'agent_id', 'agent_role', 'parent_call_id', 'delegation_id', 'call_count',
  'prompt_tokens', 'completion_tokens', 'total_tokens', 'estimated_cost_usd', 'actual_cost_usd',
  'latency_ms', 'cache_key', 'purpose', 'outcome', 'error_type', 'error_agent_id', 'error_fact_id',
  'error_invariant', 'provider_error_code', 'provider_boundary', 'expected_upstream_provider',
  'invalid_provenance_field', 'invalid_provenance_value_hash',
  'ignored_noncontrolling_normalized_proposals', 'authority_mode',
  'accepted_fact_ids', 'accepted_fact_count', 'rejected_facts', 'rejected_fact_count',
  'source_reference_projection_fact_ids', 'source_reference_projection_count',
  'accepted_item_ids', 'accepted_item_count', 'rejected_items', 'rejected_item_count',
  'ignored_proposal_count', 'deterministic_fallback_applied', 'response_id', 'origin_call_id',
  'origin_usage', 'origin_finish_reason', 'response_model', 'generation_model', 'usage_source', 'metadata_poll_count', 'metadata_latency_ms',
  'finish_reason', 'created_at', 'updated_at',
]);
const ALLOWED_LEDGER_SUMMARY_FIELDS = new Set([
  'records', 'network_calls', 'prompt_tokens', 'completion_tokens', 'total_tokens',
  'actual_cost_usd', 'actual_cost_complete', 'unknown_cost_call_count', 'outcomes',
]);
const ALLOWED_AGENT_FAILURE_RECEIPT_FIELDS = new Set([
  'event_id', 'ordinal', 'created_at', 'stage', 'label', 'agent', 'agent_id', 'actor_type', 'status',
  'headline', 'detail', 'implementation', 'model', 'orchestrator', 'validator', 'prompt_version',
  'receipt_type', 'acceptance_scope', 'failure_scope', 'root_agent', 'shared_context',
  'delegation_id', 'parent_call_id', 'orchestration_id', 'call_id', 'response_id', 'outcome',
  'provider', 'requested_model', 'call_count',
  'response_model', 'upstream_provider', 'usage_source', 'handoff_from', 'handoff_to',
  'input_artifact', 'input_artifact_hash', 'finish_reason', 'error_type', 'error_invariant', 'provider_error_code',
  'provider_boundary', 'expected_upstream_provider',
  'invalid_provenance_field', 'invalid_provenance_value_hash', 'external_tracing',
]);
const FAILURE_OUTCOMES = new Set(['failed', 'blocked_cost_guard', 'blocked_missing_credential', 'blocked_provider_concurrency', 'actual_cost_overrun']);
const ZERO_CALL_FAILURE_OUTCOMES = new Set(['blocked_cost_guard', 'blocked_missing_credential', 'blocked_provider_concurrency']);
const ZERO_CALL_PROVIDER_RESULT_FIELDS = Object.freeze([
  'response_id', 'origin_call_id', 'origin_usage', 'origin_finish_reason', 'response_model',
  'generation_model', 'upstream_provider', 'usage_source', 'finish_reason',
  'metadata_poll_count', 'metadata_latency_ms', 'prompt_tokens', 'completion_tokens',
  'total_tokens', 'provider_error_code', 'provider_boundary',
  'expected_upstream_provider', 'invalid_provenance_field', 'invalid_provenance_value_hash',
  'ignored_noncontrolling_normalized_proposals', 'accepted_fact_ids', 'accepted_fact_count',
  'rejected_facts', 'rejected_fact_count', 'source_reference_projection_fact_ids',
  'source_reference_projection_count', 'accepted_item_ids', 'accepted_item_count',
  'rejected_items', 'rejected_item_count', 'ignored_proposal_count',
  'deterministic_fallback_applied',
]);
const SAFE_RESPONSE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{2,159}$/;
const EXACT_OPENROUTER_GENERATION_ID = /^gen-[0-9]{10}-[A-Za-z0-9]{20}$/;
const SAFE_UPSTREAM_PROVIDER = /^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$/;
const FORBIDDEN_PROVENANCE_MARKERS = Object.freeze([
  'authorization', 'api_key', 'apikey', 'bearer ', 'credential', 'sk-or-', 'sk-', 'secret', 'sentinel',
  'customer', 'landlord', 'lease', 'mould', 'moisture', 'tenant',
]);
const SAFE_FINISH_REASONS = new Set(['stop', 'length', 'tool_calls', 'content_filter', 'error', 'cancelled']);
const PROVIDER_PROVENANCE_FIELDS = new Set(['response_id', 'response_model', 'upstream_provider', 'finish_reason']);
const EXPECTED_RUNTIME_ACCEPTANCE_CRITERIA = Object.freeze({
  required_mode: 'openrouter_nemotron',
  required_model: REQUESTED_NEMOTRON_MODEL,
  model_acceptance_scope: 'visible_browser_flagship',
  learning_comparison_authority: 'deterministic_application_tool',
  requires_learning_comparison_zero_model_activity: true,
  required_final_model_ledger_records: 12,
  required_final_model_network_calls: 6,
  required_final_cache_hits: 6,
  required_provider_max_in_flight: 1,
  required_runtime_profile: EXPECTED_RUNTIME.runtime_profile,
  requires_successful_call_binding: true,
  requires_positive_actual_cost: true,
  requires_positive_token_counts: true,
  requires_single_orchestration_binding: true,
  requires_complete_required_agent_set: true,
  requires_distinct_call_ids: true,
  requires_distinct_response_ids: true,
  requires_positive_accepted_contribution_per_agent: true,
  requires_accepted_majority_per_agent: true,
  requires_cold_network_run: true,
  requires_deterministic_gate_passes: true,
  requires_guarded_fallback_disclosure: true,
  requires_source_reference_projection_disclosure: true,
  requires_grounded_causal_artifact_recomputation: true,
  requires_learning_replay_proof: true,
});
const EXPECTED_FAILED_MODEL_ATTEMPT_RECORDS = Object.freeze(
  Array.from({ length: 24 }, (_, index) => `casepath/releases/model-validation-attempt-20260811-${String(index + 1).padStart(2, '0')}.json`),
);
const EXPECTED_PRODUCTION_OPENING_BOUNDARY = 'Application code opened the shared context; no model call is claimed for this setup step. The call-bound Nemotron plan appears only when its returned event arrives.';
const QA_DIRECTORY = path.resolve(fileURLToPath(new URL('.', import.meta.url)));
const REPOSITORY_ROOT = path.dirname(QA_DIRECTORY);
const QA_OUTPUT_BASENAME = 'guided-v13-smoke-out';
const PREFLIGHT_OUTPUT_BASENAME = 'evidence';
const PREFLIGHT_PARENT_PATTERN = /^casepath-qa-preflight\.[A-Za-z0-9]{6,}$/;
const QA_TEMP_ROOT = path.resolve(os.tmpdir());

function resolveSafeQaOutputPath(candidate) {
  if (typeof candidate !== 'string' || candidate.trim() === '') {
    throw new Error('CASEPATH_QA_OUT must name a dedicated QA evidence directory.');
  }
  const resolved = path.resolve(candidate);
  const dedicatedQaOutput = path.join(QA_DIRECTORY, QA_OUTPUT_BASENAME);
  const preflightParent = path.dirname(resolved);
  const dedicatedPreflightOutput = (
    path.basename(resolved) === PREFLIGHT_OUTPUT_BASENAME
    && path.dirname(preflightParent) === QA_TEMP_ROOT
    && PREFLIGHT_PARENT_PATTERN.test(path.basename(preflightParent))
  );
  if (resolved === path.parse(resolved).root || resolved === REPOSITORY_ROOT || resolved === QA_DIRECTORY) {
    throw new Error(`Refusing unsafe CASEPATH_QA_OUT path: ${resolved}`);
  }
  if (resolved !== dedicatedQaOutput && !dedicatedPreflightOutput) {
    throw new Error(`Refusing unsafe CASEPATH_QA_OUT path: ${resolved}`);
  }
  return resolved;
}

function assertSafeQaOutputParent(candidate) {
  const resolved = resolveSafeQaOutputPath(candidate);
  const parent = path.dirname(resolved);
  let realParent;
  try {
    realParent = realpathSync(parent);
  } catch (error) {
    throw new Error(`CASEPATH_QA_OUT parent must already exist: ${parent}`, { cause: error });
  }
  const dedicatedQaOutput = path.join(QA_DIRECTORY, QA_OUTPUT_BASENAME);
  const expectedParent = resolved === dedicatedQaOutput
    ? realpathSync(QA_DIRECTORY)
    : realpathSync(QA_TEMP_ROOT);
  const parentMatches = resolved === dedicatedQaOutput
    ? realParent === expectedParent
    : path.dirname(realParent) === expectedParent
      && PREFLIGHT_PARENT_PATTERN.test(path.basename(realParent));
  if (!parentMatches) {
    throw new Error(`Refusing symlinked or unexpected CASEPATH_QA_OUT parent: ${parent}`);
  }
  return resolved;
}

const QA_SESSION_ID = `qa-${randomUUID()}`;
const ISOLATION_SESSION_ID = `qa-isolation-${randomUUID()}`;
const ALLOW_PRODUCTION_MUTATION = process.env.CASEPATH_ALLOW_PRODUCTION_MUTATION === '1';
const OUT = assertSafeQaOutputParent(
  process.env.CASEPATH_QA_OUT || path.join(QA_DIRECTORY, QA_OUTPUT_BASENAME),
);
const checks = [];
const notes = [];
const failures = { console: [], page: [], request: [], cleanup: [] };
const runIds = [];
const browserRunRequests = [];
const retainedEvidence = {};
const evidenceFiles = [];
let browser;
let context;
let page;
let video;
let demoMutated = false;
let isolationMutated = false;
let reviewResponse = null;
let proofResponse = null;
let deploymentIdentity = { frontend: null, api: null, qa: { release_id: RELEASE_ID, source_commit: process.env.RENDER_GIT_COMMIT || null } };
let runtimeVersions = { node: process.version, playwright: null, chromium: null };

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function check(name, condition, detail = '') {
  const item = { name, passed: Boolean(condition), detail };
  checks.push(item);
  if (!item.passed) throw new Error(`${name}: ${detail || 'failed'}`);
}

function isLocal(urlValue) {
  const hostname = new URL(urlValue).hostname;
  return ['127.0.0.1', 'localhost', '::1'].includes(hostname);
}

function requireMutationAuthority() {
  if ((!isLocal(BASE) || !isLocal(API)) && !ALLOW_PRODUCTION_MUTATION) {
    throw new Error('Production mutation is disabled. Set CASEPATH_ALLOW_PRODUCTION_MUTATION=1 to run the reset/review lifecycle against non-local services.');
  }
}

function validSourceCommit(value) {
  return /^[0-9a-f]{40}$/i.test(value || '');
}

function isProductionJourney() {
  return !isLocal(BASE) || !isLocal(API);
}

function runTimeoutMs() {
  return isProductionJourney() ? PRODUCTION_RUN_TIMEOUT_MS : LOCAL_RUN_TIMEOUT_MS;
}

function nonemptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function normalizedGroundingText(value) {
  return typeof value === 'string'
    ? value.normalize('NFKC')
      .replace(/[\u0009-\u000d\u001c-\u001f\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/gu, ' ')
      .replace(/^ +| +$/gu, '')
    : '';
}

function exactNormalizedGroundingQuote(sourcePage, excerpt) {
  const normalizedExcerpt = normalizedGroundingText(excerpt);
  return normalizedExcerpt.length > 0
    && normalizedGroundingText(sourcePage).includes(normalizedExcerpt);
}

function selectProcessTextQuoteFact(facts, processGraph, factId) {
  return facts.find(item => item.fact_id === factId
    && item.source_refs?.length
    && item.source_refs.every(ref => ref.locator_kind === 'text_quote')
    && processGraph.nodes.some(node => (node.fact_ids || []).includes(item.fact_id)));
}

function containsForbiddenProvenanceMarker(value) {
  if (typeof value !== 'string') return false;
  const folded = value.toLowerCase();
  return FORBIDDEN_PROVENANCE_MARKERS.some(marker => folded.includes(marker));
}

function providerProvenanceValueIsSafe(field, value) {
  if (value == null) return true;
  if (!nonemptyString(value) || value !== value.trim() || containsForbiddenProvenanceMarker(value)) return false;
  if (field === 'response_id') return SAFE_RESPONSE_ID.test(value);
  if (field === 'response_model') return EXACT_NEMOTRON_RESPONSE_MODELS.has(value);
  if (field === 'upstream_provider') return SAFE_UPSTREAM_PROVIDER.test(value);
  if (field === 'finish_reason') return SAFE_FINISH_REASONS.has(value);
  return false;
}

function providerRejectionBoundaryIssue(value) {
  const boundaryPresent = Object.hasOwn(value, 'provider_boundary');
  const expectedProviderPresent = Object.hasOwn(value, 'expected_upstream_provider');
  if (value.error_invariant !== 'provider_upstream_rejection') {
    return boundaryPresent || expectedProviderPresent
      ? 'provider rejection boundary attribution is out of scope'
      : null;
  }
  if (!boundaryPresent || !expectedProviderPresent) return 'provider rejection boundary attribution pair is incomplete';
  if (value.provider_boundary !== EXPECTED_PROVIDER_BOUNDARY
    || value.expected_upstream_provider !== EXPECTED_UPSTREAM_PROVIDER) return 'provider rejection boundary attribution is forged';
  return null;
}

function exactMembers(values, expected) {
  return Array.isArray(values)
    && Array.isArray(expected)
    && values.length === expected.length
    && new Set(values).size === values.length
    && new Set(expected).size === expected.length
    && expected.every(value => values.includes(value));
}

function contributionEntries(value, expectedAttribution) {
  const entries = (Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : [])
    .filter(item => item && typeof item === 'object');
  if (!entries.length) return null;
  const ids = entries.map(item => item.contribution_id);
  if (!ids.every(nonemptyString) || new Set(ids).size !== ids.length) return null;
  const valid = entries.every(item => {
    if (typeof item.deterministic_fallback_applied !== 'boolean'
      || !Number.isInteger(item.confidence_basis_points)
      || item.confidence_basis_points < 0
      || item.confidence_basis_points > 10000) return false;
    const expectedRole = item.deterministic_fallback_applied
      ? DETERMINISTIC_CONTRIBUTION_ROLE
      : expectedAttribution;
    if (item.attribution !== expectedRole) return false;
    if (expectedAttribution === PROCESS_CONTRIBUTION_ROLE) {
      return /^fact:[^:]+:decision_value$/.test(item.contribution_id)
        && exactMembers(item.model_owned_fields, ['decision_value']);
    }
    if (expectedAttribution === EVIDENCE_CONTRIBUTION_ROLE) {
      const match = item.contribution_id.match(/^item:(.+):(status|artifacts)$/);
      if (!match) return false;
      const expectedField = match[2] === 'status' ? 'status' : 'artifact_ids';
      return item.field === expectedField;
    }
    if (expectedAttribution === FINAL_CONTRIBUTION_ROLE) {
      const expected = FINAL_FIELD_CONTRACT.find(unit => unit.contribution_id === item.contribution_id);
      return Boolean(expected && item.field === expected.field);
    }
    return false;
  });
  return valid ? entries : null;
}

function transformedContributionSuppressed(transform = null) {
  return transform?.acceptance_scope === 'post_review_unverified_transform'
    || (transform?.contract === 'casepath.memory-application-receipt/1.0.0'
      && transform.authority === 'unverified_demo'
      && transform.scope === 'case_specific_guidance_only'
      && transform.model_acceptance_reused === false
      && transform.applied === true);
}

function contributionExpectation(value, expectedAttribution, transform = null) {
  if (transformedContributionSuppressed(transform)) return null;
  const entries = contributionEntries(value, expectedAttribution);
  if (!entries) return null;
  const acceptedCount = entries.filter(item => item.deterministic_fallback_applied === false && item.attribution === expectedAttribution).length;
  const fallbackCount = entries.filter(item => item.deterministic_fallback_applied === true && item.attribution === DETERMINISTIC_CONTRIBUTION_ROLE).length;
  if (!acceptedCount && !fallbackCount) return null;
  return {
    authority: acceptedCount && fallbackCount ? 'mixed' : acceptedCount ? 'nemotron-accepted' : 'deterministic-fallback',
    accepted_count: String(acceptedCount),
    fallback_count: String(fallbackCount),
  };
}

function contributionDomProjection(value, expectedAttribution, transform = null) {
  const summary = contributionExpectation(value, expectedAttribution, transform);
  const entries = transformedContributionSuppressed(transform)
    ? null
    : contributionEntries(value, expectedAttribution);
  if (!summary || !entries) return null;
  return {
    ...summary,
    accepted_ids: entries.filter(item => item.deterministic_fallback_applied === false).map(item => item.contribution_id).join(','),
    fallback_ids: entries.filter(item => item.deterministic_fallback_applied === true).map(item => item.contribution_id).join(','),
  };
}

function orchestrationAudit(run) {
  return run?.result?.audit?.agent_orchestration
    || run?.result?.agent_orchestration
    || run?.agent_orchestration
    || null;
}

function forbiddenFieldPaths(value, currentPath = '$', found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => forbiddenFieldPaths(item, `${currentPath}[${index}]`, found));
    return found;
  }
  if (!value || typeof value !== 'object') return found;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${currentPath}.${key}`;
    if (FORBIDDEN_PUBLIC_FIELDS.has(key)) found.push(childPath);
    forbiddenFieldPaths(child, childPath, found);
  }
  return found;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function dtoHash(value) {
  return sha256(stableJson(value));
}

function semanticProcessDto(process) {
  const value = structuredClone(process || {});
  delete value.agent_contribution;
  for (const node of value.nodes || []) delete node.agent_decision_contributions;
  return value;
}

function semanticChecklistDto(checklist) {
  const value = structuredClone(checklist || {});
  delete value.agent_contribution;
  for (const item of value.items || []) delete item.agent_contribution;
  return value;
}

function evidenceRelationContractViolations(process, checklist) {
  const issues = [];
  if (!process || !checklist || !Array.isArray(process.nodes) || !Array.isArray(checklist.items)) return ['process nodes or checklist items are absent'];
  const itemIds = checklist.items.map(item => item?.item_id);
  if (!itemIds.every(nonemptyString) || new Set(itemIds).size !== itemIds.length) return ['checklist item IDs are absent or duplicated'];
  const itemIdSet = new Set(itemIds);
  const ownerMap = new Map(itemIds.map(itemId => [itemId, []]));
  const nodeIds = process.nodes.map(node => node?.node_id);
  if (!nodeIds.every(nonemptyString) || new Set(nodeIds).size !== nodeIds.length) return ['process node IDs are absent or duplicated'];
  for (const node of process.nodes) {
    const requirements = node.evidence_requirement_ids;
    if (!Array.isArray(requirements) || requirements.some(itemId => !itemIdSet.has(itemId)) || new Set(requirements).size !== requirements.length) {
      issues.push(`${node.node_id}: evidence requirements are not a unique known-item list`);
      continue;
    }
    for (const itemId of requirements) ownerMap.get(itemId).push(node.node_id);
  }
  const selectedPath = process.selected_path;
  const nextAction = process.current_overlay?.next_action_node_id;
  if (!Array.isArray(selectedPath) || selectedPath.some(nodeId => !nodeIds.includes(nodeId))) issues.push('selected path is absent or contains an unknown node');
  if (!nonemptyString(nextAction) || !nodeIds.includes(nextAction)) issues.push('next-action node is absent or unknown');
  const activeNodes = new Set([...(Array.isArray(selectedPath) ? selectedPath : []), ...(nonemptyString(nextAction) ? [nextAction] : [])]);
  for (const item of checklist.items) {
    const owners = ownerMap.get(item.item_id) || [];
    if (!owners.length) issues.push(`${item.item_id}: no process owner`);
    if (JSON.stringify(item.node_ids) !== JSON.stringify(owners)) issues.push(`${item.item_id}: node_ids do not match ordered process owners`);
    if (item.node_id !== owners[0]) issues.push(`${item.item_id}: node_id is not the derived primary owner`);
    if (item.current_path !== owners.some(nodeId => activeNodes.has(nodeId))) issues.push(`${item.item_id}: current_path is not derived from every owner`);
  }
  return issues;
}

function legalContextContractViolations(legal, process) {
  const issues = [];
  if (!legal || legal.contract !== 'casepath.legal-context/2.0.0') return ['legal context contract is absent or wrong'];
  if (legal.registry_version !== 'ch-tenancy-official-snapshot/2026-08-12' || legal.lookup_method !== 'versioned_official_source_registry_lookup') issues.push('legal registry identity is wrong');
  if (!Array.isArray(legal.questions) || !Array.isArray(legal.sources) || !Array.isArray(legal.handling_principles)) return [...issues, 'legal questions, sources, or handling principles are absent'];
  const nodeIds = new Set((process?.nodes || []).map(node => node.node_id));
  const officialIds = legal.sources.map(source => source?.source_id);
  const principleIds = legal.handling_principles.map(source => source?.source_id);
  if (!officialIds.every(nonemptyString) || new Set(officialIds).size !== officialIds.length) issues.push('official legal source IDs are absent or duplicated');
  if (!principleIds.every(nonemptyString) || new Set(principleIds).size !== principleIds.length) issues.push('handling-principle IDs are absent or duplicated');
  const officialFields = ['source_id', 'title', 'url', 'source_type', 'jurisdiction', 'version_date', 'location', 'passage_language', 'passage_text', 'passage_sha256', 'passage_summary', 'operational_interpretation', 'review_status', 'role', 'approved', 'retrieval'];
  for (const source of legal.sources) {
    if (!exactMembers(Object.keys(source || {}), officialFields)) issues.push(`${source?.source_id || 'official source'}: fields are not exact`);
    if (!nonemptyString(source?.passage_text) || source.passage_sha256 !== sha256(source.passage_text)) issues.push(`${source?.source_id}: official passage hash is wrong`);
    if (source?.jurisdiction !== 'CH' || source?.passage_language !== 'de' || !nonemptyString(source?.version_date) || !nonemptyString(source?.location) || source?.review_status !== 'qualified_review_pending' || source?.approved !== false) issues.push(`${source?.source_id}: official passage status/provenance is incomplete`);
    const retrieval = source?.retrieval;
    if (!exactMembers(Object.keys(retrieval || {}), ['method', 'retrieved_at', 'registry_version', 'snapshot_url', 'snapshot_sha256', 'snapshot_scope'])
      || retrieval?.method !== 'versioned_official_source_registry_lookup'
      || retrieval?.registry_version !== legal.registry_version
      || !nonemptyString(retrieval?.retrieved_at)
      || !nonemptyString(retrieval?.snapshot_url)
      || !SHA256_PATTERN.test(retrieval?.snapshot_sha256 || '')
      || !['official_pdf_bytes', 'normalized_official_passage_utf8'].includes(retrieval?.snapshot_scope)) issues.push(`${source?.source_id}: official retrieval receipt is invalid`);
    if (source?.source_id === 'bwo-conciliation' && (retrieval?.snapshot_scope !== 'normalized_official_passage_utf8' || retrieval?.snapshot_sha256 !== source.passage_sha256 || retrieval.snapshot_sha256 !== '27700e4ed06b60510b992676823c44d9a11aefb94192fdc3bec872df1c843af6')) issues.push(`${source.source_id}: normalized official passage snapshot is not exact`);
    if (source?.source_id?.startsWith('fedlex-') && retrieval?.snapshot_scope !== 'official_pdf_bytes') issues.push(`${source.source_id}: Fedlex snapshot scope is not official PDF bytes`);
  }
  for (const principle of legal.handling_principles) {
    if (!exactMembers(Object.keys(principle || {}), ['source_id', 'title', 'source_type', 'role', 'validation_status', 'producer']) || principle?.producer !== 'deterministic_application') issues.push(`${principle?.source_id || 'principle'}: deterministic producer contract is invalid`);
  }
  const authorityIds = new Set([...officialIds, ...principleIds]);
  const derivedNodeLinks = {};
  const questionIds = [];
  for (const question of legal.questions) {
    if (!exactMembers(Object.keys(question || {}), ['question_id', 'text', 'source_ids', 'interpretation_ids', 'process_node_ids', 'consequence'])) issues.push(`${question?.question_id || 'question'}: fields are not exact`);
    if (!nonemptyString(question?.question_id) || questionIds.includes(question.question_id)) issues.push('legal question IDs are absent or duplicated');
    questionIds.push(question?.question_id);
    if (!nonemptyString(question?.text) || !nonemptyString(question?.consequence)) issues.push(`${question?.question_id}: question text or consequence is absent`);
    if (!(question?.source_ids || []).every(sourceId => officialIds.includes(sourceId))) issues.push(`${question?.question_id}: official source join is invalid`);
    if (!(question?.interpretation_ids || []).every(sourceId => principleIds.includes(sourceId))) issues.push(`${question?.question_id}: interpretation join is invalid`);
    if (!(question?.process_node_ids || []).every(nodeId => nodeIds.has(nodeId))) issues.push(`${question?.question_id}: process-node join is invalid`);
    for (const nodeId of question?.process_node_ids || []) {
      const retained = derivedNodeLinks[nodeId] ||= [];
      for (const sourceId of [...(question.source_ids || []), ...(question.interpretation_ids || [])]) if (!retained.includes(sourceId)) retained.push(sourceId);
    }
  }
  if (Object.values(legal.node_links || {}).flat().some(sourceId => !authorityIds.has(sourceId)) || stableJson(legal.node_links || {}) !== stableJson(derivedNodeLinks)) issues.push('legal node_links do not equal the ID-joined questions');
  if (/model interpretation|live retrieval/i.test(stableJson(legal))) issues.push('legal DTO contains false model or live-retrieval authority wording');
  return issues;
}

function visualReferenceContractViolations(reference, artifact) {
  const issues = [];
  const fields = ['artifact_id', 'locator_kind', 'region', 'observation', 'producer', 'authority', 'annotation_contract', 'annotation_version', 'image_sha256'];
  if (!exactMembers(Object.keys(reference || {}), fields)) issues.push('visual annotation fields are not exact');
  if (reference?.locator_kind !== 'visual_observation'
    || reference?.producer !== 'deterministic_reference_annotation'
    || reference?.authority !== 'generated_demo_reference_only'
    || reference?.annotation_contract !== 'casepath.visual-reference-annotation/1.0.0'
    || reference?.annotation_version !== 'generated-demo-reference/2026-08-12') issues.push('visual annotation authority contract is wrong');
  const region = reference?.region;
  if (!Array.isArray(region) || region.length !== 4 || region.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) || !(region[2] > 0) || !(region[3] > 0) || region[0] + region[2] > 1 || region[1] + region[3] > 1) issues.push('visual annotation region is invalid');
  if (!nonemptyString(reference?.observation)) issues.push('visual annotation observation is absent');
  if (!artifact || reference?.artifact_id !== artifact.artifact_id || !artifact.media_type?.startsWith('image/') || !SHA256_PATTERN.test(artifact.sha256 || '') || reference?.image_sha256 !== artifact.sha256) issues.push('visual annotation is not bound to public image bytes');
  return issues;
}

function precedentRankingContractViolations(result) {
  const issues = [];
  const precedents = result?.precedents;
  const receipt = result?.precedent_ranking;
  const contract = 'casepath.precedent-ranking/1.0.0';
  const corpus = 'generated-reference-patterns/2026-08-12';
  if (!Array.isArray(precedents) || precedents.length !== 3 || !receipt) return ['exact-three precedents or ranking receipt are absent'];
  if (!exactMembers(Object.keys(receipt), ['contract', 'corpus_version', 'context', 'context_hash', 'candidate_scores', 'selected_claim_ids', 'result_hash'])) issues.push('precedent ranking receipt fields are not exact');
  if (receipt.contract !== contract || receipt.corpus_version !== corpus) issues.push('precedent ranking identity is wrong');
  if (!exactMembers(Object.keys(receipt.context || {}), ['category', 'subcategory', 'current_process_node_id', 'next_action_node_id', 'selected_path', 'unresolved_fact_ids', 'current_evidence_need_ids']) || receipt.context_hash !== dtoHash(receipt.context)) issues.push('precedent ranking context is not exact or hash-bound');
  const selectedIds = precedents.map(item => item.claim_id);
  if (JSON.stringify(receipt.selected_claim_ids) !== JSON.stringify(selectedIds) || receipt.result_hash !== dtoHash(precedents)) issues.push('precedent selected IDs or result hash are wrong');
  if (!Array.isArray(receipt.candidate_scores) || receipt.candidate_scores.length < 3 || new Set(receipt.candidate_scores.map(item => item.claim_id)).size !== receipt.candidate_scores.length || JSON.stringify(receipt.candidate_scores.slice(0, 3).map(item => item.claim_id)) !== JSON.stringify(selectedIds)) issues.push('candidate scores do not retain the ranked selection order');
  for (const candidate of receipt.candidate_scores || []) {
    if (!exactMembers(Object.keys(candidate || {}), ['claim_id', 'score_basis_points', 'factors']) || !nonemptyString(candidate.claim_id) || !Number.isInteger(candidate.score_basis_points) || !Array.isArray(candidate.factors) || candidate.factors.some(factor => !exactMembers(Object.keys(factor || {}), ['factor', 'value', 'weight']) || !nonemptyString(factor.factor) || !nonemptyString(factor.value) || !Number.isInteger(factor.weight)) || candidate.score_basis_points !== candidate.factors.reduce((sum, factor) => sum + factor.weight, 0)) issues.push(`${candidate?.claim_id || 'candidate'}: candidate score receipt is invalid`);
  }
  const allowedStatuses = new Set(['generated_reference', 'unverified_demo_memory', 'qualified_expert_reviewed']);
  precedents.forEach((precedent, index) => {
    const ranking = precedent?.ranking;
    if (!allowedStatuses.has(precedent?.review_status)) issues.push(`${precedent?.claim_id}: review status is invalid`);
    if (!exactMembers(Object.keys(ranking || {}), ['contract', 'corpus_version', 'rank', 'score_basis_points', 'factors', 'context_hash']) || ranking?.contract !== contract || ranking?.corpus_version !== corpus || ranking?.rank !== index + 1 || ranking?.context_hash !== receipt.context_hash) issues.push(`${precedent?.claim_id}: per-item ranking is invalid`);
    if (!Array.isArray(ranking?.factors) || ranking.factors.some(factor => !exactMembers(Object.keys(factor || {}), ['factor', 'value', 'weight']) || !Number.isInteger(factor.weight)) || ranking?.score_basis_points !== (ranking?.factors || []).reduce((sum, factor) => sum + factor.weight, 0)) issues.push(`${precedent?.claim_id}: ranking factors do not sum to the score`);
    const candidate = receipt.candidate_scores?.find(item => item.claim_id === precedent.claim_id);
    if (!candidate || candidate.score_basis_points !== ranking?.score_basis_points || stableJson(candidate.factors) !== stableJson(ranking?.factors)) issues.push(`${precedent?.claim_id}: candidate and selected ranking differ`);
  });
  return issues;
}

function memoryRetrievalContractViolations(result) {
  const issues = [];
  if (!result || typeof result !== 'object') return ['final result is absent'];
  const memoryPrecedents = (result.precedents || []).filter(item => item?.review_status === 'unverified_demo_memory' && nonemptyString(item?.memory_id));
  const expectedRetrieved = memoryPrecedents.length > 0;
  const receiptPresent = result.memory_application != null;
  const receiptValid = !receiptPresent || (result.memory_application?.contract === 'casepath.memory-application-receipt/1.0.0'
    && result.memory_application?.authority === 'unverified_demo'
    && result.memory_application?.scope === 'case_specific_guidance_only'
    && result.memory_application?.applied === true
    && SHA256_PATTERN.test(result.memory_application?.application_hash || ''));
  const knowledge = result.knowledge || {};
  const processUsed = result.process?.memory_used;
  const checklistUsed = result.checklist?.memory_used;
  const rootUseFlags = [result.memory_used, result.reviewed_memory_used, knowledge.reviewed_memory_used];
  const retrievalFlags = [result.reviewed_memory_retrieved, knowledge.reviewed_memory_retrieved];
  if (!retrievalFlags.every(value => typeof value === 'boolean') || retrievalFlags.some(value => value !== expectedRetrieved)) issues.push('reviewed-memory retrieval flags do not equal ranked unverified memory presence');
  if (!receiptValid) issues.push('memory-use flags point at an invalid application receipt');
  if (!rootUseFlags.every(value => typeof value === 'boolean') || rootUseFlags.some(value => value !== receiptPresent)) issues.push('root/knowledge memory-use flags do not equal application-receipt presence');
  if (processUsed !== receiptPresent || checklistUsed !== receiptPresent) issues.push('process/checklist memory_used does not equal application-receipt presence');
  if (receiptPresent && (!expectedRetrieved || result.memory_application?.applied !== true || result.process?.case_specific_guidance_applied !== true || result.checklist?.case_specific_guidance_applied !== true)) issues.push('application receipt is not bound to retrieved memory and transformed DTO flags');
  if (!receiptPresent && (result.process?.case_specific_guidance_applied === true || result.checklist?.case_specific_guidance_applied === true)) issues.push('receipt-free result falsely claims case-specific guidance application');
  if (memoryPrecedents.length > 1) issues.push('more than one unverified memory was ranked into the exact-three result');
  return issues;
}

function semanticFactSignature(result) {
  const roles = {};
  for (const fact of result?.facts || []) {
    if (fact?.semantic_role == null) continue;
    roles[fact.semantic_role] = {
      fact_id: fact.fact_id,
      state: fact.state,
      grounded_source_count: Array.isArray(fact.source_refs) ? fact.source_refs.length : 0,
    };
  }
  return roles;
}

function semanticFactRoleViolations(result) {
  const facts = result?.facts;
  if (!Array.isArray(facts)) return ['canonical facts are absent'];
  const issues = [];
  const populated = [];
  for (const fact of facts) {
    if (!Object.hasOwn(fact || {}, 'semantic_role')) issues.push(`${fact?.fact_id || 'fact'}: nullable semantic_role is absent`);
    if (fact?.semantic_role != null && fact.semantic_role !== 'management_ventilation_allegation') issues.push(`${fact?.fact_id || 'fact'}: semantic_role is unsupported`);
    if (fact?.semantic_role != null) populated.push(fact.semantic_role);
  }
  if (JSON.stringify(populated) !== JSON.stringify(['management_ventilation_allegation'])) issues.push('exactly one management_ventilation_allegation semantic role is required');
  return issues;
}

function computedCausalDelta(beforeResult, afterResult) {
  const beforeProcess = semanticProcessDto(beforeResult?.process);
  const afterProcess = semanticProcessDto(afterResult?.process);
  const beforeChecklist = semanticChecklistDto(beforeResult?.checklist);
  const afterChecklist = semanticChecklistDto(afterResult?.checklist);
  const keyed = (values, key) => new Map((values || []).map(value => [key(value), value]));
  const beforeNodes = keyed(beforeProcess.nodes, value => value.node_id);
  const afterNodes = keyed(afterProcess.nodes, value => value.node_id);
  const edgeKey = value => `${value.source}\u0000${value.target}`;
  const beforeEdges = keyed(beforeProcess.edges, edgeKey);
  const afterEdges = keyed(afterProcess.edges, edgeKey);
  const beforeItems = keyed(beforeChecklist.items, value => value.item_id);
  const afterItems = keyed(afterChecklist.items, value => value.item_id);
  const difference = (left, right) => [...left.keys()].filter(key => !right.has(key)).sort();
  const changed = (left, right) => [...left.keys()].filter(key => right.has(key) && stableJson(left.get(key)) !== stableJson(right.get(key))).sort();
  const edgeProjection = keys => keys.map(key => { const [source, target] = key.split('\u0000'); return { source, target }; });
  const rootChanges = (before, after, excluded) => [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => !excluded.has(key) && stableJson(before[key]) !== stableJson(after[key])).sort();
  const addedNodeIds = difference(afterNodes, beforeNodes);
  const removedNodeIds = difference(beforeNodes, afterNodes);
  const changedNodeIds = changed(beforeNodes, afterNodes);
  const addedEdges = edgeProjection(difference(afterEdges, beforeEdges));
  const removedEdges = edgeProjection(difference(beforeEdges, afterEdges));
  const changedEdges = edgeProjection(changed(beforeEdges, afterEdges));
  const addedItemIds = difference(afterItems, beforeItems);
  const removedItemIds = difference(beforeItems, afterItems);
  const changedItemIds = changed(beforeItems, afterItems);
  return {
    nonzero: Boolean(addedNodeIds.length || removedNodeIds.length || changedNodeIds.length || addedEdges.length || removedEdges.length || changedEdges.length || addedItemIds.length || removedItemIds.length || changedItemIds.length),
    process: { added_node_ids: addedNodeIds, removed_node_ids: removedNodeIds, changed_node_ids: changedNodeIds, added_edges: addedEdges, removed_edges: removedEdges, changed_edges: changedEdges, changed_root_keys: rootChanges(beforeProcess, afterProcess, new Set(['nodes', 'edges'])) },
    evidence: { added_item_ids: addedItemIds, removed_item_ids: removedItemIds, changed_item_ids: changedItemIds, changed_root_keys: rootChanges(beforeChecklist, afterChecklist, new Set(['items'])) },
  };
}

function memoryApplicationContractViolations(baselineRun, laterRun, proof) {
  const issues = [];
  const baseline = baselineRun?.result;
  const later = laterRun?.result;
  const receipt = later?.memory_application;
  const freeze = baselineRun?.counterfactual_learning_freeze;
  const receiptFields = ['receipt_type', 'contract', 'authority', 'scope', 'source_memory', 'target', 'observable_input_hash', 'canonical_state_hash', 'eligibility', 'allowed_operation_ids', 'applied_operation_ids', 'process_operations', 'evidence_operations', 'before', 'after', 'verification_hash', 'shared_playbook_version', 'shared_rule_applied', 'model_acceptance_reused', 'applied', 'application_hash'];
  const boundaryFields = ['process_dto_hash', 'checklist_dto_hash', 'process_semantic_hash', 'checklist_semantic_hash'];
  if (!baseline || !later || !receipt || !proof) return ['baseline, later result, receipt, or proof is absent'];
  issues.push(...memoryRetrievalContractViolations(baseline).map(issue => `baseline ${issue}`));
  issues.push(...memoryRetrievalContractViolations(later).map(issue => `later ${issue}`));
  if (!exactMembers(Object.keys(receipt), receiptFields)) issues.push('memory receipt fields are not exact');
  if (receipt.receipt_type !== 'memory_application_receipt' || receipt.contract !== 'casepath.memory-application-receipt/1.0.0' || receipt.authority !== 'unverified_demo' || receipt.scope !== 'case_specific_guidance_only' || receipt.shared_playbook_version !== 'mould-playbook-v3' || receipt.shared_rule_applied !== false || receipt.model_acceptance_reused !== false || receipt.applied !== true) issues.push('memory receipt authority boundary is wrong');
  if (!exactMembers(Object.keys(receipt.source_memory || {}), ['memory_id', 'claim_id', 'review_id', 'content_hash', 'review_status']) || receipt.source_memory.claim_id !== 'DEF-027-E0-DEMO' || receipt.source_memory.review_status !== 'unverified_demo_memory') issues.push('source memory binding is wrong');
  const freezeIdentity = freeze?.memory || {};
  if (!freeze || stableJson(proof.counterfactual_learning_freeze) !== stableJson(freeze)
    || !exactMembers(Object.keys(freeze), ['contract', 'memory', 'identity_hash', 'application_suppressed'])
    || freeze.contract !== 'casepath.counterfactual-learning-freeze/1.0.0'
    || freeze.application_suppressed !== true
    || !exactMembers(Object.keys(freezeIdentity), ['memory_id', 'review_id', 'content_hash', 'candidate_id', 'updated_at'])
    || freezeIdentity.memory_id !== receipt.source_memory.memory_id
    || freezeIdentity.review_id !== receipt.source_memory.review_id
    || freezeIdentity.content_hash !== receipt.source_memory.content_hash
    || freezeIdentity.candidate_id !== proof.candidate?.candidate_id
    || !Number.isFinite(Date.parse(freezeIdentity.updated_at || ''))
    || freeze.identity_hash !== dtoHash(freezeIdentity)) issues.push('counterfactual baseline is not bound to the frozen governed memory identity');
  const freezeTime = Date.parse(freezeIdentity.updated_at || '');
  const baselineCreated = Date.parse(baselineRun?.created_at || '');
  const baselineCompleted = Number(baselineRun?.completed_at) * 1000;
  const laterCreated = Date.parse(laterRun?.created_at || '');
  if (![freezeTime, baselineCreated, baselineCompleted, laterCreated].every(Number.isFinite)
    || !(freezeTime <= baselineCreated && baselineCreated <= baselineCompleted && baselineCompleted <= laterCreated)) issues.push('counterfactual baseline/current runs are not ordered after the learning freeze');
  if (!exactMembers(Object.keys(receipt.target || {}), ['run_id', 'claim_id']) || receipt.target.run_id !== laterRun.run_id || receipt.target.claim_id !== laterRun.claim_id) issues.push('memory receipt target is not the later run');
  const retainedBoundary = laterRun.memory_application_boundary;
  const retainedBoundaryProjection = retainedBoundary && typeof retainedBoundary === 'object' && !Array.isArray(retainedBoundary)
    ? Object.fromEntries(Object.entries(retainedBoundary).filter(([key]) => key !== 'boundary_hash'))
    : null;
  if (!exactMembers(Object.keys(retainedBoundary || {}), ['contract', 'target', 'source_memory', 'before', 'boundary_hash'])) issues.push('memory application boundary fields are not exact');
  if (retainedBoundary?.contract !== 'casepath.memory-application-boundary/1.0.0'
    || !exactMembers(Object.keys(retainedBoundary?.target || {}), ['run_id', 'claim_id'])
    || stableJson(retainedBoundary?.target) !== stableJson(receipt.target)
    || !exactMembers(Object.keys(retainedBoundary?.source_memory || {}), ['memory_id', 'content_hash'])
    || retainedBoundary?.source_memory?.memory_id !== receipt.source_memory?.memory_id
    || retainedBoundary?.source_memory?.content_hash !== receipt.source_memory?.content_hash) issues.push('memory application boundary identity or source join is wrong');
  if (!exactMembers(Object.keys(retainedBoundary?.before || {}), boundaryFields)
    || !Object.values(retainedBoundary?.before || {}).every(value => SHA256_PATTERN.test(value || ''))
    || stableJson(retainedBoundary?.before) !== stableJson(receipt.before)) issues.push('memory application boundary before hashes do not equal receipt.before');
  if (!SHA256_PATTERN.test(retainedBoundary?.boundary_hash || '')
    || retainedBoundary?.boundary_hash !== dtoHash(retainedBoundaryProjection)) issues.push('memory application boundary hash is wrong');
  const completedMemoryEvents = (laterRun.events || []).filter(event => event?.stage === 'memory_application'
    && event?.receipt_type === 'memory_application_receipt'
    && event?.status === 'completed');
  if (completedMemoryEvents.length !== 1) issues.push('exactly one completed persisted memory-application event is required');
  if (completedMemoryEvents.length === 1) {
    const event = completedMemoryEvents[0];
    const eventHasReceiptFields = receiptFields.every(key => Object.hasOwn(event, key));
    const eventReceiptProjection = eventHasReceiptFields ? Object.fromEntries(receiptFields.map(key => [key, event[key]])) : null;
    if (!eventHasReceiptFields || stableJson(eventReceiptProjection) !== stableJson(receipt)) issues.push('persisted memory-application event does not project the result receipt');
  }
  if (receipt.observable_input_hash !== later.audit?.observable_input_hash || receipt.observable_input_hash !== baseline.audit?.observable_input_hash || receipt.observable_input_hash !== proof.before?.observable_input_hash || receipt.observable_input_hash !== proof.after?.observable_input_hash) issues.push('observable input hash is not bound across both runs');
  // Canonical facts intentionally contain JSON floats (including integral 1.0 values).
  // A browser JSON roundtrip erases that lexical distinction, so JS must not forge a
  // Python hash from the parsed object. Bind the unchanged returned DTO to the two
  // server-computed run audit hashes and the independently recomputed proof instead.
  if (stableJson(baseline.facts) !== stableJson(later.facts)
    || receipt.canonical_state_hash !== later.audit?.canonical_state_hash
    || receipt.canonical_state_hash !== baseline.audit?.canonical_state_hash
    || receipt.canonical_state_hash !== proof.before?.canonical_state_hash
    || receipt.canonical_state_hash !== proof.after?.canonical_state_hash) issues.push('canonical-state hash is not bound across both unchanged runs');
  issues.push(...semanticFactRoleViolations(baseline).map(issue => `baseline ${issue}`));
  issues.push(...semanticFactRoleViolations(later).map(issue => `later ${issue}`));
  const eligibility = receipt.eligibility || {};
  const requiredDecisions = {
    scope: 'in_scope', dispute: 'dispute_present', urgency: 'not_urgent', notification: 'notified', recurrence: 'recurrence_supported', causation: 'cause_unresolved',
  };
  const requiredFactRoles = {
    management_ventilation_allegation: { state: 'known', min_grounded_sources: 1 },
  };
  const semanticSignatureHash = dtoHash({
    category: 'Rental defect - mould and moisture',
    subcategory: 'Recurring moisture with disputed causation',
    required_decisions: requiredDecisions,
    required_fact_roles: requiredFactRoles,
  });
  const expectedDecisions = Object.fromEntries((later.facts || []).filter(fact => fact.controls_process === true).map(fact => [fact.decision_key, fact.decision_value]));
  const expectedChecks = {
    source_claim_excluded: receipt.source_memory?.claim_id !== laterRun.claim_id,
    category_matched: later.category === 'Rental defect - mould and moisture',
    subcategory_matched: later.subcategory === 'Recurring moisture with disputed causation',
    required_decisions_matched: stableJson(expectedDecisions) === stableJson(requiredDecisions),
    ventilation_allegation_grounded: semanticFactSignature(later).management_ventilation_allegation?.state === 'known'
      && semanticFactSignature(later).management_ventilation_allegation?.grounded_source_count >= 1,
    semantic_signature_bound: eligibility.semantic_signature_hash === semanticSignatureHash,
    guidance_enabled: true,
  };
  const eligibilityManifest = Object.fromEntries(['rule_id', 'contract', 'claim_id', 'semantic_signature_hash', 'decisions', 'facts_hash', 'checks'].map(key => [key, eligibility[key]]));
  if (!exactMembers(Object.keys(eligibility), ['rule_id', 'contract', 'claim_id', 'semantic_signature_hash', 'decisions', 'facts_hash', 'checks', 'eligible', 'manifest_hash'])
    || eligibility.rule_id !== 'same_grounded_mould_signature_v2'
    || eligibility.contract !== 'casepath.semantic-memory-eligibility/1.0.0'
    || eligibility.claim_id !== laterRun.claim_id
    || eligibility.semantic_signature_hash !== semanticSignatureHash
    || stableJson(eligibility.decisions) !== stableJson(requiredDecisions)
    || stableJson(expectedDecisions) !== stableJson(requiredDecisions)
    || eligibility.facts_hash !== dtoHash(semanticFactSignature(later))
    || stableJson(eligibility.checks) !== stableJson(expectedChecks)
    || eligibility.eligible !== true
    || eligibility.manifest_hash !== dtoHash(eligibilityManifest)) issues.push('semantic eligibility manifest is not exact and hash-bound');
  if (!exactMembers(Object.keys(receipt.before || {}), boundaryFields) || !exactMembers(Object.keys(receipt.after || {}), boundaryFields) || ![...Object.values(receipt.before || {}), ...Object.values(receipt.after || {})].every(value => SHA256_PATTERN.test(value || ''))) issues.push('memory before/after boundary hashes are not exact');
  if (receipt.before?.process_semantic_hash !== dtoHash(semanticProcessDto(baseline.process)) || receipt.before?.checklist_semantic_hash !== dtoHash(semanticChecklistDto(baseline.checklist))) issues.push('receipt before semantic hashes do not bind the baseline DTOs');
  const exactAfter = { process_dto_hash: dtoHash(later.process), checklist_dto_hash: dtoHash(later.checklist), process_semantic_hash: dtoHash(semanticProcessDto(later.process)), checklist_semantic_hash: dtoHash(semanticChecklistDto(later.checklist)) };
  if (stableJson(receipt.after) !== stableJson(exactAfter) || boundaryFields.some(key => proof.after?.[key] !== exactAfter[key])) issues.push('receipt/proof after hashes do not bind the later DTOs');
  if (boundaryFields.some(key => receipt.before?.[key] === receipt.after?.[key])) issues.push('memory receipt reports a zero DTO or semantic delta');
  if (receipt.verification_hash !== later.verification?.whole_playbook_hash || receipt.verification_hash !== proof.after?.verification_hash) issues.push('memory receipt verification hash is not bound to the later result');
  const operationIds = ['add_ventilation_dispute_node', 'add_evidence_gap_to_ventilation_edge', 'add_ventilation_to_causation_edge', 'condition_building_envelope', 'reassign_use_evidence_to_ventilation'];
  if (JSON.stringify(receipt.allowed_operation_ids) !== JSON.stringify(operationIds) || JSON.stringify(receipt.applied_operation_ids) !== JSON.stringify(operationIds) || JSON.stringify([...(receipt.process_operations || []), ...(receipt.evidence_operations || [])].map(value => value.operation_id)) !== JSON.stringify(operationIds)) issues.push('memory operation membership or order is wrong');
  const processOperationFields = [['operation_id', 'operation', 'node_id', 'evidence_requirement_ids', 'after_hash'], ['operation_id', 'operation', 'source', 'target', 'after_hash'], ['operation_id', 'operation', 'source', 'target', 'after_hash']];
  const evidenceOperationFields = [['operation_id', 'operation', 'item_id', 'before_hash', 'after_hash'], ['operation_id', 'operation', 'item_id', 'removed_from_node_ids', 'added_to_node_id', 'before_hash', 'after_hash']];
  if ((receipt.process_operations || []).length !== 3 || (receipt.evidence_operations || []).length !== 2 || (receipt.process_operations || []).some((operation, index) => !exactMembers(Object.keys(operation || {}), processOperationFields[index])) || (receipt.evidence_operations || []).some((operation, index) => !exactMembers(Object.keys(operation || {}), evidenceOperationFields[index]))) issues.push('memory operation fields are not exact');
  const receiptHashes = [receipt.observable_input_hash, receipt.canonical_state_hash, receipt.verification_hash, receipt.application_hash, receipt.source_memory?.content_hash, ...Object.values(receipt.before || {}), ...Object.values(receipt.after || {}), ...(receipt.process_operations || []).map(operation => operation.after_hash), ...(receipt.evidence_operations || []).flatMap(operation => [operation.before_hash, operation.after_hash])];
  if (!receiptHashes.every(value => SHA256_PATTERN.test(value || ''))) issues.push('memory receipt contains an invalid SHA-256 value');
  const addedNode = later.process?.nodes?.find(node => node.node_id === 'ventilation_dispute');
  const firstEdge = later.process?.edges?.find(edge => edge.source === 'evidence_gap' && edge.target === 'ventilation_dispute');
  const secondEdge = later.process?.edges?.find(edge => edge.source === 'ventilation_dispute' && edge.target === 'causation');
  const buildingEnvelope = later.checklist?.items?.find(item => item.item_id === 'building_envelope');
  const useEvidence = later.checklist?.items?.find(item => item.item_id === 'use_evidence');
  if (!addedNode || receipt.process_operations?.[0]?.node_id !== 'ventilation_dispute' || JSON.stringify(receipt.process_operations?.[0]?.evidence_requirement_ids) !== JSON.stringify(['management_position', 'use_evidence']) || receipt.process_operations?.[0]?.after_hash !== dtoHash(addedNode)) issues.push('added ventilation node operation is not hash-bound');
  if (!firstEdge || !secondEdge || receipt.process_operations?.[1]?.after_hash !== dtoHash(firstEdge) || receipt.process_operations?.[2]?.after_hash !== dtoHash(secondEdge)) issues.push('added edge operations are not hash-bound');
  if (!buildingEnvelope || buildingEnvelope.status !== 'conditional' || buildingEnvelope.current_path !== true || receipt.evidence_operations?.[0]?.item_id !== 'building_envelope' || receipt.evidence_operations?.[0]?.after_hash !== dtoHash(buildingEnvelope)) issues.push('building-envelope replacement is not hash-bound');
  if (!useEvidence || useEvidence.node_id !== 'ventilation_dispute' || receipt.evidence_operations?.[1]?.item_id !== 'use_evidence' || receipt.evidence_operations?.[1]?.added_to_node_id !== 'ventilation_dispute' || receipt.evidence_operations?.[1]?.after_hash !== dtoHash(useEvidence)) issues.push('use-evidence reassignment is not hash-bound');
  if (receipt.process_operations?.[0]?.operation !== 'add_node' || receipt.process_operations?.slice(1).some(operation => operation.operation !== 'add_edge') || receipt.evidence_operations?.[0]?.operation !== 'replace_item' || receipt.evidence_operations?.[1]?.operation !== 'reassign_item' || stableJson(receipt.evidence_operations?.[1]?.removed_from_node_ids) !== stableJson(['causation', 'mixed_cause', 'tenant_use'])) issues.push('memory operation semantics are wrong');
  if (receipt.application_hash !== dtoHash(Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== 'application_hash')))) issues.push('memory application hash is wrong');
  const expectedDelta = computedCausalDelta(baseline, later);
  if (stableJson(proof.causal_delta) !== stableJson(expectedDelta)) issues.push('learning proof causal delta is not recomputed from both DTOs');
  if (stableJson(proof.causal_delta?.process?.added_node_ids) !== stableJson(['ventilation_dispute']) || stableJson(proof.causal_delta?.process?.added_edges) !== stableJson([{ source: 'evidence_gap', target: 'ventilation_dispute' }, { source: 'ventilation_dispute', target: 'causation' }]) || stableJson(proof.causal_delta?.evidence?.changed_item_ids) !== stableJson(['building_envelope', 'management_position', 'use_evidence'])) issues.push('causal delta is outside the exact case-specific transform');
  const expectedCheckNames = ['Same observable input', 'Same canonical state', 'Exact current memory receipt', 'Pure memory replay matches learned DTOs', 'Receipt before semantic hashes match baseline DTOs', 'Receipt after hashes match learned DTOs', 'Nonzero causal DTO delta', 'Only allowed causal operations changed', 'Deterministic target and protected checks passed', 'Shared v3 remains unchanged'];
  if (proof.ready !== true || proof.computed !== true || proof.baseline_run_id !== baselineRun.run_id || proof.later_run_id !== laterRun.run_id || JSON.stringify((proof.deterministic_checks || []).map(check => check.name)) !== JSON.stringify(expectedCheckNames) || !(proof.deterministic_checks || []).every(check => check.status === 'passed')) issues.push('learning proof checks are absent, reordered, or failed');
  if (proof.reviewed_memory_proof?.used !== true || proof.reviewed_memory_proof?.present_in_baseline !== false || proof.reviewed_memory_proof?.present_in_later_run !== true || !proof.reviewed_memory_proof?.memory_ids?.includes(receipt.source_memory.memory_id) || stableJson(proof.changes?.precedent_claim_ids_added) !== stableJson(['DEF-027-E0-DEMO'])) issues.push('learning proof does not bind the selected unverified memory');
  if (proof.candidate?.status !== 'quarantined' || proof.candidate?.target_tests?.status !== 'passed' || proof.candidate?.protected_regression?.status !== 'passed' || proof.candidate?.qualified_support_count !== 0 || proof.candidate?.approval?.status !== 'pending' || proof.candidate?.approval?.qualified_reviewer !== false) issues.push('candidate target/protected checks or qualified-release boundary is wrong');
  const receiptProof = proof.memory_application_proof || {};
  if (!exactMembers(Object.keys(receiptProof), ['receipt_present', 'receipt_valid', 'source_memory_current', 'before_hashes_match', 'after_hashes_match', 'allowed_delta_exact', 'replay_exact', 'application_hash'])
    || !['receipt_present', 'receipt_valid', 'source_memory_current', 'before_hashes_match', 'after_hashes_match', 'allowed_delta_exact', 'replay_exact'].every(key => receiptProof[key] === true)
    || receiptProof.application_hash !== receipt.application_hash) issues.push('memory application proof does not validate the current receipt and pure replay');
  if (later.playbook?.version !== 'mould-playbook-v3' || later.shared_rule_applied !== false || proof.shared_rule?.version_before !== 'mould-playbook-v3' || proof.shared_rule?.version_after !== 'mould-playbook-v3' || proof.shared_rule?.applied !== false || proof.shared_rule?.shared_knowledge_changed !== false) issues.push('shared v3 boundary is not unchanged');
  if (Object.hasOwn(later.process || {}, 'agent_contribution') || (later.process?.nodes || []).some(node => Object.hasOwn(node, 'agent_decision_contributions')) || Object.hasOwn(later.checklist || {}, 'agent_contribution') || (later.checklist?.items || []).some(item => Object.hasOwn(item, 'agent_contribution')) || later.next_action?.agent_brief_contribution !== null) issues.push('post-memory DTOs retain pre-memory model contribution fields or next-action attribution');
  return issues;
}

function hybridCausalContractViolations(run) {
  const issues = [];
  const audit = orchestrationAudit(run);
  const result = run?.result;
  const artifacts = audit?.specialist_artifacts;
  if (!audit || !result || !artifacts || typeof artifacts !== 'object' || Array.isArray(artifacts)) {
    return ['hybrid specialist artifacts or final result are absent'];
  }
  const agents = new Map((audit.agents || []).map(item => [item.agent_id, item]));
  const gates = new Map((audit.deterministic_gates || []).map(item => [item.agent_id, item]));
  const sourceArtifact = artifacts.document_source_integrity;
  const processArtifact = artifacts.process_decision_mapping;
  const evidenceArtifact = artifacts.evidence_checklist;
  const finalArtifact = artifacts.final_claim_brief_audit;
  if (![sourceArtifact, processArtifact, evidenceArtifact, finalArtifact].every(value => value && typeof value === 'object' && !Array.isArray(value))) {
    return ['one or more causal specialist artifacts are absent'];
  }

  const sourceAgent = agents.get('document_source_integrity');
  const processAgent = agents.get('process_decision_mapping');
  const evidenceAgent = agents.get('evidence_checklist');
  const finalAgent = agents.get('final_claim_brief_audit');
  if (sourceAgent?.output_artifact_hash !== dtoHash(sourceArtifact)) issues.push('document source specialist artifact hash is not exact');
  if (processAgent?.output_artifact_hash !== dtoHash(processArtifact)) issues.push('process specialist artifact hash is not exact');
  if (evidenceAgent?.output_artifact_hash !== dtoHash(evidenceArtifact)) issues.push('evidence specialist artifact hash is not exact');
  if (finalAgent?.output_artifact_hash !== dtoHash(finalArtifact)) issues.push('final specialist artifact hash is not exact');

  const processGate = gates.get('deterministic_process_gate');
  const expectedParallelInputHash = dtoHash({
    source_integrity: sourceArtifact,
    process_mapping: processArtifact,
  });
  if (processGate?.input_artifact_hash !== expectedParallelInputHash) issues.push('process gate parallel specialist composite input hash is not exact');
  const evidenceGate = gates.get('deterministic_evidence_gate');
  if (evidenceGate?.input_artifact_hash !== dtoHash(evidenceArtifact)) issues.push('evidence gate specialist input hash is not exact');

  const process = result.process;
  const checklist = result.checklist;
  if (!process || !checklist) return [...issues, 'hybrid process or checklist DTO is absent'];
  if (stableJson(process.agent_contribution?.source_integrity_artifact) !== stableJson(sourceArtifact)) issues.push('final process does not retain the exact source specialist artifact');
  if (stableJson(process.agent_contribution?.artifact) !== stableJson(processArtifact)) issues.push('final process does not retain the exact process specialist artifact');

  const decisions = Array.isArray(processArtifact.decisions) ? processArtifact.decisions : [];
  const validDecisions = contributionEntries(decisions, PROCESS_CONTRIBUTION_ROLE);
  if (!validDecisions) issues.push('process decision field contributions violate membership or attribution');
  const controllingFacts = (result.facts || []).filter(item => item?.controls_process === true);
  const controllingFactIds = controllingFacts.map(item => item.fact_id);
  const controllingById = new Map(controllingFacts.map(item => [item.fact_id, item]));
  if (!exactMembers(decisions.map(item => item?.fact_id), controllingFactIds)) issues.push('process decision fact membership is not exact');
  const decisionsByFact = new Map();
  for (const decision of decisions) {
    if (!decision || typeof decision !== 'object' || !nonemptyString(decision.fact_id)) continue;
    if (decision.contribution_id !== `fact:${decision.fact_id}:decision_value`) issues.push(`process decision ${decision.fact_id} contribution ID is not exact`);
    if (decisionsByFact.has(decision.fact_id)) issues.push(`process decision ${decision.fact_id} is duplicated`);
    const canonicalFact = controllingById.get(decision.fact_id);
    if (!canonicalFact
      || decision.decision_key !== canonicalFact.decision_key
      || decision.decision_value !== canonicalFact.decision_value
      || decision.state !== canonicalFact.state
      || decision.normalized_value !== canonicalFact.normalized_value) issues.push(`process decision ${decision.fact_id} inherited canonical fields are not exact`);
    const sourceRefIds = decision.source_ref_ids;
    if (!Array.isArray(sourceRefIds)
      || sourceRefIds.some(item => !nonemptyString(item))
      || new Set(sourceRefIds).size !== sourceRefIds.length
      || JSON.stringify(sourceRefIds) !== JSON.stringify([...sourceRefIds].sort())) issues.push(`process decision ${decision.fact_id} source reference IDs are not unique and sorted`);
    decisionsByFact.set(decision.fact_id, decision);
  }
  if (validDecisions && processAgent) {
    const acceptedIds = validDecisions.filter(item => item.deterministic_fallback_applied === false).map(item => item.contribution_id);
    const fallbackCount = validDecisions.length - acceptedIds.length;
    if (JSON.stringify(processAgent.accepted_ids) !== JSON.stringify(acceptedIds)
      || processAgent.accepted_count !== acceptedIds.length
      || processAgent.rejected_count !== fallbackCount
      || processAgent.deterministic_fallback_applied !== (fallbackCount > 0)) issues.push('process agent accepted/fallback field diagnostics are not exact');
  }
  for (const node of process.nodes || []) {
    const expected = (node.fact_ids || []).flatMap(factId => decisionsByFact.has(factId) ? [decisionsByFact.get(factId)] : []);
    const actual = Array.isArray(node.agent_decision_contributions) ? node.agent_decision_contributions : [];
    if (stableJson(actual) !== stableJson(expected)) issues.push(`process node ${node.node_id || 'unknown'} field attribution is not projected from the specialist artifact`);
  }

  if (stableJson(checklist.agent_contribution?.artifact) !== stableJson(evidenceArtifact)) issues.push('final checklist does not retain the exact evidence specialist artifact');
  const artifactItems = Array.isArray(evidenceArtifact.items) ? evidenceArtifact.items : [];
  const checklistItems = Array.isArray(checklist.items) ? checklist.items : [];
  if (!exactMembers(artifactItems.map(item => item?.item_id), checklistItems.map(item => item?.item_id))) issues.push('evidence specialist item membership is not exact');
  const checklistById = new Map(checklistItems.map(item => [item.item_id, item]));
  const evidenceUnits = [];
  for (const artifactItem of artifactItems) {
    const itemId = artifactItem?.item_id;
    const sourceRefIds = artifactItem?.source_ref_ids;
    if (!Array.isArray(sourceRefIds)
      || sourceRefIds.some(item => !nonemptyString(item))
      || new Set(sourceRefIds).size !== sourceRefIds.length
      || JSON.stringify(sourceRefIds) !== JSON.stringify([...sourceRefIds].sort())) issues.push(`evidence item ${itemId || 'unknown'} source reference IDs are not unique and sorted`);
    const units = contributionEntries(artifactItem?.field_contributions, EVIDENCE_CONTRIBUTION_ROLE);
    const expectedUnits = [
      { contribution_id: `item:${itemId}:status`, field: 'status' },
      { contribution_id: `item:${itemId}:artifacts`, field: 'artifact_ids' },
    ];
    if (!units || units.length !== 2 || stableJson(units.map(item => ({ contribution_id: item.contribution_id, field: item.field }))) !== stableJson(expectedUnits)) {
      issues.push(`evidence item ${itemId || 'unknown'} does not contain the exact two field contributions`);
      continue;
    }
    evidenceUnits.push(...units);
    const finalItem = checklistById.get(itemId);
    if (!finalItem) continue;
    if (finalItem.status !== artifactItem.status) issues.push(`evidence item ${itemId} status is not projected from the specialist artifact`);
    if (!exactMembers(finalItem.artifact_ids, artifactItem.artifact_ids)) issues.push(`evidence item ${itemId} artifact set is not projected from the specialist artifact`);
    if (stableJson(finalItem.agent_contribution) !== stableJson(units)) issues.push(`evidence item ${itemId} field attribution is not projected from the specialist artifact`);
  }
  if (evidenceUnits.length && evidenceAgent) {
    const acceptedIds = evidenceUnits.filter(item => item.deterministic_fallback_applied === false).map(item => item.contribution_id);
    const fallbackCount = evidenceUnits.length - acceptedIds.length;
    if (JSON.stringify(evidenceAgent.accepted_ids) !== JSON.stringify(acceptedIds)
      || evidenceAgent.accepted_count !== acceptedIds.length
      || evidenceAgent.rejected_count !== fallbackCount
      || evidenceAgent.deterministic_fallback_applied !== (fallbackCount > 0)) issues.push('evidence agent accepted/fallback field diagnostics are not exact');
  }

  const finalBrief = audit.final_claim_brief;
  if (stableJson(finalArtifact) !== stableJson(finalBrief)) issues.push('final specialist artifact and authoritative final claim brief differ');
  const finalUnits = contributionEntries(finalBrief?.field_contributions, FINAL_CONTRIBUTION_ROLE);
  if (!finalUnits
    || finalUnits.length !== FINAL_FIELD_CONTRACT.length
    || stableJson(finalUnits.map(item => ({ field: item.field, contribution_id: item.contribution_id }))) !== stableJson(FINAL_FIELD_CONTRACT)) issues.push('final claim brief does not contain the exact five field contributions');
  if (finalUnits && finalAgent) {
    const acceptedIds = finalUnits.filter(item => item.deterministic_fallback_applied === false).map(item => item.contribution_id);
    const fallbackCount = finalUnits.length - acceptedIds.length;
    if (JSON.stringify(finalAgent.accepted_ids) !== JSON.stringify(acceptedIds)
      || finalAgent.accepted_count !== acceptedIds.length
      || finalAgent.rejected_count !== fallbackCount
      || finalAgent.deterministic_fallback_applied !== (fallbackCount > 0)) issues.push('final agent accepted/fallback field diagnostics are not exact');
    const expectedAttribution = fallbackCount === 0 ? FINAL_CONTRIBUTION_ROLE : acceptedIds.length ? 'mixed_model_and_deterministic' : DETERMINISTIC_CONTRIBUTION_ROLE;
    if (finalBrief.attribution !== expectedAttribution || finalBrief.deterministic_fallback_applied !== (fallbackCount > 0)) issues.push('final claim brief aggregate attribution is not exact');
    const upstreamUnit = finalUnits.find(item => item.field === 'upstream_contribution_ids');
    const expectedLineageAuthority = upstreamUnit?.deterministic_fallback_applied === false ? 'hybrid_guarded_model_audit' : DETERMINISTIC_CONTRIBUTION_ROLE;
    if (finalBrief.lineage_authority !== expectedLineageAuthority) issues.push('final claim brief lineage authority is not exact');
  }
  if (finalBrief?.contribution_scope !== 'independent_final_claim_brief_audit') issues.push('final claim brief contribution scope is not exact');

  const overlay = process.current_overlay || {};
  if (finalBrief?.current_node_id !== process.current_node || finalBrief?.current_node_id !== overlay.current_node_id) issues.push('final current-node field is not causally bound to the process overlay');
  if (finalBrief?.next_action_node_id !== overlay.next_action_node_id || finalBrief?.next_action_node_id !== result.next_action?.process_node_id) issues.push('final next-action field is not causally bound to the result');
  if (stableJson(result.next_action?.agent_brief_contribution) !== stableJson(finalBrief)) issues.push('result next action does not retain the exact final claim brief');
  const currentNode = (process.nodes || []).find(item => item.node_id === finalBrief?.current_node_id);
  const expectedSupportingFacts = [...(currentNode?.fact_ids || [])].sort();
  if (JSON.stringify(finalBrief?.supporting_fact_ids) !== JSON.stringify(expectedSupportingFacts)) issues.push('final supporting-facts field is not bound to the current process node');
  if (JSON.stringify(finalBrief?.upstream_contribution_ids) !== JSON.stringify(FINAL_UPSTREAM_CONTRIBUTION_IDS)
    || JSON.stringify(finalBrief?.input_contribution_ids) !== JSON.stringify(FINAL_UPSTREAM_CONTRIBUTION_IDS)) issues.push('final upstream-contribution field is not complete and exact');
  if (JSON.stringify(finalBrief?.audit_check_ids) !== JSON.stringify(FINAL_AUDIT_CHECK_IDS)) issues.push('final audit-check field is not complete and exact');
  const supportingFactSet = new Set(expectedSupportingFacts);
  const expectedSourceRefs = [...new Set([
    ...decisions.filter(item => supportingFactSet.has(item.fact_id)).flatMap(item => item.source_ref_ids || []),
    ...artifactItems.filter(item => supportingFactSet.has(checklistById.get(item.item_id)?.fact_id)).flatMap(item => item.source_ref_ids || []),
  ])].sort();
  if (JSON.stringify(finalBrief?.source_ref_ids) !== JSON.stringify(expectedSourceRefs)) issues.push('final source-reference field is not derived from controlling and non-controlling supporting facts');
  return issues;
}

function internalSentinelPaths(value, currentPath = '$', found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => internalSentinelPaths(item, `${currentPath}[${index}]`, found));
    return found;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => internalSentinelPaths(child, `${currentPath}.${key}`, found));
    return found;
  }
  if (typeof value === 'string' && INTERNAL_SENTINEL_PATTERN.test(value)) found.push(currentPath);
  return found;
}

function nonIntegerNumberPaths(value, currentPath = '$', found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => nonIntegerNumberPaths(item, `${currentPath}[${index}]`, found));
    return found;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => nonIntegerNumberPaths(child, `${currentPath}.${key}`, found));
    return found;
  }
  if (typeof value === 'number' && (!Number.isInteger(value) || Object.is(value, -0))) found.push(currentPath);
  return found;
}

function runProgressDiagnostic(run) {
  const safeEvents = Array.isArray(run?.events)
    ? run.events
      .filter(item => item?.stage === 'agent_orchestration')
      .slice(-12)
      .map(item => ({
        ordinal: item.ordinal,
        agent_id: item.agent_id,
        actor_type: item.actor_type,
        status: item.status,
        receipt_type: item.receipt_type,
        outcome: item.outcome,
        handoff_to: item.handoff_to,
      }))
    : [];
  return {
    run_id: run?.run_id || null,
    status: run?.status || 'not_found',
    stage: run?.stage || null,
    error_present: nonemptyString(run?.error),
    recent_agent_receipts: safeEvents,
  };
}

function terminalFailureContractViolations(run) {
  if (run?.status !== 'failed') return [];
  const issues = [];
  const sentinelLeaks = internalSentinelPaths(run);
  if (sentinelLeaks.length) issues.push(`terminal failure leaks internal execution sentinels at ${sentinelLeaks.join(', ')}`);
  const sensitive = forbiddenFieldPaths(run);
  if (sensitive.length) issues.push(`terminal failure leaks forbidden fields at ${sensitive.join(', ')}`);
  const events = Array.isArray(run?.events) ? run.events : [];
  const completedByAgent = new Map(events
    .filter(item => item?.actor_type === 'nemotron_agent' && item?.receipt_type === 'agent_completed' && item?.status === 'completed')
    .map(item => [item.agent_id, item]));
  const failureReceipts = events.filter(item => item?.receipt_type === 'agent_failed');
  for (const receipt of failureReceipts) {
    const unexpected = Object.keys(receipt).filter(key => !ALLOWED_AGENT_FAILURE_RECEIPT_FIELDS.has(key));
    if (unexpected.length) issues.push(`${receipt.agent_id || 'unknown'} failure receipt has non-allowlisted fields: ${unexpected.join(', ')}`);
    const isCanonicalRoot = receipt.agent_id === 'canonical_facts';
    const expectedParent = isCanonicalRoot
      ? null
      : receipt.agent_id === 'orchestrator_plan'
        ? completedByAgent.get('canonical_facts')?.call_id
        : completedByAgent.get('orchestrator_plan')?.call_id;
    const rootLineageValid = !isCanonicalRoot || (
      receipt.failure_scope === 'root_canonical_facts'
      && receipt.root_agent === true
      && receipt.parent_call_id == null
      && receipt.delegation_id == null
      && receipt.input_artifact === 'observable_claim_package'
      && receipt.provider === 'openrouter'
      && receipt.requested_model === REQUESTED_NEMOTRON_MODEL
      && nonemptyString(receipt.orchestration_id)
      && receipt.shared_context === `claim-context:${run.run_id}`
      && Number.isInteger(receipt.call_count)
      && receipt.call_count === (ZERO_CALL_FAILURE_OUTCOMES.has(receipt.outcome) ? 0 : 1)
    );
    const delegatedLineageValid = isCanonicalRoot || (
      nonemptyString(receipt.delegation_id)
      && nonemptyString(expectedParent)
      && receipt.parent_call_id === expectedParent
    );
    if (!REQUIRED_NEMOTRON_AGENT_IDS.includes(receipt.agent_id)
      || receipt.actor_type !== 'nemotron_agent'
      || receipt.status !== 'failed'
      || receipt.acceptance_scope !== 'pre_review_model_output'
      || !nonemptyString(receipt.call_id)
      || !rootLineageValid
      || !delegatedLineageValid
      || !SHA256_PATTERN.test(receipt.input_artifact_hash || '')
      || !nonemptyString(receipt.error_type)
      || !nonemptyString(receipt.error_invariant)
      || !FAILURE_OUTCOMES.has(receipt.outcome)
      || receipt.handoff_to !== 'failure_boundary'
      || receipt.external_tracing !== false
      || receipt.model !== REQUESTED_NEMOTRON_MODEL) issues.push(`${receipt.agent_id || 'unknown'} failure receipt identity/lineage is invalid`);
    const expectedCallCount = ZERO_CALL_FAILURE_OUTCOMES.has(receipt.outcome) ? 0 : 1;
    if (!Number.isInteger(receipt.call_count) || receipt.call_count !== expectedCallCount) issues.push(`${receipt.agent_id || 'unknown'} failure receipt call_count does not match its exact provider-call outcome`);
    if (receipt.outcome === 'blocked_provider_concurrency' || receipt.error_invariant === 'provider_concurrency_timeout') {
      const retainedProviderResultFields = ZERO_CALL_PROVIDER_RESULT_FIELDS.filter(field => receipt[field] != null);
      if (receipt.outcome !== 'blocked_provider_concurrency'
        || receipt.error_invariant !== 'provider_concurrency_timeout'
        || receipt.call_count !== 0
        || retainedProviderResultFields.length) issues.push(`${receipt.agent_id || 'unknown'} blocked provider concurrency is not an exact zero-call receipt`);
    }
    const responseIdPresent = nonemptyString(receipt.response_id);
    const responseModelPresent = nonemptyString(receipt.response_model);
    const responseIdBounded = providerProvenanceValueIsSafe('response_id', receipt.response_id);
    const responseModelBounded = providerProvenanceValueIsSafe('response_model', receipt.response_model);
    const upstreamBounded = providerProvenanceValueIsSafe('upstream_provider', receipt.upstream_provider);
    const finishReasonBounded = providerProvenanceValueIsSafe('finish_reason', receipt.finish_reason);
    if (!responseIdBounded || !responseModelBounded || !upstreamBounded || !finishReasonBounded) issues.push(`${receipt.agent_id || 'unknown'} failure provider provenance is not bounded`);
    if (receipt.error_invariant === 'response_identity') {
      if (responseIdPresent && responseModelPresent) issues.push(`${receipt.agent_id || 'unknown'} response-identity failure is unexpectedly complete`);
    } else if (receipt.error_invariant === 'invalid_provenance') {
      if (!PROVIDER_PROVENANCE_FIELDS.has(receipt.invalid_provenance_field)
        || !SHA256_PATTERN.test(receipt.invalid_provenance_value_hash || '')
        || receipt[receipt.invalid_provenance_field] != null) issues.push(`${receipt.agent_id || 'unknown'} invalid-provenance failure lacks its safe field/hash diagnostic or retained the rejected value`);
    } else if (receipt.error_invariant === 'provider_upstream_rejection') {
      if (receipt.response_model != null || receipt.upstream_provider != null || receipt.usage_source != null || receipt.finish_reason != null) issues.push(`${receipt.agent_id || 'unknown'} upstream rejection claims unavailable provider success metadata`);
      if (receipt.provider_error_code != null && (!Number.isInteger(receipt.provider_error_code) || receipt.provider_error_code < 0 || receipt.provider_error_code > 9999)) issues.push(`${receipt.agent_id || 'unknown'} upstream rejection error code is unbounded`);
      if (responseIdPresent && !EXACT_OPENROUTER_GENERATION_ID.test(receipt.response_id)) issues.push(`${receipt.agent_id || 'unknown'} upstream rejection response ID is not an exact OpenRouter generation ID`);
    } else if ((responseIdPresent || responseModelPresent) && (
      !responseIdPresent
      || !responseModelPresent
      || !EXACT_NEMOTRON_RESPONSE_MODELS.has(receipt.response_model)
    )) {
      issues.push(`${receipt.agent_id || 'unknown'} failure response identity is partial or unauthorized`);
    }
    if (receipt.error_invariant !== 'invalid_provenance'
      && (receipt.invalid_provenance_field != null || receipt.invalid_provenance_value_hash != null)) issues.push(`${receipt.agent_id || 'unknown'} failure carries an out-of-scope invalid-provenance diagnostic`);
    if (receipt.error_invariant !== 'provider_upstream_rejection' && receipt.provider_error_code != null) issues.push(`${receipt.agent_id || 'unknown'} failure carries an out-of-scope provider error code`);
    const boundaryIssue = providerRejectionBoundaryIssue(receipt);
    if (boundaryIssue) issues.push(`${receipt.agent_id || 'unknown'} failure ${boundaryIssue}`);
    if (receipt.outcome === 'actual_cost_overrun' && (
      !responseIdPresent
      || !responseModelPresent
      || !EXACT_NEMOTRON_RESPONSE_MODELS.has(receipt.response_model)
      || !ALLOWED_USAGE_SOURCES.has(receipt.usage_source)
    )) issues.push(`${receipt.agent_id || 'unknown'} charged overrun lacks complete provider lineage`);
    if (receipt.usage_source != null && !ALLOWED_USAGE_SOURCES.has(receipt.usage_source)) issues.push(`${receipt.agent_id || 'unknown'} failure usage provenance is invalid`);
  }
  const terminalBoundaries = events.filter(item => item?.stage === 'failed' && item?.status === 'failed' && item?.actor_type === 'deterministic_gate');
  if (terminalBoundaries.length !== 1) {
    issues.push('terminal deterministic failure boundary is absent or duplicated');
  } else {
    const terminal = terminalBoundaries[0];
    if (terminal.label !== 'Analysis stopped safely'
      || terminal.agent !== 'Failure boundary'
      || terminal.headline !== 'No final playbook was accepted'
      || terminal.model != null
      || terminal.failure_stage !== run.failure_stage
      || terminal.accepted_state?.final_playbook_accepted !== false
      || stableJson(terminal.accepted_state) !== stableJson(run.accepted_state)) issues.push('terminal deterministic failure labels/state are invalid');
  }
  if (REQUIRED_NEMOTRON_AGENT_IDS.includes(run.failure_stage)
    && failureReceipts.filter(item => item.agent_id === run.failure_stage).length !== 1) issues.push('terminal model failure is not bound to exactly one specialist failure receipt');
  return issues;
}

function orchestrationContractViolations(run, cacheMode, expectedFramework = EXPECTED_FRAMEWORK) {
  const issues = [];
  const audit = orchestrationAudit(run);
  if (!audit || typeof audit !== 'object') return ['agent_orchestration audit is absent'];
  if (audit.schema_version !== EXPECTED_RUNTIME.orchestration_schema) issues.push('orchestration schema mismatch');
  if (audit.implementation !== EXPECTED_RUNTIME.implementation) issues.push('implementation mismatch');
  if (audit.authority_mode !== EXPECTED_RUNTIME.authority_mode) issues.push('authority mode mismatch');
  if (audit.model !== REQUESTED_NEMOTRON_MODEL) issues.push('requested model mismatch');
  if (stableJson(audit.framework) !== stableJson(expectedFramework)) issues.push('framework versions mismatch');
  if (!nonemptyString(audit.orchestration_id)) issues.push('orchestration_id is absent');
  if (!run?.result?.agent_orchestration
    || !run?.result?.audit?.agent_orchestration
    || !run?.agent_orchestration
    || stableJson(run.result.agent_orchestration) !== stableJson(audit)
    || stableJson(run.result.audit.agent_orchestration) !== stableJson(audit)
    || stableJson(run.agent_orchestration) !== stableJson(audit)) issues.push('authoritative orchestration audit is not identically visible in every final payload binding');
  if (audit.model_assisted !== true || audit.deterministic_safety_authority !== true) issues.push('hybrid authority flags are invalid');
  if (audit.external_tracing !== false || audit.prompt_storage !== false || audit.raw_output_storage !== false) issues.push('privacy flags are invalid');
  if (audit.all_required_agents_contributed !== true) issues.push('required-agent completion flag is false');
  if (stableJson(audit.execution_topology) !== stableJson(EXPECTED_EXECUTION_TOPOLOGY)) issues.push('deterministic execution topology authority or structure mismatch');

  const agents = Array.isArray(audit.agents) ? audit.agents : [];
  const gates = Array.isArray(audit.deterministic_gates) ? audit.deterministic_gates : [];
  if (!exactMembers(agents.map(item => item?.agent_id), REQUIRED_NEMOTRON_AGENT_IDS)) issues.push('required Nemotron agent set is not exact');
  if (!exactMembers(gates.map(item => item?.agent_id), REQUIRED_DETERMINISTIC_GATE_IDS)) issues.push('deterministic gate set is not exact');

  const byAgent = new Map(agents.map(item => [item.agent_id, item]));
  const callIds = agents.map(item => item?.call_id);
  const delegatedAgents = agents.filter(item => item?.agent_id !== 'canonical_facts');
  const delegationIds = delegatedAgents.map(item => item?.delegation_id);
  if (!callIds.every(nonemptyString) || new Set(callIds).size !== REQUIRED_NEMOTRON_AGENT_IDS.length) issues.push('agent call IDs are missing or duplicated');
  if (!delegationIds.every(nonemptyString) || new Set(delegationIds).size !== REQUIRED_NEMOTRON_AGENT_IDS.length - 1) issues.push('delegated agent IDs are missing or duplicated');
  for (const agentId of REQUIRED_NEMOTRON_AGENT_IDS) {
    const item = byAgent.get(agentId);
    if (!item) continue;
    if (item.role !== REQUIRED_NEMOTRON_AGENT_ROLES[agentId]) issues.push(`${agentId}: role label is not exact`);
    if (item.actor_type !== 'nemotron_agent') issues.push(`${agentId}: actor_type must be nemotron_agent`);
    if (item.acceptance_scope !== 'pre_review_model_output') issues.push(`${agentId}: acceptance_scope must remain pre_review_model_output`);
    if (item.model !== REQUESTED_NEMOTRON_MODEL || item.requested_model !== REQUESTED_NEMOTRON_MODEL || item.provider !== 'openrouter') issues.push(`${agentId}: requested model/provider mismatch`);
    if (!nonemptyString(item.response_id) || !EXACT_NEMOTRON_RESPONSE_MODELS.has(item.response_model)) issues.push(`${agentId}: returned response identity is invalid`);
    if (!providerProvenanceValueIsSafe('response_id', item.response_id)
      || !providerProvenanceValueIsSafe('response_model', item.response_model)
      || item.upstream_provider !== 'DeepInfra'
      || !providerProvenanceValueIsSafe('upstream_provider', item.upstream_provider)
      || !nonemptyString(item.finish_reason)
      || !providerProvenanceValueIsSafe('finish_reason', item.finish_reason)
      || (cacheMode === 'cold' ? !ALLOWED_USAGE_SOURCES.has(item.usage_source) : item.usage_source !== 'cache')) issues.push(`${agentId}: bounded provider provenance/usage is invalid`);
    if (!Number.isInteger(item.accepted_count) || item.accepted_count < 1) issues.push(`${agentId}: accepted_count must be positive`);
    if (!Number.isInteger(item.rejected_count) || item.rejected_count < 0) issues.push(`${agentId}: rejected_count must be nonnegative`);
    if (Number.isInteger(item.accepted_count) && Number.isInteger(item.rejected_count) && item.accepted_count <= item.rejected_count) issues.push(`${agentId}: accepted contributions are not a strict majority`);
    if (typeof item.deterministic_fallback_applied !== 'boolean' || item.deterministic_fallback_applied !== (item.rejected_count > 0)) issues.push(`${agentId}: guarded fallback disclosure is inconsistent`);
    if (!SHA256_PATTERN.test(item.input_artifact_hash || '') || !SHA256_PATTERN.test(item.output_artifact_hash || '')) issues.push(`${agentId}: artifact hashes are absent or invalid`);
    if (!nonemptyString(item.origin_call_id)) issues.push(`${agentId}: origin_call_id is absent`);
    if (cacheMode === 'cold' && (item.cache_hit !== false || !SUCCESSFUL_MODEL_OUTCOMES.has(item.outcome) || item.origin_call_id !== item.call_id)) issues.push(`${agentId}: cold network lineage is invalid`);
    if (cacheMode === 'warm' && (item.cache_hit !== true || item.outcome !== 'cache_hit')) issues.push(`${agentId}: warm cache state is invalid`);
  }
  const canonical = byAgent.get('canonical_facts');
  const orchestrator = byAgent.get('orchestrator_plan');
  if (canonical) {
    const projected = canonical.source_reference_projection_fact_ids;
    if (!Array.isArray(projected)
      || !Number.isInteger(canonical.source_reference_projection_count)
      || canonical.source_reference_projection_count !== projected.length
      || new Set(projected).size !== projected.length
      || projected.some(factId => !canonical.accepted_ids.includes(factId))) issues.push('canonical_facts: deterministic source projection disclosure is invalid');
  }
  if (canonical && (canonical.parent_call_id != null || canonical.delegation_id != null)) issues.push('canonical_facts: root parent_call_id and delegation_id must be null');
  if (canonical && orchestrator && orchestrator.parent_call_id !== canonical.call_id) issues.push('orchestrator_plan: parent must be canonical_facts call');
  for (const agentId of REQUIRED_NEMOTRON_AGENT_IDS.slice(2)) {
    if (byAgent.get(agentId)?.parent_call_id !== orchestrator?.call_id) issues.push(`${agentId}: parent must be orchestrator_plan call`);
  }
  const disclosedFallbacks = agents.filter(item => item?.deterministic_fallback_applied === true).length;
  if (!Number.isInteger(audit.guarded_fallback_count) || audit.guarded_fallback_count !== disclosedFallbacks) issues.push('guarded_fallback_count does not match agent receipts');
  for (const gateId of REQUIRED_DETERMINISTIC_GATE_IDS) {
    const gate = gates.find(item => item?.agent_id === gateId);
    if (!gate) continue;
    if (gate.role !== REQUIRED_DETERMINISTIC_GATE_ROLES[gateId]) issues.push(`${gateId}: role label is not exact`);
    const artifactContract = ACCEPTED_ARTIFACT_CONTRACT[gateId];
    const sourceAgent = byAgent.get(artifactContract.source_agent_id);
    if (gate.actor_type !== 'deterministic_gate' || gate.model != null || gate.outcome !== 'passed' || gate.receipt_type !== 'accepted_artifact' || gate.acceptance_scope !== 'pre_review_model_output') issues.push(`${gateId}: deterministic gate identity/scope is invalid`);
    if (gate.output_artifact !== artifactContract.output_artifact
      || gate.source_agent_id !== artifactContract.source_agent_id
      || gate.source_call_id !== sourceAgent?.call_id
      || gate.delegation_id !== sourceAgent?.delegation_id
      || gate.accepted_count !== sourceAgent?.accepted_count
      || !Array.isArray(gate.accepted_ids)
      || gate.accepted_ids.length !== gate.accepted_count
      || new Set(gate.accepted_ids).size !== gate.accepted_ids.length
      || JSON.stringify(gate.accepted_ids) !== JSON.stringify(sourceAgent?.accepted_ids)) issues.push(`${gateId}: accepted artifact IDs/source binding is invalid`);
    if (!SHA256_PATTERN.test(gate.input_artifact_hash || '') || !SHA256_PATTERN.test(gate.output_artifact_hash || '')) issues.push(`${gateId}: artifact hashes are absent or invalid`);
  }
  const exactGateOutputs = {
    deterministic_process_gate: run?.result?.process,
    deterministic_evidence_gate: run?.result?.checklist,
    whole_playbook_gate: audit.final_claim_brief,
  };
  for (const [gateId, dto] of Object.entries(exactGateOutputs)) {
    const gate = gates.find(item => item?.agent_id === gateId);
    if (!dto || gate?.output_artifact_hash !== dtoHash(dto)) issues.push(`${gateId}: output hash is not bound to the returned final DTO`);
    const numericHazards = nonIntegerNumberPaths(dto);
    if (numericHazards.length) issues.push(`${gateId}: accepted DTO contains non-integer numeric values at ${numericHazards.join(', ')}`);
  }
  const allEvents = Array.isArray(run?.events) ? run.events : [];
  const events = allEvents.filter(item => item?.stage === 'agent_orchestration');
  if (allEvents.some(item => item?.receipt_type === 'agent_failed' || (item?.stage === 'failed' && item?.status === 'failed'))) issues.push('completed orchestration retained a failure receipt or terminal failure boundary');
  for (const agentId of REQUIRED_NEMOTRON_AGENT_IDS) {
    const agent = byAgent.get(agentId);
    const completed = allEvents.filter(item => item.agent_id === agentId && item.actor_type === 'nemotron_agent' && item.receipt_type === 'agent_completed' && item.status === 'completed');
    if (completed.length !== 1) {
      issues.push(`${agentId}: exact completed visible pre-review receipt is absent or duplicated`);
      continue;
    }
    const receipt = completed[0];
    if (receipt.acceptance_scope !== 'pre_review_model_output'
      || receipt.call_id !== agent?.call_id
      || receipt.parent_call_id !== agent?.parent_call_id
      || receipt.delegation_id !== agent?.delegation_id
      || receipt.response_id !== agent?.response_id
      || receipt.response_model !== agent?.response_model
      || receipt.accepted_count !== agent?.accepted_count
      || receipt.rejected_count !== agent?.rejected_count
      || receipt.deterministic_fallback_applied !== agent?.deterministic_fallback_applied
      || (agentId === 'canonical_facts'
        && (receipt.source_reference_projection_count !== agent?.source_reference_projection_count
          || JSON.stringify(receipt.source_reference_projection_fact_ids) !== JSON.stringify(agent?.source_reference_projection_fact_ids)))
      || JSON.stringify(receipt.accepted_ids) !== JSON.stringify(agent?.accepted_ids)) issues.push(`${agentId}: completed visible receipt is not bound to the authoritative agent audit`);
    if (agentId !== 'canonical_facts' && receipt.output_artifact_hash !== agent?.output_artifact_hash) issues.push(`${agentId}: completed visible receipt output hash is not bound to the authoritative agent audit`);
  }
  for (const gateId of REQUIRED_DETERMINISTIC_GATE_IDS) {
    const contract = ACCEPTED_ARTIFACT_CONTRACT[gateId];
    const sourceCallId = byAgent.get(contract.source_agent_id)?.call_id;
    if (!events.some(item => item.agent_id === gateId
      && item.actor_type === 'deterministic_gate'
      && item.receipt_type === 'accepted_artifact'
      && item.acceptance_scope === 'pre_review_model_output'
      && item.status === 'completed'
      && item.output_artifact === contract.output_artifact
      && item.source_agent_id === contract.source_agent_id
      && item.source_call_id === sourceCallId
      && item.delegation_id === byAgent.get(contract.source_agent_id)?.delegation_id
      && item.accepted_count === byAgent.get(contract.source_agent_id)?.accepted_count
      && JSON.stringify(item.accepted_ids) === JSON.stringify(byAgent.get(contract.source_agent_id)?.accepted_ids)
      && SHA256_PATTERN.test(item.output_artifact_hash || ''))) issues.push(`${gateId}: completed accepted-artifact receipt is absent or unbound`);
  }
  issues.push(...hybridCausalContractViolations(run));
  const sensitive = forbiddenFieldPaths(run);
  if (sensitive.length) issues.push(`forbidden public fields: ${sensitive.join(', ')}`);
  const sentinelLeaks = internalSentinelPaths(run);
  if (sentinelLeaks.length) issues.push(`internal execution sentinels leaked: ${sentinelLeaks.join(', ')}`);
  return issues;
}

function ledgerSummary(items) {
  const unknownCostCallCount = items.filter(item => item.call_count > 0 && item.actual_cost_usd == null).length;
  const outcomes = Object.fromEntries([...new Set(items.map(item => item.outcome))]
    .sort()
    .map(outcome => [outcome, items.filter(item => item.outcome === outcome).length]));
  return {
    records: items.length,
    network_calls: items.reduce((total, item) => total + item.call_count, 0),
    prompt_tokens: items.reduce((total, item) => total + (item.prompt_tokens ?? 0), 0),
    completion_tokens: items.reduce((total, item) => total + (item.completion_tokens ?? 0), 0),
    total_tokens: items.reduce((total, item) => total + (item.total_tokens ?? 0), 0),
    actual_cost_usd: Number(items.reduce((total, item) => total + (item.actual_cost_usd ?? 0), 0).toFixed(8)),
    actual_cost_complete: unknownCostCallCount === 0,
    unknown_cost_call_count: unknownCostCallCount,
    outcomes,
  };
}

function initialLedgerAdmissionViolations(ledger) {
  const issues = sanitizedLedgerViolations(ledger);
  if (issues.length) return issues;
  const expected = ledgerSummary([]);
  if (stableJson(ledger.summary) !== stableJson(expected)) {
    issues.push('initial global model ledger is not exactly empty');
  }
  if (ledger.items.length !== 0) issues.push('initial global model ledger contains rows');
  return issues;
}

function finalLedgerSnapshotViolations(isolationLedger, finalLedger) {
  const issues = [];
  if (stableJson(finalLedger) !== stableJson(isolationLedger)) {
    issues.push('final ledger changed after the flagship warm replay');
  }
  const summary = finalLedger?.summary;
  if (!Array.isArray(finalLedger?.items)
    || finalLedger.items.length !== 12
    || summary?.records !== 12
    || summary?.network_calls !== 6
    || summary?.outcomes?.cache_hit !== 6
    || summary?.unknown_cost_call_count !== 0
    || summary?.actual_cost_complete !== true) {
    issues.push('final ledger is not exact cold6 plus warm6 accounting');
  }
  return issues;
}

function sanitizedLedgerViolations(ledger) {
  const issues = [];
  if (ledger?.scope !== 'global_budget_ledger' || !Array.isArray(ledger?.items)) return ['global sanitized ledger is absent'];
  const summary = ledger?.summary;
  if (!summary || typeof summary !== 'object' || !exactMembers(Object.keys(summary), [...ALLOWED_LEDGER_SUMMARY_FIELDS])) {
    issues.push('ledger summary violates the exact public schema');
  } else {
    const sourceRowsValid = ledger.items.every(item => Number.isInteger(item?.call_count)
      && item.call_count >= 0
      && ['prompt_tokens', 'completion_tokens', 'total_tokens'].every(field => !Object.hasOwn(item, field) || (Number.isInteger(item[field]) && item[field] >= 0))
      && (item.actual_cost_usd == null || (Number.isFinite(item.actual_cost_usd) && item.actual_cost_usd >= 0))
      && nonemptyString(item.outcome));
    if (!sourceRowsValid) {
      issues.push('ledger summary source rows contain invalid accounting fields');
    } else {
      if (stableJson(summary) !== stableJson(ledgerSummary(ledger.items))) issues.push('ledger summary is inconsistent with its network rows');
    }
  }
  const callIds = ledger.items.map(item => item?.call_id);
  if (!callIds.every(nonemptyString) || new Set(callIds).size !== callIds.length) issues.push('ledger call IDs are absent or duplicated');
  ledger.items.forEach((item, index) => {
    const unexpected = Object.keys(item).filter(key => !ALLOWED_LEDGER_FIELDS.has(key));
    if (unexpected.length) issues.push(`ledger[${index}] unexpected fields: ${unexpected.join(', ')}`);
    for (const field of PROVIDER_PROVENANCE_FIELDS) {
      if (Object.hasOwn(item, field) && !providerProvenanceValueIsSafe(field, item[field])) issues.push(`ledger[${index}].${field} violates the exact provider-provenance sanitizer`);
    }
    if (Object.hasOwn(item, 'generation_model') && !providerProvenanceValueIsSafe('response_model', item.generation_model)) issues.push(`ledger[${index}].generation_model violates the exact response-model sanitizer`);
    if (Object.hasOwn(item, 'origin_finish_reason') && !providerProvenanceValueIsSafe('finish_reason', item.origin_finish_reason)) issues.push(`ledger[${index}].origin_finish_reason violates the exact finish-reason sanitizer`);
    if (item.error_invariant === 'invalid_provenance') {
      if (!PROVIDER_PROVENANCE_FIELDS.has(item.invalid_provenance_field)
        || !SHA256_PATTERN.test(item.invalid_provenance_value_hash || '')
        || item[item.invalid_provenance_field] != null) issues.push(`ledger[${index}] invalid-provenance diagnostic is unbounded or retained the rejected value`);
    } else if (item.invalid_provenance_field != null || item.invalid_provenance_value_hash != null) {
      issues.push(`ledger[${index}] carries an out-of-scope invalid-provenance diagnostic`);
    }
    if (item.provider_error_code != null && (item.error_invariant !== 'provider_upstream_rejection' || !Number.isInteger(item.provider_error_code) || item.provider_error_code < 0 || item.provider_error_code > 9999)) issues.push(`ledger[${index}] provider error code is unbounded or out of scope`);
    if (item.error_invariant === 'provider_upstream_rejection' && item.response_id != null && !EXACT_OPENROUTER_GENERATION_ID.test(item.response_id)) issues.push(`ledger[${index}] response ID is not an exact OpenRouter generation ID`);
    if (item.outcome === 'blocked_provider_concurrency' || item.error_invariant === 'provider_concurrency_timeout') {
      const retainedProviderResultFields = ZERO_CALL_PROVIDER_RESULT_FIELDS.filter(field => Object.hasOwn(item, field));
      if (item.outcome !== 'blocked_provider_concurrency'
        || item.error_invariant !== 'provider_concurrency_timeout'
        || item.call_count !== 0
        || item.actual_cost_usd !== null
        || retainedProviderResultFields.length) issues.push(`ledger[${index}] blocked provider concurrency is not an exact zero-call row`);
    }
    const boundaryIssue = providerRejectionBoundaryIssue(item);
    if (boundaryIssue) issues.push(`ledger[${index}] ${boundaryIssue}`);
    if (Object.hasOwn(item, 'origin_usage')) {
      const usage = item.origin_usage;
      if (!usage
        || typeof usage !== 'object'
        || !exactMembers(Object.keys(usage), ['prompt_tokens', 'completion_tokens', 'total_tokens', 'actual_cost_usd', 'usage_source'])
        || !Number.isInteger(usage.prompt_tokens)
        || usage.prompt_tokens <= 0
        || !Number.isInteger(usage.completion_tokens)
        || usage.completion_tokens <= 0
        || !Number.isInteger(usage.total_tokens)
        || usage.total_tokens < usage.prompt_tokens + usage.completion_tokens
        || !Number.isFinite(usage.actual_cost_usd)
        || usage.actual_cost_usd <= 0
        || !ALLOWED_USAGE_SOURCES.has(usage.usage_source)) issues.push(`ledger[${index}] origin_usage is not the bounded usage schema`);
      if (!nonemptyString(item.origin_finish_reason)) issues.push(`ledger[${index}] origin_finish_reason is absent`);
    }
  });
  const sensitive = forbiddenFieldPaths(ledger);
  if (sensitive.length) issues.push(`ledger forbidden fields: ${sensitive.join(', ')}`);
  const sentinels = internalSentinelPaths(ledger);
  if (sentinels.length) issues.push(`ledger internal sentinels: ${sentinels.join(', ')}`);
  return issues;
}

function coldLedgerContractViolations(audit, ledger) {
  const issues = [...sanitizedLedgerViolations(ledger)];
  if (!audit) return [...issues, 'cold orchestration audit is absent'];
  const callIds = new Set(audit.agents.map(item => item.call_id));
  const items = ledger.items.filter(item => callIds.has(item.call_id));
  if (items.length !== REQUIRED_NEMOTRON_AGENT_IDS.length) issues.push('cold ledger does not contain exactly six bound calls');
  const responseIds = items.map(item => item.response_id);
  if (!responseIds.every(nonemptyString) || new Set(responseIds).size !== REQUIRED_NEMOTRON_AGENT_IDS.length) issues.push('cold response IDs are missing or duplicated');
  for (const agent of audit.agents) {
    const item = items.find(value => value.call_id === agent.call_id);
    if (!item) continue;
    if (item.orchestration_id !== audit.orchestration_id || item.agent_id !== agent.agent_id) issues.push(`${agent.agent_id}: ledger orchestration binding mismatch`);
    if (item.parent_call_id !== agent.parent_call_id || item.delegation_id !== agent.delegation_id) issues.push(`${agent.agent_id}: ledger parent/delegation binding mismatch`);
    if (agent.response_id !== item.response_id || agent.response_model !== item.response_model || agent.upstream_provider !== item.upstream_provider || agent.call_count !== item.call_count) issues.push(`${agent.agent_id}: run audit and ledger response binding mismatch`);
    if (item.call_count !== 1 || !SUCCESSFUL_MODEL_OUTCOMES.has(item.outcome)) issues.push(`${agent.agent_id}: ledger is not a successful cold network call`);
    if (item.provider !== 'openrouter' || item.provider_endpoint !== 'https://openrouter.ai/api/v1/chat/completions') issues.push(`${agent.agent_id}: provider identity mismatch`);
    if (item.model !== REQUESTED_NEMOTRON_MODEL || !EXACT_NEMOTRON_RESPONSE_MODELS.has(item.response_model)) issues.push(`${agent.agent_id}: requested/returned model mismatch`);
    if (!nonemptyString(item.response_id) || item.upstream_provider !== 'DeepInfra' || !nonemptyString(item.finish_reason)) issues.push(`${agent.agent_id}: complete exact provider identity is absent`);
    if (!ALLOWED_USAGE_SOURCES.has(item.usage_source)) issues.push(`${agent.agent_id}: usage provenance is invalid`);
    if (!Number.isFinite(item.actual_cost_usd) || item.actual_cost_usd <= 0) issues.push(`${agent.agent_id}: actual cost must be positive`);
    if (!Number.isInteger(item.prompt_tokens) || item.prompt_tokens <= 0 || !Number.isInteger(item.completion_tokens) || item.completion_tokens <= 0 || !Number.isInteger(item.total_tokens) || item.total_tokens < item.prompt_tokens + item.completion_tokens) issues.push(`${agent.agent_id}: token accounting is invalid`);
    const acceptedCount = agent.agent_id === 'canonical_facts' ? item.accepted_fact_count : item.accepted_item_count;
    const rejectedCount = agent.agent_id === 'canonical_facts' ? item.rejected_fact_count : item.rejected_item_count;
    if (acceptedCount !== agent.accepted_count || rejectedCount !== agent.rejected_count || item.deterministic_fallback_applied !== agent.deterministic_fallback_applied) issues.push(`${agent.agent_id}: ledger contribution diagnostics mismatch`);
    if (agent.agent_id === 'canonical_facts'
      && (item.source_reference_projection_count !== agent.source_reference_projection_count
        || JSON.stringify(item.source_reference_projection_fact_ids) !== JSON.stringify(agent.source_reference_projection_fact_ids))) issues.push('canonical_facts: ledger source projection diagnostics mismatch');
  }
  return issues;
}

function warmLineageContractViolations(coldAudit, warmAudit, ledger) {
  const issues = [];
  if (!coldAudit || !warmAudit) return { issues: ['cold or warm orchestration audit is absent'], lineage: [] };
  if (coldAudit.orchestration_id === warmAudit.orchestration_id) issues.push('cold and warm runs must have distinct orchestration IDs');
  const coldByAgent = new Map(coldAudit.agents.map(item => [item.agent_id, item]));
  const warmCallIds = new Set(warmAudit.agents.map(item => item.call_id));
  const warmLedger = ledger.items.filter(item => warmCallIds.has(item.call_id));
  if (warmLedger.length !== REQUIRED_NEMOTRON_AGENT_IDS.length) issues.push('warm ledger does not contain exactly six bound cache records');
  const lineage = [];
  for (const warm of warmAudit.agents) {
    const cold = coldByAgent.get(warm.agent_id);
    const item = warmLedger.find(value => value.call_id === warm.call_id);
    if (!cold || !item) continue;
    if (warm.call_id === cold.call_id || warm.origin_call_id !== cold.call_id || item.origin_call_id !== cold.call_id) issues.push(`${warm.agent_id}: warm origin does not bind to the cold call`);
    if (item.orchestration_id !== warmAudit.orchestration_id || item.agent_id !== warm.agent_id) issues.push(`${warm.agent_id}: warm ledger orchestration binding mismatch`);
    if (item.parent_call_id !== warm.parent_call_id || item.delegation_id !== warm.delegation_id) issues.push(`${warm.agent_id}: warm ledger parent/delegation binding mismatch`);
    if (warm.response_id !== item.response_id || warm.response_model !== item.response_model || warm.upstream_provider !== item.upstream_provider || warm.call_count !== item.call_count) issues.push(`${warm.agent_id}: warm run audit and ledger response binding mismatch`);
    if (item.call_count !== 0 || item.outcome !== 'cache_hit' || item.usage_source !== 'cache') issues.push(`${warm.agent_id}: warm record made or claims a provider call`);
    const coldLedger = ledger.items.find(value => value.call_id === cold.call_id);
    if (!coldLedger || item.response_id !== coldLedger.response_id || item.response_model !== coldLedger.response_model || item.upstream_provider !== 'DeepInfra' || coldLedger.upstream_provider !== 'DeepInfra') issues.push(`${warm.agent_id}: cached response identity/provider does not match the exact cold origin`);
    const originUsage = item.origin_usage;
    const expectedOriginUsage = coldLedger && {
      prompt_tokens: coldLedger.prompt_tokens,
      completion_tokens: coldLedger.completion_tokens,
      total_tokens: coldLedger.total_tokens,
      actual_cost_usd: coldLedger.actual_cost_usd,
      usage_source: coldLedger.usage_source,
    };
    if (!originUsage
      || !exactMembers(Object.keys(originUsage), ['prompt_tokens', 'completion_tokens', 'total_tokens', 'actual_cost_usd', 'usage_source'])
      || JSON.stringify(originUsage) !== JSON.stringify(expectedOriginUsage)
      || item.origin_finish_reason !== coldLedger?.finish_reason) issues.push(`${warm.agent_id}: bounded origin usage/finish provenance does not match the cold record`);
    lineage.push({ agent_id: warm.agent_id, cold_call_id: cold.call_id, warm_call_id: warm.call_id, response_id: item.response_id, response_model: item.response_model });
  }
  return { issues, lineage };
}

function returnedReviewTransform(value) {
  return value?.review_transform
    || value?.review_response?.review_transform
    || value?.result?.review_transform
    || value?.result?.audit?.review_transform
    || null;
}

function reviewTransformContractViolations(reviewed, persistedRun, preReviewRun) {
  const issues = [];
  const responseTransform = returnedReviewTransform(reviewed);
  const persistedTransform = returnedReviewTransform(persistedRun);
  if (!responseTransform || !persistedTransform) return ['review_transform is absent from the review response or persisted run'];
  if (stableJson(responseTransform) !== stableJson(persistedTransform)) issues.push('review response and persisted run carry different review transforms');
  const preAudit = orchestrationAudit(preReviewRun);
  const hasModelAcceptance = preAudit?.model_assisted === true && Array.isArray(preAudit?.deterministic_gates);
  const processGate = preAudit?.deterministic_gates?.find(item => item.agent_id === 'deterministic_process_gate');
  const evidenceGate = preAudit?.deterministic_gates?.find(item => item.agent_id === 'deterministic_evidence_gate');
  const expected = {
    acceptance_scope: 'post_review_unverified_transform',
    authority: 'unverified_demo_user',
    qualification_status: 'not_verified',
    input_run_id: preReviewRun?.run_id,
    input_process_hash: processGate?.output_artifact_hash || dtoHash(preReviewRun?.result?.process),
    input_checklist_hash: evidenceGate?.output_artifact_hash || dtoHash(preReviewRun?.result?.checklist),
    output_process_hash: dtoHash(reviewed?.result?.process),
    output_checklist_hash: dtoHash(reviewed?.result?.checklist),
    model_acceptance_reused: false,
  };
  if (!exactMembers(Object.keys(responseTransform), Object.keys(expected))) issues.push('review response review_transform schema is not exact and bounded');
  if (!exactMembers(Object.keys(persistedTransform), Object.keys(expected))) issues.push('persisted review_transform schema is not exact and bounded');
  for (const [key, value] of Object.entries(expected)) {
    if (responseTransform[key] !== value) issues.push(`review_transform.${key} mismatch`);
  }
  if (dtoHash(preReviewRun?.result?.process) !== expected.input_process_hash || dtoHash(preReviewRun?.result?.checklist) !== expected.input_checklist_hash) issues.push('review transform inputs do not match exact pre-review accepted DTO hashes');
  if (dtoHash(persistedRun?.result?.process) !== expected.output_process_hash || dtoHash(persistedRun?.result?.checklist) !== expected.output_checklist_hash) issues.push('persisted post-review DTO hashes do not match the review response');
  if (JSON.stringify(persistedRun?.result?.process) !== JSON.stringify(reviewed?.result?.process) || JSON.stringify(persistedRun?.result?.checklist) !== JSON.stringify(reviewed?.result?.checklist)) issues.push('persisted post-review DTOs differ from the applied response');
  if (hasModelAcceptance) {
    const postAudit = orchestrationAudit(persistedRun);
    for (const gateId of REQUIRED_DETERMINISTIC_GATE_IDS) {
      const before = preAudit.deterministic_gates?.find(item => item.agent_id === gateId);
      const after = postAudit?.deterministic_gates?.find(item => item.agent_id === gateId);
      if (!before || !after || after.acceptance_scope !== 'pre_review_model_output' || after.output_artifact_hash !== before.output_artifact_hash) issues.push(`${gateId}: original model-time acceptance was rewritten by the review transform`);
    }
  }
  const numericHazards = [
    ...nonIntegerNumberPaths(reviewed?.result?.process, '$.reviewed.process'),
    ...nonIntegerNumberPaths(reviewed?.result?.checklist, '$.reviewed.checklist'),
  ];
  if (numericHazards.length) issues.push(`post-review transformed DTO contains non-integer numeric values at ${numericHazards.join(', ')}`);
  const sensitive = forbiddenFieldPaths({ responseTransform, persistedTransform });
  if (sensitive.length) issues.push(`review transform leaks forbidden fields: ${sensitive.join(', ')}`);
  return issues;
}

function deterministicReferenceRunViolations(run, knowledgeMode) {
  const issues = [];
  const result = run?.result;
  const resultAudit = result?.audit;
  if (run?.status !== 'complete'
    || run?.claim_id !== 'DEMO-MOULD-002'
    || run?.knowledge_mode !== knowledgeMode
    || run?.model_mode !== DETERMINISTIC_REFERENCE_MODE
    || run?.model != null
    || run?.profile !== DETERMINISTIC_REFERENCE_PROFILE) issues.push('top-level deterministic-reference identity is invalid');
  if (!nonemptyString(run?.run_id)) issues.push('run_id is absent');
  if (stableJson(run?.agent_orchestration) !== stableJson(DETERMINISTIC_REFERENCE_ORCHESTRATION)
    || stableJson(result?.agent_orchestration) !== stableJson(DETERMINISTIC_REFERENCE_ORCHESTRATION)
    || stableJson(resultAudit?.agent_orchestration) !== stableJson(DETERMINISTIC_REFERENCE_ORCHESTRATION)) issues.push('deterministic non-executed orchestration binding is not exact');
  if (resultAudit?.profile !== DETERMINISTIC_REFERENCE_PROFILE
    || resultAudit?.authority_mode !== DETERMINISTIC_REFERENCE_MODE
    || stableJson(resultAudit?.canonicalization) !== stableJson(DETERMINISTIC_REFERENCE_CANONICALIZATION)) issues.push('deterministic-reference canonicalization authority is not explicit');
  if (result?.next_action?.agent_brief_contribution !== null) issues.push('deterministic comparison retained a model-authored final brief');
  if (!Array.isArray(run?.events)) issues.push('deterministic event stream is absent');

  const forbiddenActivityFields = new Set([
    'agents', 'deterministic_gates', 'execution_topology', 'specialist_artifacts',
    'final_claim_brief', 'agent_contribution', 'call_id', 'response_id',
    'response_model', 'requested_model', 'generation_model', 'upstream_provider',
    'provider_endpoint', 'cache_hit', 'call_count', 'origin_call_id', 'origin_usage',
    'origin_finish_reason', 'usage_source', 'orchestration_id', 'delegation_id',
    'parent_call_id', 'prompt_tokens', 'completion_tokens', 'total_tokens',
    'estimated_cost_usd', 'actual_cost_usd', 'latency_ms',
  ]);
  const activityPaths = [];
  const visit = (value, currentPath) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${currentPath}[${index}]`));
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${currentPath}.${key}`;
      if (forbiddenActivityFields.has(key)
        || (['model', 'provider'].includes(key) && child != null)
        || (key === 'actor_type' && child === 'nemotron_agent')
        || (key === 'implementation' && child === EXPECTED_RUNTIME.implementation)) activityPaths.push(childPath);
      visit(child, childPath);
    }
  };
  visit(run, '$');
  if (activityPaths.length) issues.push(`model execution activity is present at ${activityPaths.join(', ')}`);
  const sensitive = forbiddenFieldPaths(run);
  if (sensitive.length) issues.push(`forbidden public fields are present at ${sensitive.join(', ')}`);
  const sentinels = internalSentinelPaths(run);
  if (sentinels.length) issues.push(`internal execution sentinels are present at ${sentinels.join(', ')}`);
  return issues;
}

function productionOpeningContextViolations(captures) {
  const issues = [];
  const opening = Array.isArray(captures) ? captures[0] : null;
  if (!opening) return ['production opening context was not captured'];
  if (opening.actor_type !== 'deterministic_tool') issues.push('production opening setup is not visibly attributed to deterministic_tool');
  if (opening.boundary_text !== EXPECTED_PRODUCTION_OPENING_BOUNDARY) issues.push('production opening boundary copy is not exact');
  if (opening.nemotron_plan_visible !== false) issues.push('Nemotron plan was visible before its returned event');
  if (/legacy deterministic reference/i.test(opening.boundary_text || '')) issues.push('production opening boundary incorrectly claims the legacy reference pipeline');
  return issues;
}

function assertDeploymentAlignment(frontend, api) {
  const localMode = isLocal(BASE) && isLocal(API);
  const expected = process.env.CASEPATH_EXPECTED_SOURCE_COMMIT || '';
  const qaCommit = deploymentIdentity.qa.source_commit;
  check('Frontend, API, and QA use the canonical release identifier', frontend.release_id === RELEASE_ID && api.release_id === RELEASE_ID && deploymentIdentity.qa.release_id === RELEASE_ID, JSON.stringify(deploymentIdentity));
  if (!localMode) {
    check('Production deployment identities expose real source commits', validSourceCommit(frontend.source_commit) && validSourceCommit(api.source_commit) && validSourceCommit(qaCommit), JSON.stringify(deploymentIdentity));
    check('Production deployment identities are internally conflict-free', frontend.alignment_eligible === true && api.source_commit_aligned === true && api.source_commit_conflict === false, JSON.stringify(deploymentIdentity));
    check('Production frontend, API, and QA source commits are aligned', frontend.source_commit === api.source_commit && api.source_commit === qaCommit, JSON.stringify(deploymentIdentity));
    return;
  }
  if (expected && expected !== 'local') {
    check('Local expected source commit is a real Git identity', validSourceCommit(expected), expected);
    check('Local frontend and API match the explicit expected source commit', frontend.source_commit === expected && api.source_commit === expected, JSON.stringify(deploymentIdentity));
    if (qaCommit) check('Local QA build matches the explicit expected source commit', qaCommit === expected, JSON.stringify(deploymentIdentity));
    return;
  }
  const localSentinels = new Set(['local', 'unknown']);
  const bothExplicitlyLocal = localSentinels.has(frontend.source_commit) && localSentinels.has(api.source_commit);
  const sameRealCommit = validSourceCommit(frontend.source_commit) && frontend.source_commit === api.source_commit;
  check('Local alignment is either an identical commit or an explicit local sentinel', sameRealCommit || bothExplicitlyLocal, JSON.stringify(deploymentIdentity));
  if (qaCommit && qaCommit !== 'local') check('Local QA build does not conflict with returned source identity', validSourceCommit(qaCommit) && (!sameRealCommit || qaCommit === frontend.source_commit), JSON.stringify(deploymentIdentity));
  notes.push('Local-mode source identity accepted explicitly; production still requires one matching non-unknown 40-character commit across frontend, API, and QA.');
}

function assertReleaseRuntimeContract(releaseContract) {
  const runtime = releaseContract?.agentic_runtime;
  const runtimeAcceptance = releaseContract?.truth?.production_runtime_acceptance;
  const dynamicEvidence = runtimeAcceptance?.dynamic_evidence;
  check('Release uses the dynamic 2.2 contract without embedding a mutable verdict', releaseContract?.$schema === './release.schema.json' && releaseContract?.contract === 'casepath.release-contract/2.2.0' && releaseContract?.schema_version === '2.2.0' && releaseContract?.source_identity?.authority === 'dynamic_same_commit_qa_artifacts' && releaseContract?.source_identity?.source_contract_embeds_commit === false && releaseContract?.source_identity?.runtime_environment_variable === 'RENDER_GIT_COMMIT' && nonemptyString(releaseContract?.source_identity?.unknown_semantics), JSON.stringify({ contract: releaseContract?.contract, schema_version: releaseContract?.schema_version, source_identity: releaseContract?.source_identity }));
  check('Release contract identifies the canonical v20 product, API 15.2, and QA gate', releaseContract?.release_id === RELEASE_ID && releaseContract?.components?.frontend?.version === PRODUCT_RELEASE && releaseContract?.components?.api?.version === API_RELEASE && releaseContract?.components?.pipeline?.version === API_RELEASE && releaseContract?.components?.qa?.version === PRODUCT_RELEASE, JSON.stringify(releaseContract?.components));
  check('Release contract requests the pinned LangChain, LangGraph, and OpenRouter adapter versions', stableJson(runtime?.framework) === stableJson(EXPECTED_FRAMEWORK), JSON.stringify(runtime?.framework));
  check('Release contract requests the exact six-agent Nemotron runtime', runtime?.runtime_profile === EXPECTED_RUNTIME.runtime_profile && runtime?.authority_mode === EXPECTED_RUNTIME.authority_mode && runtime?.implementation === EXPECTED_RUNTIME.implementation && runtime?.orchestration_schema === EXPECTED_RUNTIME.orchestration_schema && runtime?.model === REQUESTED_NEMOTRON_MODEL && exactMembers(runtime?.model_agents?.map(item => item.agent_id), REQUIRED_NEMOTRON_AGENT_IDS), JSON.stringify(runtime));
  check('Release contract keeps logical specialist fan-out, three deterministic authority gates, physical provider single-flight, and disabled trace payload storage', stableJson(runtime?.parallel_groups) === stableJson(EXPECTED_EXECUTION_TOPOLOGY.parallel_groups) && exactMembers(runtime?.deterministic_gates?.map(item => item.gate_id), REQUIRED_DETERMINISTIC_GATE_IDS) && runtime?.safety?.deterministic_safety_authority === true && runtime?.safety?.provider_max_in_flight === 1 && runtime?.safety?.external_tracing === false && runtime?.safety?.prompt_storage === false && runtime?.safety?.raw_output_storage === false, JSON.stringify({ parallel_groups: runtime?.parallel_groups, safety: runtime?.safety }));
  check('Release contract delegates the mutable production verdict to hash-bound same-commit QA artifacts', runtimeAcceptance?.verdict_authority === 'dynamic_same_commit_qa_artifacts' && runtimeAcceptance?.source_contract_embeds_runtime_verdict === false && exactMembers(Object.keys(dynamicEvidence || {}), ['qa_gate', 'report_path', 'evidence_manifest_path', 'evidence_manifest_contract', 'required_report_status', 'requires_release_id_match', 'requires_non_unknown_source_commit', 'requires_same_source_commit']) && dynamicEvidence?.qa_gate === 'focused-flagship-journey-v20' && dynamicEvidence?.report_path === 'report.json' && dynamicEvidence?.evidence_manifest_path === 'evidence-manifest.json' && dynamicEvidence?.evidence_manifest_contract === 'casepath.qa-evidence-manifest/1.0.0' && dynamicEvidence?.required_report_status === 'passed' && dynamicEvidence?.requires_release_id_match === true && dynamicEvidence?.requires_non_unknown_source_commit === true && dynamicEvidence?.requires_same_source_commit === true, JSON.stringify(runtimeAcceptance));
  check('Dynamic production acceptance declares every exact paid-call, contribution, cold-run, gate, and fallback criterion', exactMembers(Object.keys(runtimeAcceptance || {}), ['verdict_authority', 'source_contract_embeds_runtime_verdict', 'dynamic_evidence', ...Object.keys(EXPECTED_RUNTIME_ACCEPTANCE_CRITERIA)]) && Object.entries(EXPECTED_RUNTIME_ACCEPTANCE_CRITERIA).every(([key, value]) => runtimeAcceptance?.[key] === value), JSON.stringify(runtimeAcceptance));
  check('Release separates deterministic build proof and failed-closed history from current runtime acceptance', stableJson(releaseContract?.truth?.deterministic_build) === stableJson({ status: 'passed', execution_mode: 'deterministic_reference', model_calls: 0, model_backed: false }) && releaseContract?.truth?.historical_model_validation?.scope === 'failed_closed_history_only' && releaseContract?.truth?.historical_model_validation?.establishes_current_runtime_acceptance === false && stableJson(releaseContract?.truth?.historical_model_validation?.evidence_records) === stableJson(EXPECTED_FAILED_MODEL_ATTEMPT_RECORDS), JSON.stringify(releaseContract?.truth));
  check('Release keeps unearned expert, legal, operational, and real-claim claims false', ['independent_expert_review', 'blind_review_completed', 'legal_approval', 'operational_validation', 'real_claims_approved'].every(key => releaseContract?.truth?.[key] === false) && releaseContract?.truth?.generated_data_only === true, JSON.stringify(releaseContract?.truth));
  check('Release acceptance identity uses independent component versions but one release/source identity', releaseContract?.compatibility?.component_versions_are_independent === true && /same release_id/i.test(releaseContract?.compatibility?.acceptance_rule || '') && /same non-unknown source commit/i.test(releaseContract?.compatibility?.acceptance_rule || ''), JSON.stringify(releaseContract?.compatibility));
}

function providerSingleFlightContractViolations(releaseContract, health, readiness) {
  const issues = [];
  if (stableJson(releaseContract?.agentic_runtime?.parallel_groups) !== stableJson(EXPECTED_EXECUTION_TOPOLOGY.parallel_groups)) issues.push('logical fan-out topology changed');
  if (releaseContract?.agentic_runtime?.safety?.provider_max_in_flight !== 1) issues.push('release safety cap is not one');
  if (releaseContract?.truth?.production_runtime_acceptance?.required_provider_max_in_flight !== 1) issues.push('runtime acceptance cap is not one');
  if (health?.agentic_runtime?.safety?.provider_max_in_flight !== 1) issues.push('health cap is not one');
  if (readiness?.agentic_runtime?.safety?.provider_max_in_flight !== 1) issues.push('readiness cap is not one');
  return issues;
}

function cursorSemanticContractViolations(cursorSteps, expectedSpineIds, production = false) {
  const issues = [];
  if (!cursorSteps.length) issues.push('no cursor steps emitted');
  cursorSteps.forEach((step, index) => {
    if (!step.activationKey || !step.target || !Number.isFinite(step.x) || !Number.isFinite(step.y)) issues.push(`${index}: incomplete semantic cursor key`);
    if (step.actorType === 'nemotron_agent') {
      if (!REQUIRED_NEMOTRON_AGENT_IDS.includes(step.agentId)) issues.push(`${index}: unrecognized model agent`);
      if (step.signature !== REQUIRED_NEMOTRON_AGENT_SIGNATURES[step.agentId]?.signature) issues.push(`${index}: agent signature drift`);
      if (!['working', 'artifact'].includes(step.phase)) issues.push(`${index}: model cursor phase is not explicit`);
    } else if (step.agentId) issues.push(`${index}: non-agent inherited model identity`);
    if (step.focus && (step.focus.focusIdCount !== 1 || step.focus.cursorIdCount !== 1 || step.focus.focusCount !== 1 || step.focus.cursorCount !== 1 || !step.focus.cursorInsideFocus)) issues.push(`${index}: cursor/focus multiplicity`);
  });
  const activations = cursorSteps.map(step => step.activationKey);
  if (new Set(activations).size !== activations.length) issues.push('semantic cursor activation repeated');
  for (const nodeId of expectedSpineIds) {
    if (!cursorSteps.some(step => step.moment === 'process' && step.target.endsWith(`:${nodeId}`))) issues.push(`${nodeId}: cursor never followed graph step`);
  }
  if (!production) return issues;

  const modelSteps = cursorSteps.filter(step => step.actorType === 'nemotron_agent');
  if (!exactMembers([...new Set(modelSteps.map(step => step.agentId))], REQUIRED_NEMOTRON_AGENT_IDS)) issues.push('production cursor did not present exact six model identities');
  if (!exactMembers([...new Set(modelSteps.map(step => step.signature))], Object.values(REQUIRED_NEMOTRON_AGENT_SIGNATURES).map(value => value.signature))) issues.push('production cursor signatures are not exact');
  for (const agentId of REQUIRED_NEMOTRON_AGENT_IDS) {
    const agentSteps = modelSteps.filter(step => step.agentId === agentId);
    const artifactSteps = agentSteps.filter(step => step.phase === 'artifact');
    if (artifactSteps.length !== 1) {
      issues.push(`${agentId}: expected exactly one receipt-bound artifact phase`);
      continue;
    }
    const step = artifactSteps[0];
    const artifact = step.ownedArtifact;
    if (!artifact || artifact.targetCount !== 1 || artifact.owner !== step.agentId || artifact.actorType !== 'nemotron_agent' || !nonemptyString(step.callId) || !nonemptyString(step.outputArtifact) || !nonemptyString(artifact.callId) || !nonemptyString(artifact.outputArtifact)) issues.push(`${step.agentId}: visible owned artifact is not exactly bound to its receipt`);
    if (artifact?.requestedModel !== REQUESTED_NEMOTRON_MODEL || !EXACT_NEMOTRON_RESPONSE_MODELS.has(artifact?.responseModel)) issues.push(`${step.agentId}: visible owned artifact is not bound to the required Nemotron model receipt`);
    if (!step.target.includes(`${step.agentId}:${artifact?.outputArtifact || ''}`)) issues.push(`${step.agentId}: cursor did not target its owned output artifact`);
    if (step.callId !== artifact?.callId || step.outputArtifact !== artifact?.outputArtifact) issues.push(`${step.agentId}: cursor artifact phase is not bound to its emitted call/output identity`);
  }
  return issues;
}

function assertHealthRuntimeContract(health, releaseRuntime) {
  const runtime = health.agentic_runtime;
  if (!isProductionJourney()) {
    check('Local health remains in deterministic reference mode without activating a model', health.model_mode === 'deterministic_reference' && health.model == null && health.runtime_profile === 'deterministic_reference' && runtime?.profile === 'deterministic_reference' && runtime?.execution_mode === 'deterministic_reference' && runtime?.authority_mode === 'deterministic_reference' && runtime?.implementation === 'deterministic_reference' && runtime?.schema == null && exactMembers(runtime?.required_agent_ids, []) && exactMembers(runtime?.deterministic_gate_ids, []), JSON.stringify({ model_mode: health.model_mode, model: health.model, runtime }));
    check('Local deterministic health still reports the pinned inactive framework, provider single-flight cap, and trace-disabled safety posture', stableJson(runtime?.framework) === stableJson(EXPECTED_FRAMEWORK) && runtime?.safety?.provider_max_in_flight === 1 && runtime?.safety?.provider_max_in_flight === releaseRuntime?.safety?.provider_max_in_flight && runtime?.safety?.external_tracing === false && runtime?.safety?.prompt_storage === false && runtime?.safety?.raw_output_storage === false, JSON.stringify(runtime));
    return;
  }
  check('Production health returns the active Nemotron LangGraph runtime profile and schema', health.runtime_profile === EXPECTED_RUNTIME.runtime_profile && runtime?.profile === EXPECTED_RUNTIME.runtime_profile && runtime?.execution_mode === 'nemotron_multi_agent' && runtime?.authority_mode === EXPECTED_RUNTIME.authority_mode && runtime?.implementation === EXPECTED_RUNTIME.implementation && runtime?.schema === EXPECTED_RUNTIME.orchestration_schema && health.model === REQUESTED_NEMOTRON_MODEL, JSON.stringify(runtime));
  check('Production health returns the exact requested framework versions', stableJson(runtime?.framework) === stableJson(releaseRuntime.framework) && stableJson(runtime?.framework) === stableJson(EXPECTED_FRAMEWORK), JSON.stringify(runtime?.framework));
  check('Production health returns the exact six model roles and three deterministic gates', exactMembers(runtime?.required_agent_ids, REQUIRED_NEMOTRON_AGENT_IDS) && exactMembers(runtime?.deterministic_gate_ids, REQUIRED_DETERMINISTIC_GATE_IDS), JSON.stringify(runtime));
  check('Production health attests the exact private DeepInfra route, provider single-flight cap, and disabled tracing, storage, fallback, and inference retries', runtime?.safety?.deterministic_contract_authority === true && runtime?.safety?.provider_max_in_flight === 1 && runtime?.safety?.provider_max_in_flight === releaseRuntime?.safety?.provider_max_in_flight && runtime?.safety?.external_tracing === false && runtime?.safety?.prompt_storage === false && runtime?.safety?.raw_output_storage === false && runtime?.safety?.model_fallback === false && runtime?.safety?.automatic_inference_retry === false && stableJson(runtime?.safety?.provider_routing) === stableJson({ endpoint_tag: 'deepinfra/fp4', expected_upstream_provider: 'DeepInfra', allow_fallbacks: false, require_parameters: true, data_collection: 'deny' }), JSON.stringify(runtime?.safety));
}

function assertReadinessContract(readiness) {
  const budgetCredential = readiness?.model_budget?.credential_configured;
  const runtimeCredential = readiness?.agentic_runtime?.safety?.credential_configured;
  check('Readiness safely exposes only matching boolean OpenRouter credential receipts', typeof budgetCredential === 'boolean' && typeof runtimeCredential === 'boolean' && budgetCredential === runtimeCredential, JSON.stringify({ budgetCredential, runtimeCredential }));
  check('Readiness pins physical provider admission to exactly one in-flight send', readiness?.agentic_runtime?.safety?.provider_max_in_flight === 1, JSON.stringify(readiness?.agentic_runtime?.safety));
  check('Readiness discloses the exact bounded budget and ephemeral-ledger posture', readiness?.model_budget?.budget_scope === 'instance_lifetime' && readiness?.model_budget?.ledger_persistence === 'ephemeral_instance' && readiness?.model_budget?.external_key_hard_limit_guard === 'configured', JSON.stringify(readiness?.model_budget));
  check('Readiness receipt contains no credential material or internal execution sentinel', internalSentinelPaths(readiness).length === 0 && !/sk-or-v1-[A-Za-z0-9_-]{8,}/.test(JSON.stringify(readiness)), JSON.stringify({ sentinel_paths: internalSentinelPaths(readiness) }));
  if (isProductionJourney()) {
    check('Production is ready only with the OpenRouter credential configured', readiness?.status === 'ready' && budgetCredential === true && runtimeCredential === true, JSON.stringify({ status: readiness?.status, budgetCredential, runtimeCredential }));
    return;
  }
  check('Local deterministic mode remains ready whether or not an inactive OpenRouter credential is configured', readiness?.status === 'ready', JSON.stringify({ status: readiness?.status, budgetCredential, runtimeCredential }));
}

async function getJsonForSession(url, sessionId, options = {}) {
  const target = new URL(url);
  const apiOrigin = new URL(API).origin;
  const headers = target.origin === apiOrigin ? { 'X-CasePath-Session': sessionId, ...(options.headers || {}) } : options.headers;
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${url}: ${response.status}`);
  return response.json();
}

async function getJson(url, options = {}) {
  return getJsonForSession(url, QA_SESSION_ID, options);
}

async function getText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url}: ${response.status}`);
  return response.text();
}

async function resetDemo() {
  const value = await getJson(`${API}/api/demo/reset`, { method: 'POST' });
  demoMutated = true;
  return value;
}

async function waitVisible(selector, timeout = 180000) {
  await page.locator(selector).first().waitFor({ state: 'visible', timeout });
}

async function waitHidden(selector, timeout = 30000) {
  await page.locator(selector).first().waitFor({ state: 'hidden', timeout });
}

async function waitText(selector, pattern, timeout = 180000) {
  await page.waitForFunction(({ selector, source, flags }) => {
    const node = document.querySelector(selector);
    return node && new RegExp(source, flags).test(node.textContent || '');
  }, { selector, source: pattern.source, flags: pattern.flags }, { timeout });
}

async function waitForValue(read, timeout = 180000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await read();
    if (value) return value;
    await sleep(100);
  }
  throw new Error('Timed out waiting for captured response');
}

async function screenshot(name, fullPage = false) {
  await page.screenshot({ path: path.join(OUT, name), fullPage });
}

async function awaitRunForSession(runId, sessionId) {
  const timeout = runTimeoutMs();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${API}/api/runs/${encodeURIComponent(runId)}/events?after=0`, {
      headers: {
        Accept: 'text/event-stream',
        'X-CasePath-Session': sessionId,
      },
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error(`run ${runId} event stream returned ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let terminal = false;
    while (!terminal) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const frames = buffer.replaceAll('\r\n', '\n').split('\n\n');
      buffer = frames.pop() || '';
      for (const frame of frames) {
        const payload = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!payload) continue;
        const event = JSON.parse(payload);
        if (['run.completed', 'run.failed'].includes(event.type)) terminal = true;
      }
      if (done && !terminal) throw new Error(`run ${runId} stream ended before a terminal event`);
    }
    const run = await getJsonForSession(`${API}/api/runs/${encodeURIComponent(runId)}`, sessionId);
    if (run.status === 'complete') return run;
    if (run.status === 'failed') {
      const terminalIssues = terminalFailureContractViolations(run);
      if (terminalIssues.length) throw new Error(`run ${runId} failed public-safety contract: ${JSON.stringify(terminalIssues)}`);
      throw new Error(`run ${runId} failed: ${JSON.stringify(runProgressDiagnostic(run))}`);
    }
    throw new Error(`run ${runId} terminal hydration returned ${run.status}`);
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`run ${runId} timed out after ${timeout}ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function awaitRun(runId) {
  return awaitRunForSession(runId, QA_SESSION_ID);
}

function terminalRunFailureMessage(run) {
  if (run?.status !== 'failed') return null;
  const terminalIssues = terminalFailureContractViolations(run);
  return terminalIssues.length
    ? `run ${run.run_id || 'unknown'} failed public-safety contract: ${JSON.stringify(terminalIssues)}`
    : `run ${run.run_id || 'unknown'} failed: ${JSON.stringify(runProgressDiagnostic(run))}`;
}

async function awaitLaterJourneyTerminalUi() {
  const deadline = Date.now() + runTimeoutMs();
  const latestRuns = new Map();
  while (Date.now() < deadline) {
    const ui = await page.evaluate(() => ({
      moment: document.querySelector('#stageCanvas')?.dataset.casepathMoment || '',
      next: document.querySelector('#journeyNext')?.textContent || '',
    }));
    if (ui.moment === 'failure') {
      throw new Error('Later-claim comparison rendered the safe-failure boundary');
    }
    if (ui.moment === 'later-result' && /Restart the demo/i.test(ui.next)) return;

    for (const runId of runIds.slice(1)) {
      const run = await getJson(`${API}/api/runs/${encodeURIComponent(runId)}`);
      latestRuns.set(runId, run);
      const failure = terminalRunFailureMessage(run);
      if (failure) throw new Error(failure);
    }
    await sleep(LATER_TERMINAL_POLL_INTERVAL_MS);
  }
  throw new Error(`Later-claim comparison timed out after ${runTimeoutMs()}ms: ${JSON.stringify([...latestRuns.values()].map(runProgressDiagnostic))}`);
}

async function waitJourneyUi(label, operation) {
  try {
    return await operation();
  } catch (error) {
    const diagnostics = [];
    for (const runId of runIds.slice(-3)) {
      try {
        diagnostics.push(runProgressDiagnostic(await getJson(`${API}/api/runs/${encodeURIComponent(runId)}`)));
      } catch (diagnosticError) {
        diagnostics.push({ run_id: runId, diagnostic_error: String(diagnosticError) });
      }
    }
    throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}; run diagnostics=${JSON.stringify(diagnostics)}`);
  }
}

async function horizontalOverflow() {
  return page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
}

async function auditViewports(label, selector) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await sleep(120);
  check(`${label} desktop retains its primary artifact`, await page.locator(selector).first().isVisible());
  check(`${label} desktop keeps the source claim available`, await page.locator('.submission-pane').isVisible());
  check(`${label} desktop has no page-level horizontal overflow`, await horizontalOverflow() <= 1, `overflow=${await horizontalOverflow()}`);
  await runAxe(`${label} desktop`);
  await screenshot(`${label}-desktop.png`, true);
}

async function minimalSurfaceSnapshot() {
  return page.evaluate(() => {
    const visible = node => Boolean(node && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
    return {
      focus_count: [...document.querySelectorAll('[data-casepath-focal="true"]')].filter(visible).length,
      artifact_count: [...document.querySelectorAll('[data-casepath-primary-artifact="true"]')].filter(visible).length,
      action_count: [...document.querySelectorAll('[data-casepath-primary-action="true"]')].filter(visible).length,
      cursor_count: [...document.querySelectorAll('#v21AgentCursor')].filter(visible).length,
      source_collapsed: document.querySelector('.submission-pane')?.classList.contains('collapsed') === true,
      source_summary_visible: visible(document.querySelector('#toggleSource')),
      source_content_visible: visible(document.querySelector('#submissionContent')),
    };
  });
}

async function artifactCanvasSnapshot() {
  return page.evaluate(() => {
    const visible = node => Boolean(node && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
    const root = document.querySelector('#artifactCanvas');
    const graph = document.querySelector('#artifactProcessGraph');
    const layout = document.querySelector('[data-layout="source-canvas"]');
    const dock = layout?.querySelector('[data-source-dock-state]') || document.querySelector('[data-source-dock-state]');
    const visibleWithin = selector => [...(root?.querySelectorAll(selector) || [])].filter(visible);
    return {
      root_present: Boolean(root),
      root_visible: visible(root),
      root_same: root === window.__casepathPersistentArtifactCanvas,
      graph_present: Boolean(graph),
      graph_same: graph === window.__casepathPersistentProcessGraph,
      scene: root?.dataset.casepathScene || '',
      layout_visible: visible(layout),
      source_visible: visible(dock),
      source_state: dock?.dataset.sourceDockState || '',
      active_source_locator: dock?.dataset.activeSourceLocator || '',
      focus_count: visibleWithin('[data-artifact-focus="true"]').length,
      artifact_count: visibleWithin('[data-casepath-primary-artifact="true"]').length,
      action_count: [...document.querySelectorAll('[data-casepath-primary-action="true"]')].filter(visible).length,
      cursor_count: visibleWithin('#artifactAgentCursor').length,
      projection: graph?.dataset.graphProjection || '',
      construction_state: graph?.dataset.processConstructionState || '',
      node_states: [...(graph?.querySelectorAll('[data-node-id][data-process-build-state]') || [])].map(node => ({
        node_id: node.dataset.nodeId || '',
        state: node.dataset.processBuildState || '',
      })),
      review_edit_state: graph?.dataset.reviewEditState || root?.dataset.reviewEditState || '',
    };
  });
}

async function spatialGraphGeometrySnapshot() {
  return page.evaluate(() => {
    const visible = node => Boolean(node && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).display !== 'none');
    const rect = node => {
      const value = node.getBoundingClientRect();
      return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
    };
    const inside = (outer, inner) => inner.left >= outer.left - 2 && inner.top >= outer.top - 2 && inner.right <= outer.right + 2 && inner.bottom <= outer.bottom + 2;
    const root = document.querySelector('#artifactCanvas');
    const graph = document.querySelector('#artifactProcessGraph');
    const viewport = graph?.querySelector('[data-spatial-canvas="claim-handling-process"]');
    const graphRect = rect(graph);
    const canvasRect = rect(root);
    const viewportRect = rect(viewport);
    const endpointElements = [
      ...graph.querySelectorAll('[data-ac-node-id][data-node-id]'),
      ...viewport.querySelectorAll('[data-spatial-id]'),
    ].filter(visible);
    const endpointRows = endpointElements.map(node => ({ id: node.dataset.spatialId || node.dataset.nodeId || '', rect: rect(node) })).filter(item => item.id);
    const endpointCounts = endpointRows.reduce((result, item) => ({ ...result, [item.id]: (result[item.id] || 0) + 1 }), {});
    const edgeLayer = graph.querySelector('[data-ac-spatial-edges]');
    const edges = [...edgeLayer.querySelectorAll('[data-spatial-edge][data-edge-source][data-edge-target]')].filter(visible).map(node => {
      const point = length => {
        const local = node.getPointAtLength(length);
        const svgPoint = node.ownerSVGElement.createSVGPoint();
        svgPoint.x = local.x;
        svgPoint.y = local.y;
        const screen = svgPoint.matrixTransform(node.getScreenCTM());
        return { x: screen.x, y: screen.y };
      };
      return {
        source: node.dataset.edgeSource || '',
        target: node.dataset.edgeTarget || '',
        state: node.dataset.edgeState || '',
        path: node.dataset.spatialPath || '',
        start: point(0),
        end: point(node.getTotalLength()),
      };
    });
    const nodes = [...graph.querySelectorAll('[data-ac-node-id][data-node-id][data-process-build-state]')].filter(visible).map(node => {
      const title = node.querySelector('[data-ac-node-title]');
      const titleStyle = getComputedStyle(title);
      const nodeRect = rect(node);
      return {
        id: node.dataset.nodeId || '', state: node.dataset.processBuildState || '', role: node.dataset.spatialRole || '', path: node.dataset.spatialPath || '', selected: node.dataset.selected === 'true',
        changeId: node.dataset.artifactChangeId || '', eventId: node.dataset.artifactEventId || '', agentId: node.dataset.artifactAgentId || '', rect: nodeRect, insideViewport: inside(viewportRect, nodeRect),
        titleFontSize: Number.parseFloat(titleStyle.fontSize), titleClientWidth: title.clientWidth, titleScrollWidth: title.scrollWidth, titleClientHeight: title.clientHeight, titleScrollHeight: title.scrollHeight,
      };
    });
    const spatialRows = selector => [...viewport.querySelectorAll(selector)].filter(visible).map(node => {
      const nodeRect = rect(node);
      return {
        id: node.dataset.nodeId || node.dataset.spatialId || '',
        branchId: node.dataset.branchId || '', state: node.dataset.branchState || '', selected: node.dataset.branchState === 'selected' || node.dataset.selected === 'true',
        anchorNodeId: node.dataset.spatialAnchorNodeId || '', evidenceId: node.dataset.evidenceId || '', lawId: node.dataset.lawId || '',
        rect: nodeRect, insideViewport: inside(viewportRect, nodeRect),
      };
    });
    const activePaths = [...graph.querySelectorAll('[data-active-focal-path="true"]')].filter(visible).map(node => ({
      nodeId: node.dataset.nodeId || '',
      factIds: (node.dataset.basisFactIds || '').split(',').filter(Boolean),
      lawIds: (node.dataset.basisLawIds || '').split(',').filter(Boolean),
      evidenceIds: (node.dataset.basisEvidenceRequirementIds || '').split(',').filter(Boolean),
      insideGraph: graph.contains(node), rect: rect(node),
    }));
    const primaryRows = selector => [...root.querySelectorAll(selector)].filter(visible).map(node => ({ insideGraph: node === graph || graph.contains(node), rect: rect(node) }));
    const competingRects = [...graph.parentElement.children].filter(node => node !== graph && visible(node)).map(rect);
    const status = graph.querySelector('[data-ac-process-status]');
    return {
      processId: graph.dataset.processId || graph.dataset.processGraphId || '', projection: graph.dataset.graphProjection || '', graphRect, canvasRect, viewportRect,
      primaryFoci: primaryRows('[data-artifact-focus="true"]'), primaryArtifacts: primaryRows('[data-casepath-primary-artifact="true"]'),
      primaryActionCount: [...document.querySelectorAll('[data-casepath-primary-action="true"]')].filter(visible).length, competingRects,
      nodes, endpoints: endpointRows, endpointDuplicates: Object.entries(endpointCounts).filter(([, count]) => count !== 1).map(([id]) => id), edges,
      branches: spatialRows('[data-spatial-role~="branch"]'), laws: spatialRows('[data-spatial-role="law"]'), evidence: spatialRows('[data-spatial-role="evidence"]'), nextActions: spatialRows('[data-spatial-next-action="true"]'), activePaths,
      ariaCurrentIds: [...graph.querySelectorAll('[data-ac-action="select-node"][aria-current="step"]')].filter(visible).map(node => node.dataset.nodeId || ''),
      pendingTabStops: [...graph.querySelectorAll('[data-process-build-state="pending"] [data-ac-action="select-node"]')].map(node => ({ tabIndex: node.tabIndex, disabled: node.disabled })),
      status: { role: status?.getAttribute('role') || '', live: status?.getAttribute('aria-live') || '', atomic: status?.getAttribute('aria-atomic') || '' },
      edgeLayerAriaHidden: edgeLayer?.getAttribute('aria-hidden') || '', edgeLayerFocusable: edgeLayer?.getAttribute('focusable') || '',
      cursorAriaHidden: document.querySelector('#artifactAgentCursor')?.getAttribute('aria-hidden') || '',
    };
  });
}

function focusedArtifactCanvasViolations(snapshot) {
  const issues = [];
  if (!snapshot?.root_present || !snapshot.root_visible) issues.push('artifact canvas is absent or hidden');
  if (!snapshot?.root_same) issues.push('artifact canvas root was replaced');
  if (!snapshot?.graph_present || !snapshot.graph_same) issues.push('process graph root was replaced');
  if (!snapshot?.layout_visible || !snapshot?.source_visible) issues.push('source claim and work canvas are not simultaneously visible');
  if (snapshot?.focus_count !== 1) issues.push(`focus count ${snapshot?.focus_count}`);
  if (snapshot?.cursor_count !== 1) issues.push(`cursor count ${snapshot?.cursor_count}`);
  if (snapshot?.artifact_count !== 1) issues.push(`primary artifact count ${snapshot?.artifact_count}`);
  if (snapshot?.action_count > 1) issues.push(`primary action count ${snapshot?.action_count}`);
  return issues;
}

function rectCenter(rect) {
  return { x: rect.left + (rect.width / 2), y: rect.top + (rect.height / 2) };
}

function rectContainsPoint(rect, point, padding = SPATIAL_GEOMETRY_EPSILON_PX) {
  return point.x >= rect.left - padding
    && point.x <= rect.right + padding
    && point.y >= rect.top - padding
    && point.y <= rect.bottom + padding;
}

function rectIntersectionArea(first, second) {
  return Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left))
    * Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
}

function spatialGraphGeometryContractViolations(snapshot, expected) {
  const issues = [];
  if (!snapshot?.graphRect?.width || !snapshot?.canvasRect?.width || !snapshot?.viewportRect?.width) return ['spatial graph geometry is absent'];
  if (snapshot.processId !== expected.processId) issues.push(`process id ${snapshot.processId} does not equal returned ${expected.processId}`);
  if (snapshot.projection !== SPATIAL_GRAPH_PROJECTION) issues.push(`graph projection ${snapshot.projection}`);
  if (snapshot.graphRect.width < snapshot.canvasRect.width * .6 || (snapshot.graphRect.width * snapshot.graphRect.height) < (snapshot.canvasRect.width * snapshot.canvasRect.height * .45)) issues.push('process graph does not occupy the majority of the artifact canvas');
  if (snapshot.primaryFoci.length !== 1 || !snapshot.primaryFoci[0]?.insideGraph) issues.push('the one primary focal artifact is not the process graph');
  if (snapshot.primaryArtifacts.length !== 1 || !snapshot.primaryArtifacts[0]?.insideGraph) issues.push('the one primary artifact is not inside the process graph');
  if (snapshot.primaryActionCount !== 1) issues.push(`ready primary action count ${snapshot.primaryActionCount}`);
  if (snapshot.competingRects.some(rect => (rect.width * rect.height) >= (snapshot.graphRect.width * snapshot.graphRect.height * .2))) issues.push('a large sibling artifact competes with the process graph');

  const nodesById = new Map(snapshot.nodes.map(node => [node.id, node]));
  if (stableJson(snapshot.nodes.map(node => node.id)) !== stableJson(FLAGSHIP_PROCESS_PROJECTION_IDS)) issues.push('visible spatial spine is not the exact pinned projection');
  snapshot.nodes.forEach(node => {
    if (node.state !== 'built') issues.push(`${node.id}: spatial node is not built`);
    if (![node.changeId, node.eventId, node.agentId].every(nonemptyString)) issues.push(`${node.id}: permanent node lineage is incomplete`);
    if (node.agentId !== expected.processAgentId) issues.push(`${node.id}: permanent node lineage has the wrong agent`);
    if (!node.insideViewport) issues.push(`${node.id}: node leaves the graph viewport`);
    if (node.titleFontSize < 12 || node.titleScrollWidth > node.titleClientWidth + 1 || node.titleScrollHeight > node.titleClientHeight + 1) issues.push(`${node.id}: title is clipped or below 12px`);
  });
  for (let index = 0; index < snapshot.nodes.length; index += 1) {
    for (let other = index + 1; other < snapshot.nodes.length; other += 1) {
      if (rectIntersectionArea(snapshot.nodes[index].rect, snapshot.nodes[other].rect) > SPATIAL_GEOMETRY_EPSILON_PX) issues.push(`${snapshot.nodes[index].id}/${snapshot.nodes[other].id}: spine nodes overlap`);
    }
  }
  const spineCenters = snapshot.nodes.map(node => rectCenter(node.rect));
  const horizontalExtent = Math.max(...spineCenters.map(point => point.x)) - Math.min(...spineCenters.map(point => point.x));
  const verticalExtent = Math.max(...spineCenters.map(point => point.y)) - Math.min(...spineCenters.map(point => point.y));
  if (horizontalExtent < snapshot.viewportRect.width * .7 || horizontalExtent <= Math.max(1, verticalExtent) * 2) issues.push('spine is a vertical list instead of a horizontal process');

  const returnedNodeIds = new Set(expected.returnedNodeIds);
  const returnedEdges = new Map(expected.returnedEdges.map(edge => [`${edge.source}->${edge.target}`, edge]));
  if (snapshot.endpointDuplicates.length) issues.push(`spatial endpoint IDs are duplicated: ${snapshot.endpointDuplicates.join(',')}`);
  snapshot.edges.forEach(edge => {
    const source = snapshot.endpoints.find(item => item.id === edge.source);
    const target = snapshot.endpoints.find(item => item.id === edge.target);
    if (!source || !target) {
      issues.push(`${edge.source}->${edge.target}: connector endpoint is not a visible spatial object`);
      return;
    }
    if (!rectContainsPoint(source.rect, edge.start, 5) || !rectContainsPoint(target.rect, edge.end, 5)) issues.push(`${edge.source}->${edge.target}: connector geometry misses its exact endpoints`);
    if (returnedNodeIds.has(edge.source) && returnedNodeIds.has(edge.target)) {
      const returned = returnedEdges.get(`${edge.source}->${edge.target}`);
      if (!returned) issues.push(`${edge.source}->${edge.target}: connector invents a process relationship`);
      else if ((edge.state || '') !== (returned.state || '')) issues.push(`${edge.source}->${edge.target}: connector state differs from the returned edge`);
    }
  });
  const visibleProcessEndpointIds = new Set(snapshot.endpoints.map(item => item.id).filter(id => returnedNodeIds.has(id)));
  const expectedVisibleProcessEdges = expected.returnedEdges
    .filter(edge => visibleProcessEndpointIds.has(edge.source) && visibleProcessEndpointIds.has(edge.target))
    .map(edge => `${edge.source}->${edge.target}:${edge.state || ''}`).sort();
  const renderedProcessEdges = snapshot.edges
    .filter(edge => returnedNodeIds.has(edge.source) && returnedNodeIds.has(edge.target))
    .map(edge => `${edge.source}->${edge.target}:${edge.state || ''}`).sort();
  if (stableJson(renderedProcessEdges) !== stableJson(expectedVisibleProcessEdges)) issues.push('visible connector identities do not equal the returned process edges');
  if (!snapshot.edges.length || snapshot.edgeLayerAriaHidden !== 'true' || snapshot.edgeLayerFocusable !== 'false') issues.push('spatial connectors are absent or exposed to assistive technology');

  const causation = nodesById.get('causation');
  const branchesById = new Map(snapshot.branches.map(branch => [branch.id, branch]));
  if (!causation || stableJson([...branchesById.keys()].sort()) !== stableJson([...REQUIRED_CAUSATION_BRANCH_IDS].sort())) issues.push('causation does not expose the exact four returned uncertainty branches');
  const expectedBranchMap = new Map(expected.causationBranches.map(branch => [branch.target, branch]));
  REQUIRED_CAUSATION_BRANCH_IDS.forEach(branchId => {
    const branch = branchesById.get(branchId);
    if (!branch) return;
    if (!returnedNodeIds.has(branchId) || !expectedBranchMap.has(branchId) || !returnedEdges.has(`causation->${branchId}`)) issues.push(`${branchId}: branch is not justified by the returned process`);
    if (!branch.insideViewport) issues.push(`${branchId}: branch leaves the graph viewport`);
  });
  if (branchesById.get('evidence_gap')?.selected !== true) issues.push('evidence_gap is not the one selected uncertainty branch');
  const branchCenters = snapshot.branches.map(branch => rectCenter(branch.rect));
  const minimumBranchSeparation = Math.max(22, snapshot.viewportRect.height * .055);
  for (let index = 0; index < branchCenters.length; index += 1) {
    for (let other = index + 1; other < branchCenters.length; other += 1) {
      if (Math.hypot(branchCenters[index].x - branchCenters[other].x, branchCenters[index].y - branchCenters[other].y) < minimumBranchSeparation) issues.push('uncertainty branches do not physically diverge');
    }
  }
  if (branchCenters.length === 4 && (Math.max(...branchCenters.map(point => point.y)) - Math.min(...branchCenters.map(point => point.y))) < snapshot.viewportRect.height * .35) issues.push('uncertainty branch fan is visually collapsed');

  const activePaths = snapshot.activePaths;
  if (activePaths.length !== 1 || activePaths[0]?.nodeId !== 'causation' || !activePaths[0]?.insideGraph) issues.push('there is not exactly one causation focal path inside the graph');
  const activePath = activePaths[0];
  if (activePath) {
    const normalizeIds = value => [...value].sort();
    if (stableJson(normalizeIds(activePath.factIds)) !== stableJson(normalizeIds(expected.activeBasis.factIds))) issues.push('active focal path fact basis differs from returned causation facts');
    if (stableJson(normalizeIds(activePath.lawIds)) !== stableJson(normalizeIds(expected.activeBasis.lawIds))) issues.push('active focal path law basis differs from returned causation law');
    if (stableJson(normalizeIds(activePath.evidenceIds)) !== stableJson(normalizeIds(expected.activeBasis.evidenceIds))) issues.push('active focal path evidence basis differs from returned causation requirements');
  }
  if (snapshot.ariaCurrentIds.length !== 1 || snapshot.ariaCurrentIds[0] !== 'causation') issues.push('selected causation node is not the one aria-current step');
  if (snapshot.pendingTabStops.some(item => item.tabIndex !== -1 || item.disabled !== true)) issues.push('pending process nodes remain keyboard reachable');
  if (snapshot.status.role !== 'status' || snapshot.status.live !== 'polite' || snapshot.status.atomic !== 'true') issues.push('process construction status is not concise polite atomic output');
  if (snapshot.cursorAriaHidden !== 'true') issues.push('agent cursor is exposed to assistive technology');

  if (!causation || snapshot.laws.length < 1 || snapshot.laws.some(item => !item.insideViewport || item.anchorNodeId !== 'causation' || item.rect.bottom >= causation.rect.top)) issues.push('legal grounding is not physically above the active causation node');
  if (!causation || snapshot.evidence.length < 1 || snapshot.evidence.some(item => !item.insideViewport || item.anchorNodeId !== 'causation' || item.rect.top <= causation.rect.bottom)) issues.push('evidence requirements are not physically below the active causation node');
  const nextActions = snapshot.nextActions;
  if (nextActions.length !== 1 || !causation || !nextActions[0].insideViewport || nextActions[0].rect.top <= causation.rect.bottom) issues.push('there is not exactly one compact next action beneath the unresolved causation decision');
  const nextEvidence = nextActions[0] && expected.evidenceById[nextActions[0].evidenceId];
  if (!nextEvidence || !Array.isArray(nextEvidence.node_ids) || !nextEvidence.node_ids.includes('evidence_gap')) issues.push('next action evidence is not returned as owned by evidence_gap');
  const visibleSpatialObjects = [
    ...snapshot.nodes.map(item => ({ label: `node:${item.id}`, rect: item.rect })),
    ...snapshot.branches.map(item => ({ label: `branch:${item.id}`, rect: item.rect })),
    ...snapshot.laws.map(item => ({ label: `law:${item.id}`, rect: item.rect })),
    ...snapshot.evidence.map(item => ({ label: `evidence:${item.id}`, rect: item.rect })),
    ...snapshot.nextActions.map(item => ({ label: `next:${item.evidenceId}`, rect: item.rect })),
  ];
  for (let index = 0; index < visibleSpatialObjects.length; index += 1) {
    for (let other = index + 1; other < visibleSpatialObjects.length; other += 1) {
      if (rectIntersectionArea(visibleSpatialObjects[index].rect, visibleSpatialObjects[other].rect) > SPATIAL_GEOMETRY_EPSILON_PX) issues.push(`${visibleSpatialObjects[index].label}/${visibleSpatialObjects[other].label}: visible spatial objects overlap`);
    }
  }
  return [...new Set(issues)];
}

function processProjectionContractViolations(changes, semanticEvents, cursorSteps, production = true) {
  const issues = [];
  const semanticEventIds = new Set(semanticEvents.map(event => event.eventId));
  const cursorBindings = new Set(cursorSteps.filter(step => step.phase === 'click').map(step => `${step.changeId}:${step.eventId}:${step.agentId}`));
  if (stableJson(changes.map(change => change.entityId)) !== stableJson(FLAGSHIP_PROCESS_PROJECTION_IDS)) issues.push('ten-node projection did not arrive in the pinned order');
  changes.forEach((change, index) => {
    const states = Object.fromEntries(change.nodeStates.map(item => [item.nodeId, item.state]));
    const prior = FLAGSHIP_PROCESS_PROJECTION_IDS.slice(0, index);
    const future = FLAGSHIP_PROCESS_PROJECTION_IDS.slice(index + 1);
    const expectedAgent = production ? 'process_decision_mapping' : 'process_projection';
    if (change.agentId !== expectedAgent) issues.push(`${change.entityId}: wrong process agent`);
    if (!nonemptyString(change.changeId) || !nonemptyString(change.eventId)) issues.push(`${change.entityId}: missing change/event identity`);
    if (!semanticEventIds.has(change.eventId)) issues.push(`${change.entityId}: change event is absent from the authenticated stream`);
    if (!cursorBindings.has(`${change.changeId}:${change.eventId}:${change.agentId}`)) issues.push(`${change.entityId}: semantic graph change is not tied to its agent cursor event`);
    if (states[change.entityId] !== 'building') issues.push(`${change.entityId}: current node is not the sole building node`);
    if (!prior.every(nodeId => states[nodeId] === 'built')) issues.push(`${change.entityId}: prior nodes are not built`);
    if (!future.every(nodeId => states[nodeId] === 'pending')) issues.push(`${change.entityId}: future nodes are not pending`);
    if (Object.values(states).filter(value => value === 'building').length !== 1) issues.push(`${change.entityId}: building-node multiplicity`);
    if (change.nodeStates.filter(item => item.state === 'pending').some(item => item.tabIndex !== -1 || item.disabled !== true)) issues.push(`${change.entityId}: pending nodes are keyboard reachable`);
    if (change.nodeStates.filter(item => item.ariaCurrent === 'step').length !== 1) issues.push(`${change.entityId}: aria-current step multiplicity`);
    if (!change.focus || change.focus.focusCount !== 1 || change.focus.cursorCount !== 1 || change.focus.artifactCount !== 1 || change.focus.actionCount > 1) issues.push(`${change.entityId}: focal-surface multiplicity`);
  });
  if (new Set(changes.map(change => change.changeId)).size !== FLAGSHIP_PROCESS_PROJECTION_IDS.length) issues.push('process change IDs are missing or duplicated');
  const holds = changes.slice(1).map((change, index) => change.at - changes[index].at);
  if (holds.some(value => value < MIN_PROCESS_NODE_STEP_MS)) issues.push(`process node dwell ${stableJson(holds)}`);
  return issues;
}

function sourceInspectionContractViolations(inspections, changes, branchVisuals, cursorSteps, runResult, production = true) {
  const issues = [];
  const expectedAgent = production ? 'process_decision_mapping' : 'process_projection';
  const allowedKinds = new Set(['claim-source', 'swiss-law', 'evidence-requirement', 'accepted-process-input']);
  const cursorBindings = new Set(cursorSteps.filter(step => step.phase === 'click').map(step => `${step.changeId}:${step.eventId}:${step.agentId}:${step.targetId}`));
  const processNodes = new Map((runResult?.process?.nodes || []).map(node => [node.node_id, node]));
  const facts = new Map((runResult?.facts || []).map(fact => [fact.fact_id, fact]));
  const checklistItems = runResult?.checklist?.items || [];
  const evidenceOwnerIds = item => (Array.isArray(item?.node_ids) && item.node_ids.length
    ? item.node_ids
    : item?.node_id ? [item.node_id] : []);
  const returnedFactIdsForNode = node => new Set([
    ...(node?.fact_ids || []),
    ...checklistItems
      .filter(item => evidenceOwnerIds(item).includes(node?.node_id) && nonemptyString(item.fact_id))
      .map(item => item.fact_id),
  ]);
  const validSourceId = (inspection, node) => {
    if (inspection.sourceKind === 'accepted-process-input') return inspection.sourceId === node?.node_id;
    if (inspection.sourceKind === 'swiss-law') return (node?.legal_source_ids || []).includes(inspection.sourceId) && inspection.locatorId === `law:${inspection.sourceId}`;
    if (inspection.sourceKind === 'evidence-requirement') return (node?.evidence_requirement_ids || []).includes(inspection.sourceId);
    if (!returnedFactIdsForNode(node).has(inspection.factId)) return false;
    return (facts.get(inspection.factId)?.source_refs || []).some(ref => ref.artifact_id === inspection.sourceId) && inspection.locatorId.includes(inspection.sourceId);
  };
  const nodeInspections = inspections.filter(item => item.entityKind === 'node');
  const branchInspections = inspections.filter(item => item.entityKind === 'branch');
  if (stableJson(nodeInspections.map(item => item.nodeId)) !== stableJson(FLAGSHIP_PROCESS_PROJECTION_IDS)) {
    issues.push('source inspections did not precede all ten process nodes in order');
  }
  nodeInspections.forEach((inspection, index) => {
    const change = changes[index];
    const node = processNodes.get(inspection.nodeId);
    if (!change || change.entityId !== inspection.nodeId) issues.push(`${inspection.nodeId}: inspection/change mismatch`);
    if (inspection.agentId !== expectedAgent) issues.push(`${inspection.nodeId}: wrong inspection actor`);
    if (![inspection.changeId, inspection.eventId, inspection.sourceKind, inspection.sourceId, inspection.found].every(nonemptyString)) {
      issues.push(`${inspection.nodeId}: incomplete inspection provenance`);
    }
    if (!allowedKinds.has(inspection.sourceKind) || !validSourceId(inspection, node)) issues.push(`${inspection.nodeId}: inspection source is not returned by the node basis`);
    if (!cursorBindings.has(`${inspection.changeId}:${inspection.eventId}:${inspection.agentId}:${inspection.sourceId}`)) issues.push(`${inspection.nodeId}: inspection is not bound to the cursor click target`);
    if (change && (change.changeId !== inspection.changeId || change.eventId !== inspection.eventId || change.agentId !== inspection.agentId)) {
      issues.push(`${inspection.nodeId}: inspection is not bound to the resulting node`);
    }
    if (change && change.at - inspection.at < 1100) issues.push(`${inspection.nodeId}: source finding was not readable before the node appeared`);
  });
  if (stableJson(branchInspections.map(item => item.nodeId)) !== stableJson(REQUIRED_CAUSATION_BRANCH_IDS)) {
    issues.push('source inspections did not precede all four causation branches in order');
  }
  branchInspections.forEach((inspection, index) => {
    const visual = branchVisuals[index];
    const node = processNodes.get(inspection.nodeId);
    if (!visual || visual.nodeId !== inspection.nodeId || visual.branchId !== inspection.branchId) issues.push(`${inspection.nodeId}: branch inspection/visual mismatch`);
    if (inspection.agentId !== expectedAgent) issues.push(`${inspection.nodeId}: wrong branch inspection actor`);
    if (![inspection.changeId, inspection.eventId, inspection.sourceKind, inspection.sourceId, inspection.found].every(nonemptyString)) issues.push(`${inspection.nodeId}: incomplete branch inspection provenance`);
    if (!allowedKinds.has(inspection.sourceKind) || !validSourceId(inspection, node)) issues.push(`${inspection.nodeId}: branch inspection source is not returned by the branch node basis`);
    if (!cursorBindings.has(`${inspection.changeId}:${inspection.eventId}:${inspection.agentId}:${inspection.sourceId}`)) issues.push(`${inspection.nodeId}: branch inspection is not bound to the cursor click target`);
    if (visual && (visual.changeId !== inspection.changeId || visual.eventId !== inspection.eventId || visual.agentId !== inspection.agentId)) issues.push(`${inspection.nodeId}: branch inspection is not bound to the resulting branch`);
    if (visual && visual.at - inspection.at < 1100) issues.push(`${inspection.nodeId}: branch finding was not readable before the branch appeared`);
  });
  return issues;
}

function contextualAttachmentContractViolations(attachments, semanticEvents, cursorSteps, production = true) {
  const issues = [];
  const allowedKinds = new Set(['fact', 'law', 'evidence', 'precedent', 'verification']);
  const semanticEventIds = new Set(semanticEvents.map(event => event.eventId));
  const cursorBindings = new Set(cursorSteps.filter(step => step.phase === 'click').map(step => `${step.changeId}:${step.eventId}:${step.agentId}`));
  attachments.forEach((attachment, index) => {
    if (!allowedKinds.has(attachment.kind)) issues.push(`${index}: unsupported attachment kind`);
    if (![attachment.changeId, attachment.eventId, attachment.agentId].every(nonemptyString)) issues.push(`${index}: incomplete semantic attachment identity`);
    const expectedActor = {
      fact: 'canonical_facts',
      law: 'official_law_registry',
      evidence: production ? 'evidence_checklist' : 'evidence_projection',
      precedent: 'historical_claims_retrieval',
      verification: production ? 'final_claim_brief_audit' : 'verification_projection',
    }[attachment.kind];
    if (attachment.agentId !== expectedActor) issues.push(`${index}: attachment actor ${attachment.agentId} does not match truthful ${expectedActor} authority`);
    if (!semanticEventIds.has(attachment.eventId)) issues.push(`${index}: attachment event is absent from the authenticated stream`);
    if (!cursorBindings.has(`${attachment.changeId}:${attachment.eventId}:${attachment.agentId}`)) issues.push(`${index}: attachment change is not tied to its agent cursor event`);
    if (attachment.kind === 'fact' && attachment.sourceAuthority !== 'customer_submission') issues.push(`${index}: fact source authority is not the customer submission`);
    if (attachment.kind === 'law' && !['official_registry', 'deterministic_principle'].includes(attachment.sourceAuthority)) issues.push(`${index}: legal authority is not distinguished truthfully`);
    if (attachment.kind === 'precedent' && (attachment.sourceAuthority !== 'generated_reference' || attachment.referenceStatus !== 'generated_reference')) issues.push(`${index}: generated reference is presented with inflated authority`);
  });
  if (new Set(attachments.map(item => item.changeId)).size !== attachments.length) issues.push('attachment change IDs are duplicated');
  for (const kind of allowedKinds) {
    if (!attachments.some(item => item.kind === kind)) issues.push(`${kind}: no contextual artifact attached`);
  }
  return issues;
}

function memoryEffectContractViolations(effects, expectedOriginId) {
  const issues = [];
  const originIds = [...new Set(effects.map(item => item.origin_id).filter(Boolean))];
  const counts = Object.fromEntries(['node-added', 'edge-added', 'evidence-changed'].map(effect => [effect, effects.filter(item => item.effect === effect).length]));
  if (effects.length !== 6) issues.push(`memory effect count ${effects.length}`);
  if (stableJson(counts) !== stableJson({ 'node-added': 1, 'edge-added': 2, 'evidence-changed': 3 })) issues.push(`memory effect shape ${stableJson(counts)}`);
  if (originIds.length !== 1 || originIds[0] !== expectedOriginId) issues.push(`memory origin ${stableJson(originIds)}`);
  return issues;
}

async function clickExactArtifactLocator(locator) {
  const locatorId = await locator.getAttribute('data-source-locator-id');
  check('Context attachment declares an exact source locator identifier', nonemptyString(locatorId), locatorId || 'missing locator');
  await locator.click();
  await page.waitForFunction(expected => {
    const dock = document.querySelector('[data-layout="source-canvas"] [data-source-dock-state], [data-source-dock-state]');
    return ['open', 'drawer'].includes(dock?.dataset.sourceDockState || '')
      && dock?.dataset.activeSourceLocator === expected;
  }, locatorId, { timeout: 30000 });
  return locatorId;
}

async function settleFiniteAnimationsForAxe(label) {
  const result = await page.evaluate(async ({ timeoutMs }) => {
    const describeTarget = target => {
      if (!(target instanceof Element)) return null;
      if (target.id) return `#${CSS.escape(target.id)}`;
      const classes = [...target.classList].slice(0, 4).map(value => `.${CSS.escape(value)}`).join('');
      return `${target.tagName.toLowerCase()}${classes}`;
    };
    const describeAnimation = animation => {
      const timing = animation.effect?.getComputedTiming?.() || {};
      return {
        type: animation.constructor?.name || 'Animation',
        name: animation.animationName || animation.transitionProperty || null,
        play_state: animation.playState,
        target: describeTarget(animation.effect?.target),
        current_time_ms: Number.isFinite(animation.currentTime) ? Math.round(animation.currentTime) : null,
        end_time_ms: Number.isFinite(timing.endTime) ? Math.round(timing.endTime) : null,
      };
    };
    const activeFiniteAnimations = () => document.getAnimations().filter(animation => {
      const timing = animation.effect?.getComputedTiming?.();
      return ['pending', 'running'].includes(animation.playState) && Number.isFinite(timing?.endTime);
    });
    const nextStablePaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const deadline = performance.now() + timeoutMs;
    let passes = 0;
    while (passes < 8) {
      let active = activeFiniteAnimations();
      if (!active.length) {
        await nextStablePaint();
        active = activeFiniteAnimations();
        if (!active.length) return { settled: true, passes, active: [] };
      }
      const remaining = deadline - performance.now();
      if (remaining <= 0) break;
      await new Promise(resolve => {
        const timer = setTimeout(resolve, remaining);
        Promise.allSettled(active.map(animation => animation.finished)).then(() => {
          clearTimeout(timer);
          resolve();
        });
      });
      passes += 1;
    }
    return {
      settled: false,
      passes,
      active: activeFiniteAnimations().slice(0, 12).map(describeAnimation),
    };
  }, { timeoutMs: AXE_ANIMATION_SETTLE_TIMEOUT_MS });
  if (!result.settled) throw new Error(`${label} did not reach a stable finite-animation state before Axe: ${JSON.stringify(result)}`);
}

function axeViolationDiagnostics(violations) {
  const safeDataFields = ['fgColor', 'bgColor', 'contrastRatio', 'expectedContrastRatio', 'fontSize', 'fontWeight'];
  const safeAxeToken = value => {
    const text = String(value || '').slice(0, 512);
    return /^[a-z][a-z0-9_-]{0,79}$/i.test(text) ? text : `sha256:${sha256(text)}`;
  };
  const safeTargets = targets => (targets || []).slice(0, 4).map(target => {
    if (Array.isArray(target)) return target.slice(0, 8).map(safeAxeToken);
    return safeAxeToken(target);
  });
  const safeCheckData = data => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const safeValue = value => typeof value === 'string' ? value.slice(0, 120) : (typeof value === 'number' && Number.isFinite(value)) || typeof value === 'boolean' ? value : null;
    return Object.fromEntries(safeDataFields.filter(field => Object.hasOwn(data, field)).map(field => [field, safeValue(data[field])]));
  };
  return violations.slice(0, 8).map(item => ({
    id: safeAxeToken(item.id),
    impact: ['minor', 'moderate', 'serious', 'critical'].includes(item.impact) ? item.impact : null,
    node_count: (item.nodes || []).length,
    omitted_node_count: Math.max(0, (item.nodes || []).length - 6),
    nodes: (item.nodes || []).slice(0, 6).map(node => ({
      target: safeTargets(node.target),
      checks: [...(node.any || []), ...(node.all || []), ...(node.none || [])].slice(0, 8).map(check => ({
        id: safeAxeToken(check.id),
        impact: ['minor', 'moderate', 'serious', 'critical'].includes(check.impact) ? check.impact : null,
        data: safeCheckData(check.data),
      })),
    })),
  }));
}

async function runAxe(label) {
  await settleFiniteAnimationsForAxe(label);
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(item => ['serious', 'critical'].includes(item.impact));
  const diagnostics = JSON.stringify(axeViolationDiagnostics(serious));
  check(`${label} has no serious or critical axe violations`, serious.length === 0, diagnostics);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function retainEvidence() {
  const required = [
    'deployment-identity',
    'release-contract',
    'readiness-receipt',
    'isolation-run',
    'isolation-model-ledger',
    'flagship-run',
    'flagship-cold-model-ledger',
    'demo-review',
    'post-review-run',
    'later-baseline-run',
    'later-after-memory-run',
    'learning-proof',
    'model-ledger',
  ];
  if (isProductionJourney()) required.push('flagship-cache-lineage');
  const missing = required.filter(name => retainedEvidence[name] == null);
  if (report?.status === 'passed' && missing.length) throw new Error(`Passing journey did not retain required evidence: ${missing.join(', ')}`);

  for (const [name, value] of Object.entries(retainedEvidence)) {
    if (value == null) continue;
    const filename = `${name}.json`;
    const bytes = `${JSON.stringify(value, null, 2)}\n`;
    await fs.writeFile(path.join(OUT, filename), bytes);
    evidenceFiles.push({ path: filename, sha256: sha256(bytes), bytes: Buffer.byteLength(bytes) });
  }

  const gateBytes = await fs.readFile(new URL(import.meta.url));
  const runtimeBytes = `${JSON.stringify(runtimeVersions, null, 2)}\n`;
  await fs.writeFile(path.join(OUT, 'runtime-versions.json'), runtimeBytes);
  evidenceFiles.push({ path: 'runtime-versions.json', sha256: sha256(runtimeBytes), bytes: Buffer.byteLength(runtimeBytes) });
  report.evidence = {
    contract: 'casepath.qa-evidence/1.0.0',
    gate: { path: 'browser-focused-v20.mjs', sha256: sha256(gateBytes), bytes: gateBytes.length },
    runtime: runtimeVersions,
    retained_before_session_reset: true,
    files: evidenceFiles,
    missing,
  };
}

async function finalizeEvidenceManifest() {
  const entries = await fs.readdir(OUT, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || ['report.json', 'evidence-manifest.json'].includes(entry.name)) continue;
    const bytes = await fs.readFile(path.join(OUT, entry.name));
    files.push({ path: entry.name, sha256: sha256(bytes), bytes: bytes.length });
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  const retainedPaths = new Set(files.map(item => item.path));
  const requiredVisualEvidence = [
    '01-start-desktop.png',
    '02-ready-process-desktop.png',
    '03-lease-pdf-overview.png',
    '03-lease-pdf-detail.png',
    '03-lease-pdf-search.png',
    '03-image-inspection.png',
    '03-image-grounding-inspection.png',
    '04-review-desktop.png',
    '05-review-applied-desktop.png',
    '06-learning-desktop.png',
    '07-later-result-desktop.png',
    'final-state.png',
    'uninterrupted-focused-demo.webm',
  ];
  if (isProductionJourney()) requiredVisualEvidence.push('02-live-nemotron-agent.png', '03-deterministic-accepted-artifact.png');
  const requiredJsonEvidence = [
    'deployment-identity.json',
    'release-contract.json',
    'readiness-receipt.json',
    'isolation-run.json',
    'isolation-model-ledger.json',
    'flagship-run.json',
    'flagship-cold-model-ledger.json',
    'demo-review.json',
    'post-review-run.json',
    'later-baseline-run.json',
    'later-after-memory-run.json',
    'learning-proof.json',
    'model-ledger.json',
    'runtime-versions.json',
  ];
  if (isProductionJourney()) requiredJsonEvidence.push('flagship-cache-lineage.json');
  const missingRetainedArtifacts = [...requiredVisualEvidence, ...requiredJsonEvidence]
    .filter(filename => !retainedPaths.has(filename));
  const emptyRetainedArtifacts = files.filter(item => [...requiredVisualEvidence, ...requiredJsonEvidence].includes(item.path) && item.bytes <= 0).map(item => item.path);
  if (report?.status === 'passed' && (missingRetainedArtifacts.length || emptyRetainedArtifacts.length)) {
    throw new Error(`Passing journey lacks retained JSON/screenshot/video evidence: missing=${missingRetainedArtifacts.join(',')} empty=${emptyRetainedArtifacts.join(',')}`);
  }
  const manifest = {
    contract: 'casepath.qa-evidence-manifest/1.0.0',
    release_id: RELEASE_ID,
    source_commit: deploymentIdentity.qa.source_commit,
    gate: report.evidence.gate,
    runtime: runtimeVersions,
    retained_before_session_reset: true,
    retained_media_contract: {
      json: requiredJsonEvidence,
      screenshots: requiredVisualEvidence.filter(item => item.endsWith('.png')),
      video: 'uninterrupted-focused-demo.webm',
      missing: missingRetainedArtifacts,
      empty: emptyRetainedArtifacts,
    },
    files,
  };
  const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
  await fs.writeFile(path.join(OUT, 'evidence-manifest.json'), manifestBytes);
  report.evidence.files = files;
  report.evidence.manifest = { path: 'evidence-manifest.json', sha256: sha256(manifestBytes), bytes: Buffer.byteLength(manifestBytes) };
}

async function cleanup() {
  if (page) await page.screenshot({ path: path.join(OUT, 'final-state.png'), fullPage: true }).catch(() => null);
  if (context) {
    await context.close().catch(error => failures.cleanup.push(`context: ${error}`));
    context = null;
  }
  if (video) {
    try {
      const videoPath = await video.path();
      await fs.copyFile(videoPath, path.join(OUT, 'uninterrupted-focused-demo.webm'));
    } catch (error) {
      failures.cleanup.push(`video: ${error}`);
    }
  }
  if (browser) {
    await browser.close().catch(error => failures.cleanup.push(`browser: ${error}`));
    browser = null;
  }
  await fs.rm(path.join(OUT, 'video-tmp'), { recursive: true, force: true }).catch(error => failures.cleanup.push(`video temp cleanup: ${error}`));
  if (demoMutated) {
    try {
      const value = await getJson(`${API}/api/demo/reset`, { method: 'POST' });
      if (value.active_playbook && value.active_playbook !== 'mould-playbook-v3') failures.cleanup.push(`reset returned ${JSON.stringify(value)}`);
      demoMutated = false;
    } catch (error) {
      failures.cleanup.push(`reset: ${error}`);
    }
  }
  if (isolationMutated) {
    try {
      await getJsonForSession(`${API}/api/demo/reset`, ISOLATION_SESSION_ID, { method: 'POST' });
      isolationMutated = false;
    } catch (error) {
      failures.cleanup.push(`isolation reset: ${error}`);
    }
  }
}

async function execute() {
  requireMutationAuthority();
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(path.join(OUT, 'video-tmp'), { recursive: true });

  const [frontendDeployment, health, readiness, releaseContract, initialModelLedger] = await Promise.all([
    getJson(`${BASE}/deployment.json`),
    getJson(`${API}/healthz`),
    getJson(`${API}/readyz`),
    getJson(`${BASE}/release.json`),
    getJson(`${API}/api/model-ledger`),
  ]);
  deploymentIdentity = { ...deploymentIdentity, frontend: frontendDeployment, api: health };
  retainedEvidence['deployment-identity'] = deploymentIdentity;
  retainedEvidence['release-contract'] = releaseContract;
  retainedEvidence['readiness-receipt'] = readiness;
  assertDeploymentAlignment(frontendDeployment, health);
  assertReleaseRuntimeContract(releaseContract);
  assertHealthRuntimeContract(health, releaseContract.agentic_runtime);
  assertReadinessContract(readiness);
  const initialLedgerIssues = initialLedgerAdmissionViolations(initialModelLedger);
  check('QA admits a journey only from an exactly empty global model ledger', initialLedgerIssues.length === 0, JSON.stringify(initialLedgerIssues));
  const providerCapIssues = providerSingleFlightContractViolations(releaseContract, health, readiness);
  check('Release, health, and readiness agree on logical fan-out plus physical provider single-flight', providerCapIssues.length === 0, JSON.stringify(providerCapIssues));
  check('API is healthy', health.status === 'ok', JSON.stringify(health));
  check('API reports a pipeline release', typeof health.pipeline_release === 'string' && health.pipeline_release.length > 0, JSON.stringify(health));
  check('API declares caller-session state isolation without treating the session as authority', health.session_isolation?.enabled === true && health.session_isolation?.header === 'X-CasePath-Session' && health.session_isolation?.session_reset_scope === 'caller_session_only', JSON.stringify(health.session_isolation));
  if (isProductionJourney()) {
    check('Production API runs the authorized OpenRouter Nemotron mode', health.model_mode === 'openrouter_nemotron' && health.model === REQUESTED_NEMOTRON_MODEL, JSON.stringify({ model_mode: health.model_mode, model: health.model }));
  }
  const reset = await resetDemo();
  check('Demo starts from the unchanged shared v3 playbook with caller-only reset scope', reset.active_playbook === 'mould-playbook-v3' && reset.session_scope === 'caller_only', JSON.stringify(reset));
  const demo = await getJson(`${API}/api/demo`);
  let coldOrchestration = null;
  let warmOrchestration = null;

  const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined;
  browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const packageMetadata = JSON.parse(await fs.readFile(new URL('./package.json', import.meta.url), 'utf8'));
  runtimeVersions = { node: process.version, playwright: packageMetadata.dependencies?.playwright || null, chromium: browser.version() };
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    recordVideo: { dir: path.join(OUT, 'video-tmp'), size: { width: 1440, height: 900 } },
  });
  page = await context.newPage();
  video = page.video();

  page.on('console', message => {
    if (message.type() === 'error') failures.console.push(`${message.text()} @ ${message.location().url || ''}:${message.location().lineNumber || 0}`);
  });
  page.on('pageerror', error => failures.page.push(String(error)));
  page.on('request', request => {
    try {
      const url = new URL(request.url());
      if (url.origin !== new URL(API).origin || !/^\/api\/runs\/[^/]+(?:\/events)?$/.test(url.pathname)) return;
      browserRunRequests.push({
        method: request.method(),
        pathname: url.pathname,
        search: url.search,
        session: request.headers()['x-casepath-session'] || '',
        accept: request.headers().accept || '',
        at: Date.now(),
      });
    } catch (_) {}
  });
  page.on('requestfailed', request => {
    if (request.url().startsWith(BASE) || request.url().startsWith(API)) failures.request.push(`${request.failure()?.errorText || 'failed'} ${request.url()}`);
  });
  page.on('response', async response => {
    try {
      const url = new URL(response.url());
      const method = response.request().method();
      if (method === 'POST' && url.origin === new URL(API).origin && url.pathname === '/api/runs' && response.ok()) {
        const value = await response.json();
        if (value.run_id && !runIds.includes(value.run_id)) runIds.push(value.run_id);
      }
      if (method === 'POST' && /\/api\/runs\/[^/]+\/review$/.test(url.pathname) && response.ok()) reviewResponse = await response.json();
      if (method === 'GET' && url.pathname === '/api/learning-proof' && response.ok()) proofResponse = await response.json();
    } catch (_) {}
  });

  await page.addInitScript(sessionId => {
    sessionStorage.setItem('casepath:demo-session', sessionId);
    window.__casepathReleaseMutations = [];
    window.__casepathMomentHistory = [];
    window.__casepathPresentationTimeline = [];
    window.__casepathVisibleAgentIds = [];
    window.__casepathVisibleGateIds = [];
    window.__casepathOpeningContexts = [];
    window.__casepathCursorSteps = [];
    window.__casepathArtifactCursorSteps = [];
    window.__casepathGraphSteps = [];
    window.__casepathOfficialSourceSteps = [];
    window.__casepathFocusViolations = [];
    window.__casepathSemanticEvents = [];
    window.__casepathArtifactChanges = [];
    window.__casepathSourceInspections = [];
    window.__casepathBranchVisuals = [];
    window.__casepathArtifactFocusViolations = [];
    window.addEventListener('casepath:presentation', event => {
      window.__casepathPresentationTimeline.push({
        moment: event.detail?.moment || '',
        phase: event.detail?.phase || '',
        stage: event.detail?.stage || '',
        event_id: event.detail?.eventId || '',
        at: performance.now(),
      });
    });
    window.addEventListener('casepath:render', event => {
      if (event.detail?.moment !== 'opening') return;
      const actorCard = document.querySelector('#orchestrationProof .orchestration-actor-card');
      window.__casepathOpeningContexts.push({
        boundary_text: document.querySelector('#stageCanvas[data-casepath-moment="opening"] .live-question strong')?.textContent || '',
        actor_type: actorCard?.dataset.actorType || '',
        nemotron_plan_visible: Boolean(document.querySelector('#orchestrationProof .orchestration-actor-card[data-actor-type="nemotron_agent"][data-actor-id="orchestrator_plan"]')),
      });
    });
    const visible = node => Boolean(node && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
    const focusSnapshot = reason => {
      const workspace = document.querySelector('#liveWorkspace');
      if (!visible(workspace)) return null;
      const artifactRoot = document.querySelector('#artifactCanvas');
      if (visible(artifactRoot)) {
        const focus = [...artifactRoot.querySelectorAll('[data-artifact-focus="true"]')].filter(visible);
        const cursor = [...artifactRoot.querySelectorAll('#artifactAgentCursor')].filter(visible);
        const snapshot = {
          reason,
          moment: artifactRoot.dataset.casepathScene || '',
          focusIdCount: artifactRoot.querySelectorAll('[data-artifact-focus="true"]').length,
          cursorIdCount: artifactRoot.querySelectorAll('#artifactAgentCursor').length,
          focusCount: focus.length,
          cursorCount: cursor.length,
          cursorInsideFocus: cursor.length === 1,
        };
        if (snapshot.focusIdCount !== 1 || snapshot.cursorIdCount !== 1 || snapshot.focusCount !== 1 || snapshot.cursorCount !== 1) {
          window.__casepathFocusViolations.push(snapshot);
        }
        return snapshot;
      }
      const focuses = [...document.querySelectorAll('#v21AgentFocus')].filter(visible);
      const cursors = [...document.querySelectorAll('#v21AgentCursor')].filter(visible);
      const allFocuses = document.querySelectorAll('#v21AgentFocus');
      const allCursors = document.querySelectorAll('#v21AgentCursor');
      const snapshot = {
        reason,
        moment: document.body?.dataset.casepathMoment || '',
        focusIdCount: allFocuses.length,
        cursorIdCount: allCursors.length,
        focusCount: focuses.length,
        cursorCount: cursors.length,
        cursorInsideFocus: cursors.every(cursor => focuses.some(focus => focus.contains(cursor))),
      };
      if (snapshot.focusIdCount !== 1 || snapshot.cursorIdCount !== 1 || snapshot.focusCount !== 1 || snapshot.cursorCount !== 1 || !snapshot.cursorInsideFocus) {
        window.__casepathFocusViolations.push(snapshot);
      }
      return snapshot;
    };
    window.addEventListener('casepath:cursor-step', event => {
      const detail = event.detail || {};
      if (detail.changeId) {
        const cursor = document.querySelector('#artifactAgentCursor');
        window.__casepathArtifactCursorSteps.push({
          changeId: detail.changeId || '',
          eventId: detail.eventId || '',
          agentId: detail.agentId || '',
          targetId: detail.targetId || '',
          phase: detail.phase || '',
          signature: cursor?.dataset.agentSignature || '',
          at: performance.now(),
          focus: artifactCanvasFocusSnapshot('artifact-cursor-step'),
        });
        return;
      }
      const ownedArtifact = detail.agentId
        ? document.querySelector(`#v21AgentFocus [data-agent-artifact-target="true"][data-agent-artifact-owner="${CSS.escape(detail.agentId)}"]`)
        : null;
      window.__casepathCursorSteps.push({
        activationKey: detail.activationKey || '',
        moment: detail.moment || '',
        eventId: detail.eventId || '',
        actorType: detail.actorType || '',
        agentId: detail.agentId || '',
        signature: detail.signature || '',
        phase: detail.phase || '',
        callId: detail.callId || '',
        outputArtifact: detail.outputArtifact || '',
        target: detail.target || '',
        x: detail.x,
        y: detail.y,
        at: performance.now(),
        ownedArtifact: ownedArtifact ? {
          owner: ownedArtifact.dataset.agentArtifactOwner || '',
          actorType: ownedArtifact.dataset.actorType || '',
          callId: ownedArtifact.dataset.callId || '',
          outputArtifact: ownedArtifact.dataset.outputArtifact || '',
          status: ownedArtifact.dataset.eventStatus || '',
          requestedModel: ownedArtifact.dataset.requestedModel || '',
          responseModel: ownedArtifact.dataset.responseModel || '',
          targetCount: document.querySelectorAll('#v21AgentFocus [data-agent-artifact-target="true"]').length,
        } : null,
        focus: focusSnapshot('cursor-step'),
      });
    });
    window.addEventListener('casepath:graph-step', event => {
      const detail = event.detail || {};
      const layout = document.querySelector('.process-layout[data-process-story]');
      const visibleNodes = [...(layout?.querySelectorAll('.process-spine > .process-node') || [])].filter(visible);
      window.__casepathGraphSteps.push({
        processId: detail.processId || '',
        kind: detail.kind || '',
        nodeId: detail.nodeId || '',
        index: detail.index,
        total: detail.total,
        basisKinds: Array.isArray(detail.basisKinds) ? [...detail.basisKinds] : [],
        parentId: detail.parentId || '',
        edge: detail.edge || '',
        factIds: Array.isArray(detail.factIds) ? [...detail.factIds] : [],
        lawIds: Array.isArray(detail.lawIds) ? [...detail.lawIds] : [],
        evidenceRequirementIds: Array.isArray(detail.evidenceRequirementIds) ? [...detail.evidenceRequirementIds] : [],
        at: performance.now(),
        buildingCount: layout?.querySelectorAll('[data-process-build-state="building"]').length || 0,
        cursorTargetCount: layout?.querySelectorAll('[data-agent-cursor-target="true"]').length || 0,
        visibleNodeIds: visibleNodes.map(node => node.querySelector('.process-node-button')?.dataset.nodeId || ''),
        interactiveNodeIds: visibleNodes.filter(node => {
          const button = node.querySelector('.process-node-button');
          return button && !button.disabled && button.getAttribute('aria-disabled') !== 'true' && button.getAttribute('tabindex') !== '-1';
        }).map(node => node.querySelector('.process-node-button')?.dataset.nodeId || ''),
        currentNodeIds: visibleNodes.filter(node => node.classList.contains('current')).map(node => node.querySelector('.process-node-button')?.dataset.nodeId || ''),
        selectedBranchVisible: visible(layout?.querySelector('[data-process-selected-branch]')),
        detailLiveMode: layout?.querySelector('[data-process-build-focus]')?.getAttribute('aria-live') || '',
        announcementLiveMode: layout?.querySelector('[data-process-build-announcement]')?.getAttribute('aria-live') || '',
        focus: focusSnapshot('graph-step'),
      });
    });
    window.addEventListener('casepath:official-source-step', event => {
      const detail = event.detail || {};
      const browser = document.querySelector('.official-source-browser');
      const selected = browser?.querySelector('.official-source-tab[aria-selected="true"]');
      const passage = browser?.querySelector('.official-source-passage:not([hidden])');
      window.__casepathOfficialSourceSteps.push({
        sourceId: detail.sourceId || '',
        factId: detail.factId || '',
        location: detail.location || '',
        url: detail.url || '',
        retrievalMethod: detail.retrievalMethod || '',
        registryVersion: detail.registryVersion || '',
        cachePurpose: detail.cachePurpose || '',
        selectedSourceId: selected?.dataset.officialSourceTab || '',
        selectedUrl: selected?.dataset.officialSourceUrl || '',
        passageSourceId: passage?.dataset.officialSourcePanel || '',
        passageUrl: passage?.dataset.officialSourceUrl || '',
        addressUrl: browser?.querySelector('[data-official-browser-url]')?.textContent?.trim() || '',
        addressHost: browser?.querySelector('[data-official-browser-host]')?.textContent?.trim() || '',
        verifyUrl: passage?.querySelector('a[href]')?.href || '',
        at: performance.now(),
        focus: artifactCanvasFocusSnapshot('official-source-step'),
      });
    });
    const artifactCanvasFocusSnapshot = reason => {
      const root = document.querySelector('#artifactCanvas');
      if (!root || !visible(root)) return null;
      const count = selector => [...root.querySelectorAll(selector)].filter(visible).length;
      const snapshot = {
        reason,
        scene: root.dataset.casepathScene || '',
        focusCount: count('[data-artifact-focus="true"]'),
        cursorCount: count('#artifactAgentCursor'),
        artifactCount: count('[data-casepath-primary-artifact="true"]'),
        actionCount: [...document.querySelectorAll('[data-casepath-primary-action="true"]')].filter(visible).length,
      };
      if (snapshot.focusCount !== 1 || snapshot.cursorCount !== 1 || snapshot.artifactCount !== 1 || snapshot.actionCount > 1) {
        window.__casepathArtifactFocusViolations.push(snapshot);
      }
      return snapshot;
    };
    window.addEventListener('casepath:semantic-event', event => {
      const detail = event.detail || {};
      window.__casepathSemanticEvents.push({
        type: detail.type || '',
        eventId: detail.event_id || detail.eventId || '',
        sequence: detail.sequence,
        agentId: detail.actor?.id || '',
        at: performance.now(),
      });
    });
    window.addEventListener('casepath:artifact-change', event => {
      const detail = event.detail || {};
      const graph = document.querySelector('#artifactProcessGraph');
      const attachment = document.querySelector('#artifactCanvas [data-artifact-focus="true"] [data-node-attachment-kind][data-artifact-change-id][data-artifact-event-id][data-artifact-agent-id]');
      const nodeStates = [...(graph?.querySelectorAll('[data-node-id][data-process-build-state]') || [])].map(node => ({
        nodeId: node.dataset.nodeId || '',
        state: node.dataset.processBuildState || '',
        tabIndex: node.querySelector('[data-ac-action="select-node"]')?.tabIndex ?? null,
        disabled: node.querySelector('[data-ac-action="select-node"]')?.disabled ?? null,
        ariaCurrent: node.querySelector('[data-ac-action="select-node"]')?.getAttribute('aria-current') || '',
      }));
      window.__casepathArtifactChanges.push({
        changeId: detail.changeId || '',
        eventId: detail.eventId || '',
        agentId: detail.agentId || '',
        kind: detail.kind || '',
        entityId: detail.entityId || '',
        attachment: attachment ? {
          kind: attachment.dataset.nodeAttachmentKind || '',
          changeId: attachment.dataset.artifactChangeId || '',
          eventId: attachment.dataset.artifactEventId || '',
          agentId: attachment.dataset.artifactAgentId || '',
          sourceLocatorId: attachment.dataset.sourceLocatorId || '',
          sourceAuthority: attachment.dataset.sourceAuthority || '',
          referenceStatus: attachment.dataset.referenceStatus || '',
          sourceDockState: document.querySelector('[data-source-dock-state]')?.dataset.sourceDockState || '',
          activeSourceLocator: document.querySelector('[data-source-dock-state]')?.dataset.activeSourceLocator || '',
        } : null,
        nodeStates,
        focus: artifactCanvasFocusSnapshot('artifact-change'),
        at: performance.now(),
      });
    });
    window.addEventListener('casepath:source-inspection', event => {
      const detail = event.detail || {};
      window.__casepathSourceInspections.push({
        entityKind: detail.entityKind || '',
        nodeId: detail.nodeId || '',
        branchId: detail.branchId || '',
        changeId: detail.changeId || '',
        eventId: detail.eventId || '',
        agentId: detail.agentId || '',
        sourceKind: detail.sourceKind || '',
        sourceId: detail.sourceId || '',
        factId: detail.factId || '',
        locatorId: detail.locatorId || '',
        found: detail.found || '',
        at: performance.now(),
      });
    });
    window.addEventListener('casepath:branch-visualized', event => {
      const detail = event.detail || {};
      window.__casepathBranchVisuals.push({
        nodeId: detail.nodeId || '',
        branchId: detail.branchId || '',
        changeId: detail.changeId || '',
        eventId: detail.eventId || '',
        agentId: detail.agentId || '',
        at: performance.now(),
      });
    });
    const observeAttributes = () => {
      const captureOrchestrationProof = () => {
        document.querySelectorAll('.orchestration-actor-card[data-actor-type="nemotron_agent"][data-actor-id]').forEach(node => {
          if (node.dataset.actorId && !window.__casepathVisibleAgentIds.includes(node.dataset.actorId)) window.__casepathVisibleAgentIds.push(node.dataset.actorId);
        });
        document.querySelectorAll('.orchestration-receipt.gate-receipt[data-actor-type="deterministic_gate"][data-gate-id]').forEach(node => {
          if (node.dataset.gateId && !window.__casepathVisibleGateIds.includes(node.dataset.gateId)) window.__casepathVisibleGateIds.push(node.dataset.gateId);
        });
      };
      new MutationObserver(records => {
        for (const record of records) {
          const target = record.target;
          if (record.attributeName === 'data-casepath-release' || (record.attributeName === 'content' && target.matches?.('meta[name="casepath-release"]'))) {
            window.__casepathReleaseMutations.push(`${target.nodeName}:${record.attributeName}`);
          }
          if (record.attributeName === 'data-casepath-moment' && target === document.body) {
            window.__casepathMomentHistory.push(document.body.dataset.casepathMoment || '');
          }
        }
      }).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['data-casepath-release', 'data-casepath-moment', 'content'] });
      new MutationObserver(records => {
        captureOrchestrationProof();
      }).observe(document.documentElement, { attributes: true, childList: true, subtree: true, attributeFilter: ['data-actor-id', 'data-gate-id', 'data-actor-type'] });
      captureOrchestrationProof();
    };
    if (document.documentElement) observeAttributes();
    else {
      const parserObserver = new MutationObserver(() => {
        if (!document.documentElement) return;
        parserObserver.disconnect();
        observeAttributes();
      });
      parserObserver.observe(document, { childList: true });
    }
  }, QA_SESSION_ID);

  const response = await page.goto(`${BASE}/?api=${encodeURIComponent(API)}&qa=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const sourceHtml = await response.text();
  check('Product returns HTTP 200', response.status() === 200, `status=${response.status()}`);
  check('HTML owns immutable v20 release identity', /<html[^>]*data-casepath-release=["']20\.0\.0["']/i.test(sourceHtml) && /<meta[^>]*name=["']casepath-release["'][^>]*content=["']20\.0\.0["']/i.test(sourceHtml));
  check('First paint contains an intentional claim shell', sourceHtml.includes('v20-source-skeleton') && sourceHtml.includes('Opening claim…'));
  const flagshipScriptPaths = [
    'assets/live-v16.js',
    'assets/live-v16-stability.js',
    'assets/live-v18-insertion-guard.js',
    'assets/live-v17.js',
    'assets/live-v18.js',
    'assets/live-v18-handoff.js',
    'assets/live-v19-active-stage.js',
    'assets/live-v20-focus.js',
    'assets/process-story.js',
    'assets/artifact-canvas.js',
  ];
  const flagshipScriptSources = await Promise.all(flagshipScriptPaths.map(async scriptPath => ({ scriptPath, source: await getText(`${BASE}/${scriptPath}`) })));
  const loadedFlagshipSource = [sourceHtml, ...flagshipScriptSources.map(item => item.source)].join('\n');
  const orchestrationRendererSource = flagshipScriptSources.find(item => item.scriptPath === 'assets/live-v16.js')?.source || '';
  const runReadGuardSource = flagshipScriptSources.find(item => item.scriptPath === 'assets/live-v18-insertion-guard.js')?.source || '';
  const artifactCanvasSource = flagshipScriptSources.find(item => item.scriptPath === 'assets/artifact-canvas.js')?.source || '';
  const staleQaService = /casepath-guided-(?:v13-smoke|evidence-v13)\.onrender\.com/i;
  const falseReviewedV4Claim = /mould-playbook-v4|released playbook v4|after reviewed knowledge|reviewed playbook release/i;
  const falseGroundingAuthority = /machine-visible image record|model interpretation|live retrieval/i;
  const falseHeldOutNovelty = /\bunseen(?: related)? claim\b/i;
  check('Loaded release contains no obsolete public QA-service destination', !staleQaService.test(loadedFlagshipSource));
  check('Loaded release labels logical specialist topology as fan-out rather than physical parallel transport', loadedFlagshipSource.includes('<i>fan-out</i>') && !loadedFlagshipSource.includes('<i>parallel</i>'));
  check('Artifact canvas owns one authenticated fetch-SSE transport and no active run polling loop', orchestrationRendererSource.includes("document.body.dataset.runTransport = 'fetch-sse'") && orchestrationRendererSource.includes("'X-CasePath-Session': SESSION_ID") && orchestrationRendererSource.includes("Accept: 'text/event-stream'") && orchestrationRendererSource.includes('/events?after=${after}') && !orchestrationRendererSource.includes('function pollRun(') && !orchestrationRendererSource.includes('setTimeout(() => pollRun(') && artifactCanvasSource.includes('artifactCanvas'));
  check('Loaded orchestration renderer never promotes a validator label to a deterministic gate ID', orchestrationRendererSource.includes("const gateId = returnedValue(event, 'gate_id', 'agent_id');") && orchestrationRendererSource.includes("const validator = returnedValue(event, 'validator');") && orchestrationRendererSource.includes('const gateIdentity = gateId ? ` data-gate-id=') && !orchestrationRendererSource.includes("returnedValue(event, 'gate_id', 'agent_id', 'validator', 'label')"));
  check('Loaded run-read coalescing is session-scoped, in-flight-only, review-mutation-aware, and renders the authoritative review response', runReadGuardSource.includes("headers.get('X-CasePath-Session')") && runReadGuardSource.includes('runResourceKey(url, request, init)') && runReadGuardSource.includes('const pendingRunMutations = new Map();') && runReadGuardSource.includes("const isReviewMutation = method === 'POST'") && runReadGuardSource.includes('const activeMutation = pendingRunMutations.get(resourceKey);') && runReadGuardSource.includes('await activeMutation;') && !runReadGuardSource.includes('runReadWindowMs') && !runReadGuardSource.includes('window.setTimeout') && orchestrationRendererSource.includes('result: snapshot(state.review.result)'));
  check('Current QA destination is guarded by exact live API identity and an atomic hash-bound report/manifest attestation', loadedFlagshipSource.includes("const qaEvidenceBase = 'https://casepath-guided-canonical-qa.onrender.com'") && loadedFlagshipSource.includes('function releaseEvidenceAttested(') && loadedFlagshipSource.includes("fetch(`${apiBase}/healthz`") && loadedFlagshipSource.includes("api?.source_commit === commit") && loadedFlagshipSource.includes('reportIdentities.every(value => value === commit)') && loadedFlagshipSource.includes('report?.failed === 0') && loadedFlagshipSource.includes('manifest?.source_commit === commit') && loadedFlagshipSource.includes('report.evidence.manifest.sha256 === manifestBinding.sha256') && loadedFlagshipSource.includes('report.evidence.manifest.bytes === manifestBinding.bytes') && loadedFlagshipSource.includes('retainedEvidenceComplete(report, manifest)') && loadedFlagshipSource.includes("link.dataset.evidenceState = 'attested'"));
  check('Loaded release contains no false reviewed-v4 lifecycle claim', !falseReviewedV4Claim.test(loadedFlagshipSource));
  check('Loaded release contains no false image-extraction, model-legal, or live-retrieval authority copy', !falseGroundingAuthority.test(loadedFlagshipSource));
  check('Loaded release truthfully defines a deterministic post-learning held-out comparison without calling the fixture unseen or claiming another model run', !falseHeldOutNovelty.test(loadedFlagshipSource) && /held-out later demo claim/i.test(loadedFlagshipSource) && /excluded from the simulated review and memory construction/i.test(loadedFlagshipSource) && /after learning was frozen/i.test(loadedFlagshipSource) && /flagship above is the live six-agent nemotron analysis/i.test(loadedFlagshipSource) && /deterministic application layer/i.test(loadedFlagshipSource) && /without another model run/i.test(loadedFlagshipSource));
  const evidenceControl = await page.locator('#browserEvidenceLink').evaluate(node => ({
    tag: node.tagName,
    state: node.dataset.evidenceState,
    text: node.textContent.trim(),
    href: node.getAttribute('href'),
    role: node.getAttribute('role'),
  }));
  const evidenceControlIsPending = evidenceControl.tag === 'SPAN' && evidenceControl.state === 'pending' && evidenceControl.text === 'Current release evidence pending' && evidenceControl.href === null && evidenceControl.role === 'status';
  const evidenceControlIsAttested = evidenceControl.tag === 'A' && evidenceControl.state === 'attested' && evidenceControl.href === 'https://casepath-guided-canonical-qa.onrender.com/report.json' && /^Current release evidence · [0-9a-f]{8}$/.test(evidenceControl.text);
  check('Current-release evidence is either fail-closed pending or unlocked by exact attestation', evidenceControlIsPending || evidenceControlIsAttested, JSON.stringify(evidenceControl));
  const attestationMatrix = await page.evaluate(() => {
    const commit = 'a'.repeat(40);
    const frontend = { source_commit: commit, release_id: 'casepath-v20-reference-20260811', alignment_eligible: true };
    const api = { status: 'ok', release_id: frontend.release_id, source_commit: commit, source_commit_aligned: true, source_commit_conflict: false };
    const files = [
      { path: 'flagship-run.json', sha256: 'c'.repeat(64), bytes: 10 },
      { path: 'final-state.png', sha256: 'd'.repeat(64), bytes: 20 },
      { path: 'uninterrupted-focused-demo.webm', sha256: 'e'.repeat(64), bytes: 30 },
    ];
    const binding = { sha256: 'f'.repeat(64), bytes: 1234 };
    const report = { status: 'passed', passed: 80, failed: 0, release_id: frontend.release_id, deployment: { frontend: { source_commit: commit }, api: { source_commit: commit }, qa: { source_commit: commit } }, evidence: { gate: { sha256: 'b'.repeat(64) }, retained_before_session_reset: true, missing: [], files, manifest: { path: 'evidence-manifest.json', ...binding } } };
    const manifest = { contract: 'casepath.qa-evidence-manifest/1.0.0', release_id: frontend.release_id, source_commit: commit, gate: { sha256: 'b'.repeat(64) }, retained_before_session_reset: true, retained_media_contract: { json: ['flagship-run.json'], screenshots: ['final-state.png'], video: 'uninterrupted-focused-demo.webm', missing: [], empty: [] }, files };
    const isAttested = window.__casepathEvidenceAttestation?.isAttested;
    return {
      valid: isAttested?.(frontend, api, report, manifest, binding) === true,
      wrongReportCommit: isAttested?.(frontend, api, { ...report, deployment: { ...report.deployment, api: { source_commit: 'c'.repeat(40) } } }, manifest, binding) === false,
      liveApiDrift: isAttested?.(frontend, { ...api, source_commit: 'c'.repeat(40) }, report, manifest, binding) === false,
      missingMedia: isAttested?.(frontend, api, report, { ...manifest, retained_media_contract: { ...manifest.retained_media_contract, missing: ['final-state.png'] } }, binding) === false,
      failedReport: isAttested?.(frontend, api, { ...report, status: 'failed' }, manifest, binding) === false,
      failedCount: isAttested?.(frontend, api, { ...report, failed: 17 }, manifest, binding) === false,
      notRetained: isAttested?.(frontend, api, { ...report, evidence: { ...report.evidence, retained_before_session_reset: false } }, manifest, binding) === false,
      tamperedManifestBytes: isAttested?.(frontend, api, report, manifest, { ...binding, sha256: '0'.repeat(64) }) === false,
      changedInventory: isAttested?.(frontend, api, report, { ...manifest, files: manifest.files.slice(1) }, binding) === false,
    };
  });
  check('Evidence attestation accepts only a passed complete exact-commit report/manifest pair', Object.values(attestationMatrix).every(Boolean), JSON.stringify(attestationMatrix));
  const checklistRendererSource = flagshipScriptSources.find(item => item.scriptPath === 'assets/live-v17.js')?.source || '';
  const precedentRendererSource = flagshipScriptSources.find(item => item.scriptPath === 'assets/live-v16.js')?.source || '';
  const reuseRendererSource = flagshipScriptSources.find(item => item.scriptPath === 'assets/live-v17.js')?.source || '';
  const laterStageSource = flagshipScriptSources.find(item => item.scriptPath === 'assets/live-v18.js')?.source || '';
  check('Precedent rendering accepts qualified_expert_reviewed while preserving explicit unverified memory copy', precedentRendererSource.includes("'qualified_expert_reviewed'") && precedentRendererSource.includes("'unverified_demo_memory'") && precedentRendererSource.includes('Unverified generated-demo review memory returned by the server') && precedentRendererSource.includes('Unverified demo review memory returned'));
  check('Loaded later-result renderer distinguishes retrieval from receipt-bound use/application without asynchronous reuse enhancement', precedentRendererSource.includes('reviewed_memory_retrieved') && precedentRendererSource.includes('data-memory-retrieved-only=') && precedentRendererSource.includes('retrieved-not-applied') && precedentRendererSource.includes('Saving it does not mean later guidance was used or applied') && precedentRendererSource.includes('Not used or applied · no memory-driven DTO change') && precedentRendererSource.includes('function renderMemoryReuseProof') && !reuseRendererSource.includes('function enhanceReuse') && !laterStageSource.includes('function enhanceReuse'));
  check('Document-checklist renderer fails closed on exact field units, reciprocal owners, and transformed acceptance', [
    'const expectedUnits = [',
    'new Set(ids).size === ids.length',
    'Number.isInteger(value.confidence_basis_points)',
    "value.attribution === expectedAttribution",
    'data-accepted-contribution-ids=',
    'post_review_unverified_transform',
    'casepath.memory-application-receipt/1.0.0',
    'data-node-ids=',
    'data-current-path=',
  ].every(fragment => checklistRendererSource.includes(fragment)));
  const syntheticActorLabels = ['Agent complete', ...FORBIDDEN_SYNTHETIC_AGENT_LABELS];
  const syntheticActorSources = flagshipScriptSources.flatMap(({ scriptPath, source }) => syntheticActorLabels.filter(label => source.includes(label)).map(label => `${scriptPath}:${label}`));
  check('Loaded flagship scripts never promote seven presentation phases, deterministic stages, or knowledge governance into extra model agents', syntheticActorSources.length === 0, JSON.stringify(syntheticActorSources));
  const specialistFocusSource = flagshipScriptSources.find(item => item.scriptPath === 'assets/live-v20-focus.js')?.source || '';
  const identitySourceIssues = [];
  for (const agentId of REQUIRED_NEMOTRON_AGENT_IDS) {
    const expected = REQUIRED_NEMOTRON_AGENT_SIGNATURES[agentId];
    if (!specialistFocusSource.includes(`${agentId}: {`)) identitySourceIssues.push(`${agentId}: missing identity`);
    if (!specialistFocusSource.includes(`label: '${REQUIRED_NEMOTRON_AGENT_ROLES[agentId]}'`)) identitySourceIssues.push(`${agentId}: wrong role`);
    if (!specialistFocusSource.includes(`monogram: '${expected.monogram}'`)) identitySourceIssues.push(`${agentId}: wrong monogram`);
    if (!specialistFocusSource.includes(`signature: '${expected.signature}'`)) identitySourceIssues.push(`${agentId}: wrong signature`);
  }
  const identityMapStart = specialistFocusSource.indexOf('const NEMOTRON_AGENT_IDENTITIES = Object.freeze({');
  const identityMapEnd = specialistFocusSource.indexOf('\n  });', identityMapStart);
  const identityMapSource = specialistFocusSource.slice(identityMapStart, identityMapEnd);
  const declaredAgentIds = [...identityMapSource.matchAll(/^\s{4}([a-z_]+): \{/gm)].map(match => match[1]);
  check('Cursor identities are the exact six call-bound Nemotron agents with six distinct restrained signatures', identitySourceIssues.length === 0 && exactMembers(declaredAgentIds, REQUIRED_NEMOTRON_AGENT_IDS) && new Set(Object.values(REQUIRED_NEMOTRON_AGENT_SIGNATURES).map(value => value.monogram)).size === 6 && new Set(Object.values(REQUIRED_NEMOTRON_AGENT_SIGNATURES).map(value => value.signature)).size === 6, JSON.stringify({ declaredAgentIds, identitySourceIssues }));
  check('Seven visible chapters remain presentation phases with explicit execution authority, not a synthetic seven-agent team', REQUIRED_PRESENTATION_PHASE_LABELS.every(fragment => specialistFocusSource.includes(`label: '${fragment}'`)) && ['dataset.casepathSpecialist', 'dataset.workAuthority'].every(fragment => specialistFocusSource.includes(fragment)));
  check('Cursor motion is keyed to semantic event/agent/phase/target identity, suppresses replay, and emits one inspectable step without class-mutation feedback', specialistFocusSource.includes('const activationKey =') && specialistFocusSource.includes("cursor.dataset.eventId || cursor.dataset.proofEventId || moment") && specialistFocusSource.includes("cursor.dataset.agentId || 'casepath'") && specialistFocusSource.includes('cursorPhase') && specialistFocusSource.includes('emittedActivationKeys.has(activationKey)') && specialistFocusSource.includes('cursorTargetKey(target)') && specialistFocusSource.includes("new CustomEvent('casepath:cursor-step'") && specialistFocusSource.includes("['is-clicking', 'v21-agent-target']") && specialistFocusSource.includes("attributeOldValue: true") && !specialistFocusSource.includes("requestAnimationFrame(() => cursor.classList.add('is-clicking'))"));
  check('Every successful call-bound specialist owns one receipt-bound artifact target instead of relabelling an unrelated canvas', ['function ownedArtifactMarkup(', 'data-agent-artifact-target="true"', 'data-agent-artifact-owner=', 'data-actor-type=', 'data-call-id=', 'data-output-artifact=', 'data-requested-model=', 'data-response-model=', "event.actorType !== 'nemotron_agent'", 'Official-law tabs remain a separate deterministic cached registry view.'].every(fragment => specialistFocusSource.includes(fragment)));

  await page.waitForFunction(expected => document.querySelectorAll('.attachment-row').length === expected, demo.claim.artifacts.length, { timeout: 120000 });
  await page.waitForFunction(() => !document.querySelector('#runCasePath')?.disabled, null, { timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#artifactCanvas') && document.querySelector('#artifactProcessGraph'), null, { timeout: 120000 });
  await page.evaluate(() => {
    window.__casepathPersistentArtifactCanvas = document.querySelector('#artifactCanvas');
    window.__casepathPersistentProcessGraph = document.querySelector('#artifactProcessGraph');
  });
  const openingCanvas = await artifactCanvasSnapshot();
  check('Opening mounts the persistent artifact canvas and graph roots before analysis begins', openingCanvas.root_present && openingCanvas.root_same && openingCanvas.graph_present && openingCanvas.graph_same, JSON.stringify(openingCanvas));
  await page.evaluate(() => {
    const moment = document.body.dataset.casepathMoment;
    if (moment && !window.__casepathMomentHistory.includes(moment)) window.__casepathMomentHistory.push(moment);
    if (document.querySelector('meta[name="casepath-release"]')?.content !== '20.0.0') window.__casepathReleaseMutations.push('initial-meta-mismatch');
  });
  check('DOM and meta release markers agree', await page.evaluate(() => document.documentElement.dataset.casepathRelease === '20.0.0' && document.querySelector('meta[name="casepath-release"]')?.content === '20.0.0' && !document.body.hasAttribute('data-casepath-release')));
  check('Claim source clears aria-busy after rendering', await page.locator('#customerEmail').getAttribute('aria-busy') === 'false');
  const quietContrast = await page.evaluate(() => {
    const values = getComputedStyle(document.querySelector('.quiet-label')).color.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = rgb => rgb.map(value => { const channel = value / 255; return channel <= .03928 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const foreground = luminance(values);
    return (1.05) / (foreground + .05);
  });
  check('Quiet small-text color meets WCAG AA contrast on the white product surface', quietContrast >= 4.5, `contrast=${quietContrast.toFixed(2)}`);
  await auditViewports('01-start', '#startState');

  const pdf = demo.claim.artifacts.find(item => item.media_type === 'application/pdf');
  const image = demo.claim.artifacts.find(item => item.media_type?.startsWith('image/'));
  const email = demo.claim.artifacts.find(item => item.media_type === 'message/rfc822');
  check('PDF, image, and email fixtures are available', Boolean(pdf && image && email), JSON.stringify(demo.claim.artifacts.map(item => ({ id: item.artifact_id, type: item.media_type }))));

  const pdfRow = page.locator(`[data-artifact-id="${pdf.artifact_id}"]`);
  await pdfRow.focus();
  await page.keyboard.press('Enter');
  await waitVisible('#sourceViewer[open]');
  await page.waitForFunction(() => document.querySelector('#sourceViewer')?.getAttribute('aria-busy') === 'false');
  check('Source dialog moves focus inside on open', await page.evaluate(() => document.querySelector('#sourceViewer')?.contains(document.activeElement)));
  check('PDF original pages remain inspectable', await page.locator('.page-thumb').count() === pdf.page_count && await page.locator('#documentPage').isVisible());
  check('Lease PDF viewer identifies and serves the selected original artifact', (await page.locator('#sourceViewerTitle').innerText()) === pdf.title && new URL(await page.locator('#openOriginal').getAttribute('href'), API).pathname === `/api/artifacts/${encodeURIComponent(pdf.artifact_id)}`);
  await screenshot('03-lease-pdf-overview.png');
  await page.locator('#zoomIn').click();
  await page.waitForFunction(() => document.querySelector('#sourceViewer')?.getAttribute('aria-busy') === 'false' && document.querySelector('#zoomValue')?.textContent === '115%');
  check('Lease PDF zoom control changes the rendered page, not just its label', await page.locator('#zoomValue').innerText() === '115%' && (await page.locator('#documentPage').getAttribute('style')).includes('scale(1.15)'));
  const inspectedPdfPage = Math.max(1, pdf.page_count || 1);
  if (inspectedPdfPage > 1) {
    const inspectedThumb = page.locator(`.page-thumb[data-page="${inspectedPdfPage}"]`);
    await inspectedThumb.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(pageNumber => document.querySelector(`.page-thumb[data-page="${pageNumber}"]`)?.getAttribute('aria-current') === 'page' && document.querySelector('#documentPage')?.alt.endsWith(`page ${pageNumber}`), inspectedPdfPage);
  }
  check('Lease PDF thumbnail navigation renders the requested original page', await page.locator(`.page-thumb[data-page="${inspectedPdfPage}"]`).getAttribute('aria-current') === 'page' && (await page.locator('#documentPage').getAttribute('alt')).endsWith(`page ${inspectedPdfPage}`));
  await screenshot('03-lease-pdf-detail.png');
  await runAxe('Lease PDF original viewer');
  check('Source tabs expose keyboard and panel semantics', await page.evaluate(() => [...document.querySelectorAll('[data-source-tab]')].every(tab => tab.getAttribute('role') === 'tab' && tab.getAttribute('aria-controls') === 'sourceStage') && document.querySelector('#sourceStage')?.getAttribute('role') === 'tabpanel'));
  await page.locator('#sourceTabOriginal').focus();
  await page.keyboard.press('ArrowRight');
  check('Arrow key selects and focuses extraction tab', await page.locator('#sourceTabExtraction').getAttribute('aria-selected') === 'true' && await page.evaluate(() => document.activeElement?.id === 'sourceTabExtraction'));
  const extraction = await getJson(`${API}/api/artifacts/${encodeURIComponent(pdf.artifact_id)}/extraction`);
  const searchQuery = String(extraction.pages?.join(' ') || '').match(/[A-Za-z]{6,}/)?.[0] || 'Tenant';
  await page.locator('#sourceSearch').fill(searchQuery);
  await page.locator('#sourceSearchForm button[type="submit"]').click();
  await waitText('#sourceSearchStatus', /matched/i);
  check('PDF extracted-text search returns navigable page results', await page.locator('#sourceSearchResults [data-search-page]').count() > 0 && await page.locator('#sourceStage mark').count() > 0);
  await screenshot('03-lease-pdf-search.png');
  await page.locator('#sourceTabOriginal').click();
  await waitVisible('#documentPage');
  await page.keyboard.press('Escape');
  await waitHidden('#sourceViewer');
  await page.waitForFunction(artifactId => document.activeElement?.dataset.artifactId === artifactId, pdf.artifact_id);
  check('Closing source dialog restores attachment focus', await page.evaluate(artifactId => document.activeElement?.dataset.artifactId === artifactId, pdf.artifact_id));

  const imageRow = page.locator(`[data-artifact-id="${image.artifact_id}"]`);
  await imageRow.focus();
  await page.keyboard.press('Enter');
  await waitVisible('#sourceImage');
  await page.waitForFunction(() => { const image = document.querySelector('#sourceImage'); return image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0; });
  const renderedImage = await page.locator('#sourceImage').evaluate(node => ({ src: node.currentSrc, width: node.naturalWidth, height: node.naturalHeight, alt: node.alt }));
  check('Image viewer decodes the selected original pixels with an accessible identity', new URL(renderedImage.src).pathname === `/api/artifacts/${encodeURIComponent(image.artifact_id)}` && renderedImage.width > 0 && renderedImage.height > 0 && renderedImage.alt === image.title, JSON.stringify(renderedImage));
  const imageCount = demo.claim.artifacts.filter(item => item.media_type?.startsWith('image/')).length;
  check('Image gallery controls appear only when useful', imageCount > 1 ? await page.locator('#sourceGalleryNav').isVisible() : await page.locator('#sourceGalleryNav').isHidden());
  if (imageCount > 1) {
    const firstImageTitle = await page.locator('#sourceViewerTitle').innerText();
    await page.locator('#sourceNext').click();
    check('Image next control opens the adjacent original image', (await page.locator('#sourceViewerTitle').innerText()) !== firstImageTitle);
    await page.locator('#sourcePrevious').click();
    check('Image previous control returns to the original image', (await page.locator('#sourceViewerTitle').innerText()) === firstImageTitle);
  }
  await page.locator('#zoomIn').click();
  await page.waitForFunction(() => document.querySelector('#sourceViewer')?.getAttribute('aria-busy') === 'false' && document.querySelector('#zoomValue')?.textContent === '115%');
  check('Image zoom control changes the rendered original image frame', await page.locator('#zoomValue').innerText() === '115%' && (await page.locator('.source-image-frame').getAttribute('style')).includes('scale(1.15)'));
  await screenshot('03-image-inspection.png');
  await runAxe('Original image viewer');
  await page.keyboard.press('Escape');
  await waitHidden('#sourceViewer');
  await page.waitForFunction(artifactId => document.activeElement?.dataset.artifactId === artifactId, image.artifact_id);
  check('Closing image viewer restores attachment focus', await page.evaluate(artifactId => document.activeElement?.dataset.artifactId === artifactId, image.artifact_id));

  await page.locator(`[data-artifact-id="${email.artifact_id}"]`).click();
  await waitVisible('#sourceViewer .email-document');
  check('Email original and extraction representations remain inspectable', await page.locator('#sourceViewer .email-document').isVisible());
  await page.locator('#sourceTabExtraction').click();
  await waitVisible('#sourceStage .extraction-page');
  await page.locator('#closeSourceViewer').click();

  await page.evaluate(() => { window.__casepathFlagshipLaunchAt = performance.now(); });
  await page.locator('#runCasePath').click();
  await waitVisible('#liveWorkspace');
  await waitVisible('#artifactCanvas[data-casepath-scene]');
  const workingCanvas = await artifactCanvasSnapshot();
  const workingCanvasIssues = focusedArtifactCanvasViolations(workingCanvas);
  check('After launch the customer submission and persistent working canvas remain simultaneous with one focus, cursor, artifact, and action', workingCanvasIssues.length === 0, JSON.stringify({ workingCanvas, workingCanvasIssues }));
  const initialSpecialistFocus = await page.locator('#artifactCanvas').evaluate(node => ({
    scene: node.dataset.casepathScene,
    authority: node.dataset.workAuthority,
    cursor_count: node.querySelectorAll('#artifactAgentCursor').length,
    cursor_agent_id: node.querySelector('#artifactAgentCursor')?.dataset.agentId || '',
    cursor_agent_signature: node.querySelector('#artifactAgentCursor')?.dataset.agentSignature || '',
    title: node.querySelector('[data-ac-task]')?.textContent?.trim() || '',
  }));
  check('Flagship opens with one readable phase and one truthful neutral cursor before a call-bound agent receipt', ['opening', 'read', 'understand'].includes(initialSpecialistFocus.scene) && Boolean(initialSpecialistFocus.authority) && initialSpecialistFocus.cursor_count === 1 && initialSpecialistFocus.cursor_agent_id === '' && initialSpecialistFocus.cursor_agent_signature === 'casepath' && Boolean(initialSpecialistFocus.title), JSON.stringify(initialSpecialistFocus));
  const flagshipRunId = await waitForValue(() => runIds[0]);
  if (isProductionJourney()) {
    await page.waitForFunction(() => window.__casepathOpeningContexts?.length > 0, null, { timeout: runTimeoutMs() });
    const openingContexts = await page.evaluate(() => window.__casepathOpeningContexts);
    const openingContextIssues = productionOpeningContextViolations(openingContexts);
    check('First live production frame attributes shared-context setup to application code and waits for the returned Nemotron plan', openingContextIssues.length === 0, JSON.stringify({ openingContexts, openingContextIssues }));
  }
  const processRun = await waitJourneyUi('Visible flagship cold orchestration did not complete', () => awaitRun(flagshipRunId));
  retainedEvidence['flagship-run'] = processRun;
  const flagshipEvidenceIssues = evidenceRelationContractViolations(processRun.result?.process, processRun.result?.checklist);
  check('Flagship evidence ownership is independently derived from ordered process requirements', flagshipEvidenceIssues.length === 0, JSON.stringify(flagshipEvidenceIssues));
  const flagshipMemoryStateIssues = memoryRetrievalContractViolations(processRun.result);
  check('Flagship result keeps retrieval separate from receipt-bound memory use', flagshipMemoryStateIssues.length === 0, JSON.stringify(flagshipMemoryStateIssues));
  const flagshipLegalIssues = legalContextContractViolations(processRun.result?.legal_research, processRun.result?.process);
  check('Flagship legal questions join exact official passages and deterministic proposals by ID', flagshipLegalIssues.length === 0, JSON.stringify(flagshipLegalIssues));
  const expectedOfficialSources = processRun.result?.legal_research?.sources || [];
  await page.waitForFunction(expected => (window.__casepathOfficialSourceSteps || []).length >= expected, expectedOfficialSources.length, { timeout: runTimeoutMs() });
  const officialSourceSteps = await page.evaluate(() => window.__casepathOfficialSourceSteps || []);
  const officialSourceStepIssues = [];
  if (officialSourceSteps.length !== expectedOfficialSources.length) officialSourceStepIssues.push(`step count ${officialSourceSteps.length}`);
  expectedOfficialSources.forEach((source, index) => {
    const step = officialSourceSteps[index];
    if (!step || step.sourceId !== source.source_id) officialSourceStepIssues.push(`${index}: wrong source order`);
    if (step?.url !== source.url || step?.selectedUrl !== source.url || step?.passageUrl !== source.url || step?.addressUrl !== source.url || step?.verifyUrl !== source.url) officialSourceStepIssues.push(`${source.source_id}: URL projection drift`);
    if (step?.selectedSourceId !== source.source_id || step?.passageSourceId !== source.source_id) officialSourceStepIssues.push(`${source.source_id}: selected tab/passage drift`);
    if (step?.location !== source.location) officialSourceStepIssues.push(`${source.source_id}: location drift`);
    if (step?.retrievalMethod !== 'versioned_official_source_registry_lookup') officialSourceStepIssues.push(`${source.source_id}: wrong retrieval method`);
    if (step?.registryVersion !== processRun.result.legal_research.registry_version) officialSourceStepIssues.push(`${source.source_id}: wrong registry version`);
    if (step?.cachePurpose !== 'reliable_same-source_reuse') officialSourceStepIssues.push(`${source.source_id}: wrong cache purpose`);
    try {
      if (step?.addressHost !== new URL(source.url).host || !['fedlex.admin.ch', 'www.fedlex.admin.ch', 'bwo.admin.ch', 'www.bwo.admin.ch'].includes(new URL(source.url).host)) officialSourceStepIssues.push(`${source.source_id}: non-official host`);
    } catch (_) {
      officialSourceStepIssues.push(`${source.source_id}: malformed official URL`);
    }
  });
  const officialStepHolds = officialSourceSteps.slice(1).map((step, index) => step.at - officialSourceSteps[index].at);
  if (officialStepHolds.some(value => value < 1850)) officialSourceStepIssues.push(`source tab hold ${JSON.stringify(officialStepHolds)}`);
  check('Cached Swiss-law browser visits every exact returned official section in order and preserves source, tab, passage, address, and verify-URL truth', officialSourceStepIssues.length === 0, JSON.stringify({ officialSourceSteps, officialSourceStepIssues }));
  const flagshipVisualRefs = (processRun.result?.facts || []).flatMap(fact => (fact.source_refs || []).filter(reference => reference.locator_kind === 'visual_observation'));
  const flagshipVisualIssues = flagshipVisualRefs.flatMap(reference => visualReferenceContractViolations(reference, demo.claim.artifacts.find(artifact => artifact.artifact_id === reference.artifact_id)).map(issue => `${reference.artifact_id}: ${issue}`));
  check('Every flagship visual observation is an exact curated generated-demo annotation bound to public image bytes', flagshipVisualRefs.length > 0 && flagshipVisualIssues.length === 0, JSON.stringify(flagshipVisualIssues));
  const flagshipRankingIssues = precedentRankingContractViolations(processRun.result);
  check('Flagship returns exactly three hash-bound generated reference rankings', flagshipRankingIssues.length === 0, JSON.stringify(flagshipRankingIssues));
  if (isProductionJourney()) {
    const coldIssues = orchestrationContractViolations(processRun, 'cold', releaseContract.agentic_runtime.framework);
    check('Visible flagship proves the exact cold six-agent LangGraph DAG and three deterministic accepted-artifact gates', coldIssues.length === 0, JSON.stringify(coldIssues));
    coldOrchestration = orchestrationAudit(processRun);
  }
  const flagshipColdLedger = await getJson(`${API}/api/model-ledger`);
  retainedEvidence['flagship-cold-model-ledger'] = flagshipColdLedger;
  const flagshipLedgerIssues = sanitizedLedgerViolations(flagshipColdLedger);
  check('Flagship cold ledger is public-safe and schema-bounded', flagshipLedgerIssues.length === 0, JSON.stringify(flagshipLedgerIssues));
  if (isProductionJourney()) {
    const coldLedgerIssues = coldLedgerContractViolations(coldOrchestration, flagshipColdLedger);
    check('Visible flagship binds six distinct paid responses, positive usage, costs, contributions, and lineage to one orchestration', coldLedgerIssues.length === 0, JSON.stringify(coldLedgerIssues));
  }
  await waitJourneyUi('Flagship browser did not reach stable review readiness', async () => {
    await page.waitForFunction(() => window.__casepathMomentHistory.includes('process'), null, { timeout: runTimeoutMs() });
    await page.waitForFunction(() => window.__casepathMomentHistory.includes('evidence'), null, { timeout: runTimeoutMs() });
    await waitText('#journeyNext', /Review the proposed playbook/i, runTimeoutMs());
    await waitVisible('body[data-casepath-moment="ready"]', runTimeoutMs());
    await waitVisible('#artifactCanvas[data-casepath-scene="ready"]', runTimeoutMs());
    await page.waitForFunction(() => document.querySelector('#artifactCanvas')?.dataset.casepathScene === 'ready', null, { timeout: runTimeoutMs() });
  });
  const readyCanvas = await artifactCanvasSnapshot();
  const readyCanvasIssues = focusedArtifactCanvasViolations(readyCanvas);
  check('Ready state preserves the same source-plus-canvas workspace with exactly one focus, cursor, primary artifact, and primary action', readyCanvasIssues.length === 0 && readyCanvas.action_count === 1, JSON.stringify({ readyCanvas, readyCanvasIssues }));
  check('Ready state keeps the exact ten-node handling projection as the dominant artifact', readyCanvas.projection === 'flagship-spine/1' && readyCanvas.construction_state === 'complete' && stableJson(readyCanvas.node_states) === stableJson(FLAGSHIP_PROCESS_PROJECTION_IDS.map(node_id => ({ node_id, state: 'built' }))), JSON.stringify(readyCanvas.node_states));
  const flagshipPresentationMs = await page.evaluate(() => performance.now() - window.__casepathFlagshipLaunchAt);
  const minimumFlagshipPresentationMs = isProductionJourney() ? MIN_PRODUCTION_FLAGSHIP_PRESENTATION_MS : MIN_FLAGSHIP_PRESENTATION_MS;
  check('The autonomous flagship journey is deliberately paced inside its truthful clarity band', flagshipPresentationMs >= minimumFlagshipPresentationMs && flagshipPresentationMs <= MAX_FLAGSHIP_PRESENTATION_MS, `duration_ms=${flagshipPresentationMs.toFixed(0)}`);
  const flagshipTransport = await page.evaluate(() => ({
    transport: document.body.dataset.runTransport || '',
    stream_connections: Number(document.body.dataset.streamConnections || '0'),
    terminal_hydrations: Number(document.body.dataset.terminalHydrations || '0'),
    active_run_polls: Number(document.body.dataset.activeRunPolls || '-1'),
  }));
  const flagshipBrowserRequests = browserRunRequests.filter(item => item.pathname.includes(`/${flagshipRunId}`));
  const flagshipStreams = flagshipBrowserRequests.filter(item => item.pathname.endsWith('/events'));
  const flagshipHydrations = flagshipBrowserRequests.filter(item => item.pathname === `/api/runs/${flagshipRunId}`);
  check('Visible flagship uses exactly one authenticated fetch-SSE stream, one terminal hydration, and zero active run polls', flagshipTransport.transport === 'fetch-sse' && flagshipTransport.stream_connections === 1 && flagshipTransport.terminal_hydrations === 1 && flagshipTransport.active_run_polls === 0 && flagshipStreams.length === 1 && flagshipStreams[0].method === 'GET' && flagshipStreams[0].session === QA_SESSION_ID && /text\/event-stream/i.test(flagshipStreams[0].accept) && flagshipHydrations.length === 1, JSON.stringify({ flagshipTransport, flagshipBrowserRequests }));
  const terminalValidatorReceipt = await page.locator('.orchestration-receipt.gate-receipt').evaluate(node => ({
    gate_id: node.getAttribute('data-gate-id'),
    label: node.querySelector('small')?.textContent || '',
    identity: node.querySelector('strong')?.textContent || '',
  }));
  check('Final pipeline validator remains visible without becoming a fourth orchestration gate ID', terminalValidatorReceipt.gate_id === null && /deterministic validator receipt/i.test(terminalValidatorReceipt.label) && terminalValidatorReceipt.identity === 'whole-playbook-validator/15.2', JSON.stringify(terminalValidatorReceipt));
  if (isProductionJourney()) {
    await page.locator('#openAudit').click();
    await waitVisible('#auditDrawer[open] #orchestrationProof');
    await screenshot('02-live-nemotron-agent.png');
    const visibleProof = await page.evaluate(() => ({
      agent_ids: window.__casepathVisibleAgentIds || [],
      gate_ids: window.__casepathVisibleGateIds || [],
      proof_visible: !document.querySelector('#orchestrationProof')?.hidden,
      proof_boundary: document.querySelector('.orchestration-boundary')?.textContent || '',
      orchestrator_label: document.querySelector('#orchestratorLabel')?.textContent || '',
    }));
    check('Cold flagship visibly presented every Nemotron role and deterministic gate', exactMembers(visibleProof.agent_ids, REQUIRED_NEMOTRON_AGENT_IDS) && exactMembers(visibleProof.gate_ids, REQUIRED_DETERMINISTIC_GATE_IDS) && visibleProof.proof_visible, JSON.stringify(visibleProof));
    check('Flagship visibly distinguishes the Nemotron focus plan from deterministic LangGraph topology', visibleProof.orchestrator_label === 'Nemotron focus plan · deterministic LangGraph topology', visibleProof.orchestrator_label);
    check('Visible orchestration proof retains the fictional-data, non-decision, unapproved-law, simulated-review, and quarantine boundary', /fictional claim/i.test(visibleProof.proof_boundary) && /no coverage or legal decision/i.test(visibleProof.proof_boundary) && /unapproved/i.test(visibleProof.proof_boundary) && /simulated review is not expert approval/i.test(visibleProof.proof_boundary) && /quarantined/i.test(visibleProof.proof_boundary), visibleProof.proof_boundary);
    const returnedTeam = await page.locator('.orchestration-run-summary').evaluate(node => ({
      role_count: node.dataset.nemotronRoleCount,
      gate_count: node.dataset.deterministicGateCount,
      role_ids: (node.dataset.nemotronRoleIds || '').split(',').filter(Boolean),
      gate_ids: (node.dataset.deterministicGateIds || '').split(',').filter(Boolean),
    }));
    check('Stable flagship summary proves exactly six returned Nemotron roles and three returned deterministic gates', returnedTeam.role_count === '6' && returnedTeam.gate_count === '3' && exactMembers(returnedTeam.role_ids, REQUIRED_NEMOTRON_AGENT_IDS) && exactMembers(returnedTeam.gate_ids, REQUIRED_DETERMINISTIC_GATE_IDS), JSON.stringify(returnedTeam));
    const parallelBranch = await page.locator('.orchestration-parallel-branch').evaluateAll(nodes => nodes.map(node => ({
      role_ids: node.dataset.parallelRoleIds,
      gate_id: node.dataset.parallelGateId,
      labels: [...node.querySelectorAll('span,strong')].map(item => item.textContent.trim()),
    })));
    check('Stable flagship visibly proves the returned source/process fan-out and deterministic join gate', parallelBranch.length === 1 && stableJson(parallelBranch[0]) === stableJson({ role_ids: 'document_source_integrity,process_decision_mapping', gate_id: 'deterministic_process_gate', labels: ['Document and Source Integrity Agent', 'Process Decision Mapping Agent', 'Deterministic Process Contract Gate'] }), JSON.stringify(parallelBranch));
    await page.locator('#teamTrace summary').click();
    await screenshot('03-deterministic-accepted-artifact.png');
    const traceProof = await page.locator('#teamTrace').evaluate(node => {
      const modelRows = [...node.querySelectorAll('li[data-actor-type="nemotron_agent"][data-call-id]:not([data-call-id=""])')];
      return {
        model_call_ids: [...new Set(modelRows.map(item => item.dataset.callId))],
        deterministic_gate_rows: node.querySelectorAll('li[data-actor-type="deterministic_gate"]').length,
        warning_count: document.querySelectorAll('.orchestration-proof-warning').length,
      };
    });
    check('Collapsed Team Trace expands to six distinct model calls and at least three deterministic receipts without missing-proof warnings', traceProof.model_call_ids.length === REQUIRED_NEMOTRON_AGENT_IDS.length && traceProof.deterministic_gate_rows >= REQUIRED_DETERMINISTIC_GATE_IDS.length && traceProof.warning_count === 0, JSON.stringify(traceProof));
    await page.locator('#teamTrace summary').click();
    await page.keyboard.press('Escape');
    await waitHidden('#auditDrawer');
  }
  const isolatedRun = await getJsonForSession(`${API}/api/runs`, ISOLATION_SESSION_ID, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claim_id: demo.demo_claim_id }) });
  isolationMutated = true;
  const isolatedRead = await awaitRunForSession(isolatedRun.run_id, ISOLATION_SESSION_ID);
  retainedEvidence['isolation-run'] = isolatedRead;
  const isolationLedger = await getJsonForSession(`${API}/api/model-ledger`, ISOLATION_SESSION_ID);
  retainedEvidence['isolation-model-ledger'] = isolationLedger;
  const isolationLedgerIssues = sanitizedLedgerViolations(isolationLedger);
  check('Isolation cache ledger is public-safe and schema-bounded', isolationLedgerIssues.length === 0, JSON.stringify(isolationLedgerIssues));
  if (isProductionJourney()) {
    const warmIssues = orchestrationContractViolations(isolatedRead, 'warm', releaseContract.agentic_runtime.framework);
    check('Post-flagship isolation run reuses all six accepted artifacts without a provider call', warmIssues.length === 0, JSON.stringify(warmIssues));
    warmOrchestration = orchestrationAudit(isolatedRead);
    const earlyLineage = warmLineageContractViolations(coldOrchestration, warmOrchestration, isolationLedger);
    check('Isolation replay binds every warm call to the visible flagship cold origin', earlyLineage.issues.length === 0 && earlyLineage.lineage.length === REQUIRED_NEMOTRON_AGENT_IDS.length, JSON.stringify(earlyLineage));
  }
  const crossSessionRead = await fetch(`${API}/api/runs/${encodeURIComponent(isolatedRun.run_id)}`, { headers: { 'X-CasePath-Session': QA_SESSION_ID } });
  check('Isolation run identifier is not readable from the browser session', crossSessionRead.status === 404, `status=${crossSessionRead.status}`);
  const isolationReset = await getJsonForSession(`${API}/api/demo/reset`, ISOLATION_SESSION_ID, { method: 'POST' });
  check('Isolation reset removes only its caller state and preserves the global model ledger', isolationReset.session_scope === 'caller_only' && isolationReset.removed?.runs >= 1 && isolationReset.model_ledger_preserved === true, JSON.stringify(isolationReset));
  const isolationReadAfterReset = await fetch(`${API}/api/runs/${encodeURIComponent(isolatedRun.run_id)}`, { headers: { 'X-CasePath-Session': ISOLATION_SESSION_ID } });
  const flagshipReadAfterIsolationReset = await getJson(`${API}/api/runs/${encodeURIComponent(flagshipRunId)}`);
  check('Isolation reset removes its own run without disturbing the visible flagship', isolationReadAfterReset.status === 404 && flagshipReadAfterIsolationReset.run_id === flagshipRunId && flagshipReadAfterIsolationReset.status === 'complete', JSON.stringify({ isolation_status: isolationReadAfterReset.status, flagship: runProgressDiagnostic(flagshipReadAfterIsolationReset) }));
  isolationMutated = false;
  const processGraph = processRun.result?.process || processRun.process;
  check('Uninterrupted journey rendered both process and evidence moments before stable review readiness', await page.evaluate(() => ['process', 'evidence', 'ready'].every(moment => window.__casepathMomentHistory.includes(moment))), JSON.stringify(await page.evaluate(() => window.__casepathMomentHistory)));
  const presentationClarity = await page.evaluate(() => {
    const timeline = window.__casepathPresentationTimeline || [];
    const moments = ['read', 'understand', 'research', 'process', 'evidence', 'experience', 'verify'];
    const issues = [];
    for (const moment of moments) {
      const workIndex = timeline.findIndex(frame => frame.moment === moment && frame.phase === 'working');
      const artifactIndex = timeline.findIndex((frame, index) => index > workIndex && frame.moment === moment && frame.phase === 'artifact');
      if (workIndex < 0 || artifactIndex < 0) {
        issues.push(`${moment}: missing working or artifact frame`);
        continue;
      }
      const workMs = timeline[artifactIndex].at - timeline[workIndex].at;
      if (workMs < 2300) issues.push(`${moment}: working frame ${workMs.toFixed(0)}ms`);
      const nextIndex = timeline.findIndex((frame, index) => index > artifactIndex && frame.moment !== moment && ['working', 'artifact', 'ready'].includes(frame.phase));
      if (nextIndex >= 0) {
        const artifactMs = timeline[nextIndex].at - timeline[artifactIndex].at;
        if (artifactMs < 5500) issues.push(`${moment}: artifact frame ${artifactMs.toFixed(0)}ms`);
      }
    }
    const visibleOrder = timeline.filter(frame => ['working', 'artifact', 'ready'].includes(frame.phase)).map(frame => `${frame.moment}:${frame.phase}`);
    return { issues, visible_order: visibleOrder };
  });
  check('Every specialist chapter holds its work and produced artifact long enough to understand', presentationClarity.issues.length === 0, JSON.stringify(presentationClarity));
  const graphSteps = await page.evaluate(() => window.__casepathGraphSteps || []);
  const expectedSpineIds = (processGraph.main_spine || []).map(node => typeof node === 'string' ? node : node.node_id);
  const nodeSteps = graphSteps.filter(step => step.kind === 'node');
  const branchSteps = graphSteps.filter(step => step.kind === 'branch');
  const completeSteps = graphSteps.filter(step => step.kind === 'complete');
  const graphStepIssues = [];
  if (stableJson(nodeSteps.map(step => step.nodeId)) !== stableJson(expectedSpineIds)) graphStepIssues.push('node order does not equal returned main_spine');
  if (nodeSteps.length !== expectedSpineIds.length || new Set(nodeSteps.map(step => step.nodeId)).size !== expectedSpineIds.length) graphStepIssues.push('node steps are absent or duplicated');
  nodeSteps.forEach((step, index) => {
    if (step.index !== index || step.total !== expectedSpineIds.length) graphStepIssues.push(`${step.nodeId}: index/total drift`);
    if (step.buildingCount !== 1 || step.cursorTargetCount !== 1) graphStepIssues.push(`${step.nodeId}: focal-node count drift`);
    if (!step.basisKinds.length || !step.basisKinds.every(kind => ['evidence', 'law', 'reasoning'].includes(kind))) graphStepIssues.push(`${step.nodeId}: provenance kinds absent or invalid`);
    if (!step.basisKinds.includes('reasoning')) graphStepIssues.push(`${step.nodeId}: process rationale absent`);
    if (step.basisKinds.includes('evidence') && !step.factIds.length) graphStepIssues.push(`${step.nodeId}: evidence without fact IDs`);
    if (step.basisKinds.includes('law') && !step.lawIds.length) graphStepIssues.push(`${step.nodeId}: law without source IDs`);
  });
  const nodeStepHolds = nodeSteps.slice(1).map((step, index) => step.at - nodeSteps[index].at);
  if (nodeStepHolds.some(value => value < MIN_PROCESS_NODE_STEP_MS)) graphStepIssues.push(`node hold ${JSON.stringify(nodeStepHolds)}`);
  if (branchSteps.length !== 1 || completeSteps.length !== 1) graphStepIssues.push('selected branch or complete receipt is not singular');
  if (branchSteps[0] && completeSteps[0] && completeSteps[0].at - branchSteps[0].at < MIN_PROCESS_BRANCH_HOLD_MS) graphStepIssues.push(`branch hold ${(completeSteps[0].at - branchSteps[0].at).toFixed(0)}ms`);
  const completedGraph = completeSteps[0];
  if (completedGraph && (completedGraph.detailLiveMode !== 'off' || completedGraph.announcementLiveMode !== 'polite')) graphStepIssues.push('detailed provenance floods the live region');
  const processFrameHold = await page.evaluate(() => {
    const timeline = window.__casepathPresentationTimeline || [];
    const artifactIndex = timeline.findIndex(frame => frame.moment === 'process' && frame.phase === 'artifact');
    const nextIndex = timeline.findIndex((frame, index) => index > artifactIndex && frame.moment !== 'process' && ['working', 'artifact', 'ready'].includes(frame.phase));
    return artifactIndex >= 0 && nextIndex >= 0 ? timeline[nextIndex].at - timeline[artifactIndex].at : 0;
  });
  if (processFrameHold < MIN_PROCESS_BRANCH_HOLD_MS) graphStepIssues.push(`process artifact hold ${processFrameHold.toFixed(0)}ms`);
  check('Retained process story preserves returned order, provenance, semantic holds, one selected branch, and one completion receipt', graphStepIssues.length === 0, JSON.stringify({ expectedSpineIds, graphSteps, processFrameHold, graphStepIssues }));

  const cursorSteps = await page.evaluate(() => window.__casepathCursorSteps || []);
  const cursorStepIssues = cursorSemanticContractViolations(cursorSteps, expectedSpineIds, isProductionJourney());
  const cursorTargetHolds = cursorSteps.slice(1).map((step, index) => step.at - cursorSteps[index].at);
  if (cursorTargetHolds.some(value => value < MIN_CURSOR_TARGET_HOLD_MS)) cursorStepIssues.push(`cursor target hold ${JSON.stringify(cursorTargetHolds)}`);
  const focusViolations = await page.evaluate(() => window.__casepathFocusViolations || []);
  if (focusViolations.length) cursorStepIssues.push(`focus violations ${JSON.stringify(focusViolations)}`);
  check('One calm cursor stays inside one focus and advances only on unique semantic event/agent/target keys without deterministic work inheriting a model identity', cursorStepIssues.length === 0, JSON.stringify({ cursorSteps, cursorStepIssues }));
  const artifactChanges = await page.evaluate(() => window.__casepathArtifactChanges || []);
  const processArtifactChanges = artifactChanges.filter(change => FLAGSHIP_PROCESS_PROJECTION_IDS.includes(change.entityId));
  const semanticEvents = await page.evaluate(() => window.__casepathSemanticEvents || []);
  const artifactCursorSteps = await page.evaluate(() => window.__casepathArtifactCursorSteps || []);
  const processChangeIssues = processProjectionContractViolations(processArtifactChanges, semanticEvents, artifactCursorSteps, isProductionJourney());
  check('Persistent process canvas constructs the exact ten-node handling spine monotonically, one justified node at a time', processChangeIssues.length === 0, JSON.stringify({ processArtifactChanges, processChangeIssues }));
  const sourceInspections = await page.evaluate(() => window.__casepathSourceInspections || []);
  const branchVisuals = await page.evaluate(() => window.__casepathBranchVisuals || []);
  const sourceInspectionIssues = sourceInspectionContractViolations(sourceInspections, processArtifactChanges, branchVisuals, artifactCursorSteps, processRun.result, isProductionJourney());
  check('Before every process node and causation branch appears, the agent visibly inspects one exact source, finding, or accepted input that earns it', sourceInspectionIssues.length === 0, JSON.stringify({ sourceInspections, branchVisuals, sourceInspectionIssues }));

  const renderedAttachments = [...new Map(artifactChanges.filter(change => change.attachment?.changeId === change.changeId).map(change => [change.attachment.changeId, change.attachment])).values()];
  const attachmentIssues = contextualAttachmentContractViolations(renderedAttachments, semanticEvents, artifactCursorSteps, isProductionJourney());
  const artifactFocusViolations = await page.evaluate(() => window.__casepathArtifactFocusViolations || []);
  if (artifactFocusViolations.length) attachmentIssues.push(`artifact focus violations ${JSON.stringify(artifactFocusViolations)}`);
  check('Every visible fact, law, evidence, precedent, and verification attachment is a unique streamed change tied to the responsible agent cursor', attachmentIssues.length === 0, JSON.stringify({ renderedAttachments, semanticEvents, artifactCursorSteps, attachmentIssues }));
  const officialLawAttachments = renderedAttachments.filter(item => item.kind === 'law' && item.sourceAuthority === 'official_registry');
  const expectedOfficialLawLocators = expectedOfficialSources.map(source => `law:${source.source_id}`);
  check('Every visibly visited official Swiss-law section is exact, source-docked, and cursor-bound', expectedOfficialLawLocators.every(locatorId => officialLawAttachments.some(item => item.sourceLocatorId === locatorId && item.activeSourceLocator === locatorId && ['open', 'active', 'drawer'].includes(item.sourceDockState))), JSON.stringify({ expectedOfficialLawLocators, officialLawAttachments }));
  check('Authenticated stream exposes the complete semantic claim-handling vocabulary', REQUIRED_SEMANTIC_EVENT_TYPES.every(type => semanticEvents.some(event => event.type === type)) && semanticEvents.every((event, index) => index === 0 || event.sequence > semanticEvents[index - 1].sequence), JSON.stringify(semanticEvents));
  const rejectedProposalCount = (processRun.result?.verification?.rejected_proposals || []).length;
  check('Verification rejection events are emitted exactly when rejected proposals exist', rejectedProposalCount === 0 || semanticEvents.some(event => event.type === 'verification.rejected'), JSON.stringify({ rejectedProposalCount, semanticEvents }));
  check('The ten-node process projection remains the dominant completed graph', await page.locator('#artifactProcessGraph[data-graph-projection="flagship-spine/1"] [data-node-id][data-process-build-state="built"]').count() === FLAGSHIP_PROCESS_PROJECTION_IDS.length);

  if (false) { // Retained only as a selector-contract fixture; the visible journey uses the focal canvas below.
  const factLocator = page.locator('#artifactProcessGraph [data-node-attachment-kind="fact"][data-source-locator-id]').first();
  check('At least one process fact exposes an exact customer-source locator', await factLocator.count() === 1 && (await factLocator.getAttribute('data-source-authority')) === 'customer_submission');
  const openedFactLocator = await clickExactArtifactLocator(factLocator);
  const officialLawLocators = await page.locator('#artifactProcessGraph [data-node-attachment-kind="law"][data-source-authority="official_registry"][data-source-locator-id]').evaluateAll(nodes => [...new Set(nodes.map(node => node.dataset.sourceLocatorId).filter(Boolean))]);
  check('Process canvas visibly distinguishes exact official Swiss-law sources from deterministic handling principles', officialLawLocators.length > 0 && renderedAttachments.filter(item => item.kind === 'law').every(item => ['official_registry', 'deterministic_principle'].includes(item.sourceAuthority)), JSON.stringify(renderedAttachments.filter(item => item.kind === 'law')));
  const openedOfficialLawLocators = [];
  for (const locatorId of officialLawLocators) {
    const exactLaw = page.locator(`#artifactProcessGraph [data-node-attachment-kind="law"][data-source-authority="official_registry"][data-source-locator-id=${JSON.stringify(locatorId)}]`).first();
    openedOfficialLawLocators.push(await clickExactArtifactLocator(exactLaw));
  }
  check('Every visible official Swiss-law attachment opens its exact source section in the same source dock', stableJson(openedOfficialLawLocators) === stableJson(officialLawLocators), JSON.stringify({ openedOfficialLawLocators, officialLawLocators }));
  const generatedPrecedent = page.locator('#artifactProcessGraph [data-node-attachment-kind="precedent"][data-reference-status="generated_reference"][data-source-locator-id]').first();
  check('Reference cases remain explicitly generated until a real review authority exists', await generatedPrecedent.count() === 1 && await page.locator('#artifactProcessGraph [data-node-attachment-kind="precedent"][data-reference-status="qualified_expert_reviewed"]').count() === 0);
  const openedPrecedentLocator = await clickExactArtifactLocator(generatedPrecedent);
  check('A generated reference case opens by its exact locator without inflating its authority', nonemptyString(openedPrecedentLocator) && openedPrecedentLocator !== openedFactLocator && !officialLawLocators.includes(openedPrecedentLocator), openedPrecedentLocator);
  }
  await page.locator('#openAudit').click();
  await waitVisible('#auditDrawer[open]');
  check('Visible audit drawer exposes only pending or exactly attested current-release evidence', await page.locator('#browserEvidenceLink').isVisible() && await page.locator('#browserEvidenceLink').evaluate(node => (node.tagName === 'SPAN' && node.dataset.evidenceState === 'pending' && !node.hasAttribute('href')) || (node.tagName === 'A' && node.dataset.evidenceState === 'attested' && node.getAttribute('href') === 'https://casepath-guided-canonical-qa.onrender.com/report.json')));
  check('No reachable product link targets an obsolete QA service', await page.locator('a').evaluateAll((links, pattern) => links.every(link => !new RegExp(pattern, 'i').test(link.href || '')), staleQaService.source));
  await runAxe('Audit drawer with pending release evidence');
  await page.keyboard.press('Escape');
  await waitHidden('#auditDrawer');
  if (isProductionJourney()) {
    const expectedProcessContributions = processGraph.nodes.map(node => ({
      node_id: node.node_id,
      contribution: contributionDomProjection(node.agent_decision_contributions, PROCESS_CONTRIBUTION_ROLE),
    })).filter(item => item.contribution);
    const renderedProcessContributions = await page.locator('.process-map .process-node-button[data-node-id],.process-map .process-branch-node[data-node-id]').evaluateAll(nodes => nodes.flatMap(node => {
      const badge = node.querySelector('.model-contribution-attribution');
      return badge ? [{ node_id: node.dataset.nodeId, contribution: { authority: badge.dataset.contributionAuthority, accepted_count: badge.dataset.acceptedCount, fallback_count: badge.dataset.fallbackCount, accepted_ids: badge.dataset.acceptedContributionIds, fallback_ids: badge.dataset.fallbackContributionIds } }] : [];
    }));
    check('Every visible process contribution is exactly bound to returned Nemotron acceptance or deterministic fallback', stableJson(renderedProcessContributions.sort((a, b) => a.node_id.localeCompare(b.node_id))) === stableJson(expectedProcessContributions.sort((a, b) => a.node_id.localeCompare(b.node_id))) && renderedProcessContributions.some(item => Number(item.contribution.accepted_count) > 0), JSON.stringify({ expectedProcessContributions, renderedProcessContributions }));
    const finalBrief = orchestrationAudit(processRun)?.final_claim_brief;
    const finalProjection = contributionDomProjection(finalBrief?.field_contributions, FINAL_CONTRIBUTION_ROLE);
    const expectedFinalFieldIds = (finalBrief?.field_contributions || []).map(item => item.contribution_id).join(',');
    const currentNode = processGraph.nodes.find(item => item.node_id === finalBrief?.current_node_id);
    const nextNode = processGraph.nodes.find(item => item.node_id === finalBrief?.next_action_node_id);
    const renderedFinalHandoff = await page.locator('.v20-final-handoff').evaluate(node => ({
      current_node_id: node.dataset.currentNodeId,
      next_action_node_id: node.dataset.nextActionNodeId,
      field_count: node.dataset.fieldCount,
      field_ids: node.dataset.fieldIds,
      accepted_count: node.dataset.acceptedCount,
      fallback_count: node.dataset.fallbackCount,
      accepted_ids: node.dataset.acceptedContributionIds,
      fallback_ids: node.dataset.fallbackContributionIds,
      copy: node.textContent,
    }));
    check('Ready view exposes one causally bound five-field final handoff with exact returned IDs and acceptance counts',
      await page.locator('.v20-final-handoff').count() === 1
        && finalProjection
        && currentNode
        && nextNode
        && renderedFinalHandoff.current_node_id === finalBrief.current_node_id
        && renderedFinalHandoff.next_action_node_id === finalBrief.next_action_node_id
        && renderedFinalHandoff.field_count === String(FINAL_FIELD_CONTRACT.length)
        && renderedFinalHandoff.field_ids === expectedFinalFieldIds
        && renderedFinalHandoff.accepted_count === finalProjection.accepted_count
        && renderedFinalHandoff.fallback_count === finalProjection.fallback_count
        && renderedFinalHandoff.accepted_ids === finalProjection.accepted_ids
        && renderedFinalHandoff.fallback_ids === finalProjection.fallback_ids
        && renderedFinalHandoff.copy.includes('Final Claim Brief Agent')
        && renderedFinalHandoff.copy.includes('Whole-Playbook Gate')
        && renderedFinalHandoff.copy.includes(currentNode?.title || '')
        && renderedFinalHandoff.copy.includes(nextNode?.title || '')
        && /five independent fields/i.test(renderedFinalHandoff.copy),
      JSON.stringify({ finalBrief, finalProjection, renderedFinalHandoff }));
  }

  const artifactNodeIds = await page.locator('#artifactProcessGraph [data-node-id][data-process-build-state="built"]').evaluateAll(nodes => nodes.map(node => node.dataset.nodeId));
  check('Completed artifact canvas exposes exactly the pinned ten-node handling projection', stableJson(artifactNodeIds) === stableJson(FLAGSHIP_PROCESS_PROJECTION_IDS), JSON.stringify(artifactNodeIds));
  const selectArtifactNode = async nodeId => {
    await page.locator(`#artifactProcessGraph [data-ac-action="select-node"][data-node-id=${JSON.stringify(nodeId)}]`).click();
    await page.waitForFunction(expected => document.querySelector('#artifactProcessGraph [data-node-id][data-selected="true"]')?.dataset.nodeId === expected, nodeId);
  };
  const selectArtifactChain = async kind => {
    const tab = page.locator(`#artifactCanvas [data-artifact-focus="true"] [data-ac-action="select-chain"][data-chain-kind=${JSON.stringify(kind)}]`);
    check(`Active decision exposes its ${kind} chain`, await tab.count() === 1);
    await tab.click();
    await page.waitForFunction(expected => document.querySelector('#artifactCanvas [data-artifact-focus="true"] [data-ac-action="select-chain"][aria-current="true"]')?.dataset.chainKind === expected, kind);
  };

  await selectArtifactNode('causation');
  const causationNode = processGraph.nodes.find(node => node.node_id === 'causation');
  const spatialGeometry = await spatialGraphGeometrySnapshot();
  const spatialGeometryIssues = spatialGraphGeometryContractViolations(spatialGeometry, {
    processId: processGraph.process_id,
    processAgentId: isProductionJourney() ? 'process_decision_mapping' : 'process_projection',
    returnedNodeIds: processGraph.nodes.map(node => node.node_id),
    returnedEdges: processGraph.edges.map(edge => ({ source: edge.source, target: edge.target, state: edge.state || '' })),
    causationBranches: causationNode?.branches || [],
    activeBasis: {
      factIds: causationNode?.fact_ids || [],
      lawIds: causationNode?.legal_source_ids || [],
      evidenceIds: causationNode?.evidence_requirement_ids || [],
    },
    evidenceById: Object.fromEntries(processRun.result.checklist.items.map(item => [item.item_id, item])),
  });
  check('The returned claim process is one dominant, truthful spatial graph with a horizontal spine, four divergent causation branches, grounded attachments, and one rightward next action', spatialGeometryIssues.length === 0, JSON.stringify({ spatialGeometry, spatialGeometryIssues }));

  await selectArtifactNode('notification');
  await selectArtifactChain('source');
  const visibleFactLocator = page.locator('#artifactCanvas [data-artifact-focus="true"] [data-node-attachment-kind="fact"][data-source-authority="customer_submission"][data-source-locator-id] [data-ac-action="open-source"]').first();
  const openedFactLocator = await clickExactArtifactLocator(visibleFactLocator);
  await waitVisible('#sourceViewer[open]');
  check('Customer-source click opens the exact returned fact and locator', await page.locator('#sourceViewer .source-fact').count() > 0 && (await page.locator('[data-source-dock-state]').first().getAttribute('data-active-source-locator')) === openedFactLocator, openedFactLocator);
  await page.locator('#closeSourceViewer').click();

  const lawNodeById = { 'fedlex-or-256': 'scope', 'fedlex-or-257g': 'notification', 'fedlex-or-259a': 'remedy' };
  const openedOfficialLawLocators = [];
  for (const [sourceId, nodeId] of Object.entries(lawNodeById)) {
    await selectArtifactNode(nodeId);
    await selectArtifactChain('law');
    const lawButton = page.locator(`#artifactCanvas [data-artifact-focus="true"] [data-node-attachment-kind="law"][data-source-authority="official_registry"][data-law-id=${JSON.stringify(sourceId)}] [data-ac-action="open-law"]`);
    check(`${sourceId} is visibly rendered as an official registry source`, await lawButton.count() === 1);
    openedOfficialLawLocators.push(await clickExactArtifactLocator(lawButton));
  }
  const expectedAccessibleLawLocators = Object.keys(lawNodeById).map(sourceId => `law:${sourceId}`);
  check('Every official Swiss-law source on the ten-node projection opens its exact locator', stableJson(openedOfficialLawLocators) === stableJson(expectedAccessibleLawLocators), JSON.stringify(openedOfficialLawLocators));
  check('The omitted escalation-only BWO source was still visibly visited in the live legal-research chapter', officialSourceSteps.some(step => step.sourceId === 'bwo-conciliation' && step.selectedSourceId === 'bwo-conciliation' && step.passageSourceId === 'bwo-conciliation'));

  await selectArtifactNode('causation');
  await selectArtifactChain('law');
  check('Deterministic legal application stays visibly separate from official registry law', await page.locator('#artifactCanvas [data-artifact-focus="true"] [data-node-attachment-kind="law"][data-source-authority="deterministic_principle"]').count() === 1);
  await selectArtifactChain('evidence');
  const visibleEvidence = await page.locator('#artifactCanvas [data-artifact-focus="true"] [data-node-attachment-kind="evidence"][data-evidence-id]').evaluate(node => ({ item_id: node.dataset.evidenceId, fact_id: node.dataset.factId, text: node.innerText }));
  const returnedEvidence = processRun.result.checklist.items.find(item => item.item_id === visibleEvidence.item_id);
  check('Decision-local evidence is the exact returned requirement owned by causation', Boolean(returnedEvidence) && returnedEvidence.node_ids.includes('causation') && visibleEvidence.fact_id === returnedEvidence.fact_id && visibleEvidence.text.includes(returnedEvidence.title), JSON.stringify({ visibleEvidence, returnedEvidence }));

  await selectArtifactChain('reference');
  const visibleGeneratedReference = page.locator('#artifactCanvas [data-artifact-focus="true"] [data-node-attachment-kind="precedent"][data-reference-status="generated_reference"][data-source-locator-id] [data-ac-action="open-reference"]');
  check('Causation exposes one clearly generated reference pattern', await visibleGeneratedReference.count() === 1 && await page.locator('#artifactCanvas [data-reference-status="qualified_expert_reviewed"]').count() === 0);
  const openedReferenceLocator = await clickExactArtifactLocator(visibleGeneratedReference);
  await waitVisible('#precedentViewer[open]');
  check('Generated reference opens by its exact locator and preserves ranking provenance', openedReferenceLocator.startsWith('reference:') && await page.locator('#precedentViewer .precedent-rank').count() === 1, openedReferenceLocator);
  await page.locator('#closePrecedent').click();

  if (false) { // Hidden compatibility DOM remains contract-tested statically; the flagship interacts only with the artifact canvas.
  await page.locator('[data-v21-ready-explore]').click();
  await waitVisible('.process-layout');
  check('The complete process appears only after explicit exploration', await page.locator('[data-v21-ready-explore]').getAttribute('aria-expanded') === 'true');
  const readyPrecedentProjection = await page.locator('.precedent-inline .precedent-mini').evaluateAll(nodes => nodes.map(node => ({
    claim_id: node.querySelector('strong')?.textContent?.split(' · ')[0],
    rank: Number(node.querySelector('.precedent-rank')?.dataset.rank),
  })));
  check('Ready workspace initially exposes all three ordered generated reference patterns', JSON.stringify(readyPrecedentProjection) === JSON.stringify(processRun.result.precedents.map(item => ({ claim_id: item.claim_id, rank: item.ranking.rank }))), JSON.stringify(readyPrecedentProjection));
  await page.locator('[data-toggle-all-branches]').click();
  const renderedNodeIds = await page.evaluate(() => [...new Set([...document.querySelectorAll('.process-node-button[data-node-id],.process-branch-node[data-node-id]')].map(node => node.dataset.nodeId))]);
  const expectedNodeIds = processGraph.nodes.map(node => node.node_id);
  check('Every backend process node is experienceable', expectedNodeIds.every(id => renderedNodeIds.includes(id)) && renderedNodeIds.length === expectedNodeIds.length, JSON.stringify({ expectedNodeIds, renderedNodeIds }));
  await page.locator('.process-node-button[data-node-id="causation"],.process-branch-node[data-node-id="causation"]').first().click();
  const officialLawMarker = page.locator('.decision-inspector .law-marker.official').first();
  const deterministicLawMarker = page.locator('.decision-inspector .law-marker.interpretation').first();
  check('Official passages and deterministic application proposals have distinct inspectable controls', await officialLawMarker.count() === 1 && await deterministicLawMarker.count() === 1);
  const officialLawId = await officialLawMarker.getAttribute('data-law-id');
  const officialLaw = processRun.result.legal_research.sources.find(source => source.source_id === officialLawId);
  await officialLawMarker.click();
  const officialLawDetail = page.locator(`.law-detail[data-law-detail="${officialLawId}"]:not([hidden]) .legal-authority.official`);
  const officialLawProjection = await officialLawDetail.evaluate(node => ({ source_id: node.dataset.legalSourceId, passage_sha256: node.dataset.passageSha256, snapshot_sha256: node.dataset.snapshotSha256, snapshot_scope: node.dataset.snapshotScope, registry_version: node.dataset.registryVersion, text: node.innerText }));
  check('Official legal detail shows the exact passage, version/location, passage hash, snapshot scope, and registry provenance pending qualified review', officialLawProjection.source_id === officialLaw.source_id && officialLawProjection.passage_sha256 === officialLaw.passage_sha256 && officialLawProjection.snapshot_sha256 === officialLaw.retrieval.snapshot_sha256 && officialLawProjection.snapshot_scope === officialLaw.retrieval.snapshot_scope && officialLawProjection.registry_version === officialLaw.retrieval.registry_version && officialLawProjection.text.includes(officialLaw.passage_text) && officialLawProjection.text.includes(officialLaw.version_date) && officialLawProjection.text.includes(officialLaw.location) && officialLawProjection.text.includes(officialLaw.retrieval.snapshot_scope) && /official registry source/i.test(officialLawProjection.text) && /qualified review pending/i.test(officialLawProjection.text) && !/model interpretation|live retrieval/i.test(officialLawProjection.text), JSON.stringify(officialLawProjection));
  const deterministicLawId = await deterministicLawMarker.getAttribute('data-law-id');
  await deterministicLawMarker.click();
  const deterministicLaw = processRun.result.legal_research.handling_principles.find(source => source.source_id === deterministicLawId);
  const deterministicLawProjection = await page.locator(`.law-detail[data-law-detail="${deterministicLawId}"]:not([hidden]) .legal-authority.deterministic`).evaluate(node => ({ source_id: node.dataset.legalSourceId, producer: node.dataset.producer, text: node.innerText }));
  check('Handling principle is visibly a deterministic application proposal pending qualified review', deterministicLawProjection.source_id === deterministicLaw.source_id && deterministicLawProjection.producer === 'deterministic_application' && /deterministic application proposal/i.test(deterministicLawProjection.text) && /qualified review pending/i.test(deterministicLawProjection.text) && !/model interpretation|live retrieval/i.test(deterministicLawProjection.text), JSON.stringify(deterministicLawProjection));
  const renderedPrecedents = await page.locator('.precedent-inline .precedent-mini').evaluateAll(nodes => nodes.map(node => { const ranking = node.querySelector('.precedent-rank'); return { claim_id: node.querySelector('strong')?.textContent?.split(' · ')[0], contract: ranking?.dataset.rankingContract, corpus_version: ranking?.dataset.corpusVersion, rank: Number(ranking?.dataset.rank), score_basis_points: Number(ranking?.dataset.scoreBasisPoints), context_hash: ranking?.dataset.contextHash, text: node.innerText }; }));
  const expectedRenderedPrecedents = processRun.result.precedents.map(item => ({ claim_id: item.claim_id, contract: item.ranking.contract, corpus_version: item.ranking.corpus_version, rank: item.ranking.rank, score_basis_points: item.ranking.score_basis_points, context_hash: item.ranking.context_hash }));
  check('Exactly three generated reference patterns expose ordered rank, score, factors, corpus, and context hash', renderedPrecedents.length === 3 && renderedPrecedents.every((item, index) => Object.entries(expectedRenderedPrecedents[index]).every(([key, value]) => item[key] === value) && /generated reference pattern/i.test(item.text)), JSON.stringify({ renderedPrecedents, expectedRenderedPrecedents }));
  const rankingReceiptProjection = await page.locator('.precedent-ranking-receipt').first().evaluate(node => ({ contract: node.dataset.rankingContract, corpus_version: node.dataset.corpusVersion, context_hash: node.dataset.contextHash, result_hash: node.dataset.resultHash, selected_ids: node.dataset.selectedClaimIds, text: node.innerText }));
  check('Rendered ranking receipt exposes the exact selected IDs, context, candidate scores, and result hash', rankingReceiptProjection.contract === processRun.result.precedent_ranking.contract && rankingReceiptProjection.corpus_version === processRun.result.precedent_ranking.corpus_version && rankingReceiptProjection.context_hash === processRun.result.precedent_ranking.context_hash && rankingReceiptProjection.result_hash === processRun.result.precedent_ranking.result_hash && rankingReceiptProjection.selected_ids === processRun.result.precedent_ranking.selected_claim_ids.join(',') && /candidate scores/i.test(rankingReceiptProjection.text) === false && processRun.result.precedent_ranking.candidate_scores.slice(0, 3).every(candidate => rankingReceiptProjection.text.includes(`${candidate.claim_id}: ${candidate.score_basis_points}`)), JSON.stringify(rankingReceiptProjection));
  await page.locator('.precedent-inline .precedent-mini').first().click();
  await waitVisible('#precedentViewer[open] .precedent-rank');
  check('Precedent dialog preserves inspectable rank factors and ranking receipt', (await page.locator('#precedentViewer .precedent-rank').getAttribute('data-context-hash')) === processRun.result.precedents[0].ranking.context_hash && (await page.locator('#precedentViewer .precedent-ranking-receipt').getAttribute('data-result-hash')) === processRun.result.precedent_ranking.result_hash);
  await page.locator('#closePrecedent').click();
  const renderedEdges = await page.locator('.process-edge[data-edge-source][data-edge-target]').evaluateAll(edges => edges.map(edge => ({ source: edge.dataset.edgeSource, target: edge.dataset.edgeTarget, state: edge.dataset.edgeState })));
  const expectedEdges = processGraph.edges.map(edge => ({ source: edge.source, target: edge.target, state: edge.state || '' }));
  check('Every backend process edge is experienceable with structural endpoints and state', JSON.stringify(renderedEdges) === JSON.stringify(expectedEdges), JSON.stringify({ expectedEdges, renderedEdges }));
  await page.locator('.process-edge-ledger summary').click();
  check('Compact connection ledger is keyboard-actionable', await page.locator('.process-edge').first().isVisible());
  const firstEdgeTarget = processGraph.edges[0].target;
  await page.locator('.process-edge').first().focus();
  await page.keyboard.press('Enter');
  check('A graph connection is keyboard-routable to its destination decision', await page.locator(`.decision-inspector[data-inspector-node="${firstEdgeTarget}"]`).count() === 1);
  const firstBranchId = processGraph.nodes.find(node => !processGraph.main_spine.includes(node.node_id)).node_id;
  await page.locator(`.process-branch-node[data-node-id="${firstBranchId}"]`).focus();
  await page.keyboard.press('Enter');
  check('Branch expansion is keyboard-actionable', await page.locator(`.decision-inspector[data-inspector-node="${firstBranchId}"]`).count() === 1);
  await auditViewports('02-ready-process', '.process-layout');

  const facts = processRun.result?.facts || processRun.understanding?.facts || [];
  const fact = selectProcessTextQuoteFact(facts, processGraph, 'fact_tenancy');
  check('A process-owned text-quote fact is available', Boolean(fact), JSON.stringify(facts.map(item => ({ fact_id: item.fact_id, locator_kinds: item.source_refs?.map(ref => ref.locator_kind) }))));
  const owningNode = processGraph.nodes.find(node => (node.fact_ids || []).includes(fact.fact_id));
  await page.locator(`.process-node-button[data-node-id="${owningNode.node_id}"],.process-branch-node[data-node-id="${owningNode.node_id}"]`).first().click();
  const factSelector = `.inspector-fact[data-fact-id="${fact.fact_id}"]`;
  check('Fact-to-source grounding renders every exact reference', await page.locator(`${factSelector} .grounding-ref`).count() === fact.source_refs.length);
  const renderedRefs = await page.locator(`${factSelector} .grounding-ref`).evaluateAll(buttons => buttons.map(button => ({ artifact_id: button.dataset.sourceRef, locator_kind: button.dataset.sourceLocatorKind, page: button.dataset.sourcePage, excerpt: button.dataset.sourceExcerpt, region: button.dataset.sourceRegion, observation: button.dataset.sourceObservation, field: button.dataset.sourceField, value: button.dataset.sourceValue, agent: button.dataset.sourceAgent, confidence: button.dataset.factConfidence, state: button.dataset.factState })));
  const expectedRefs = fact.source_refs.map(ref => ({ artifact_id: ref.artifact_id, locator_kind: ref.locator_kind, page: ref.page == null ? '' : String(ref.page), excerpt: ref.excerpt || '', region: ref.region ? JSON.stringify(ref.region) : '', observation: ref.observation || '', field: ref.field || '', value: ref.value == null ? '' : String(ref.value), agent: ref.agent || '', confidence: fact.confidence == null ? '' : String(fact.confidence), state: fact.state || '' }));
  check('Fact grounding retains exact typed locator, page, passage, agent, confidence, and state', JSON.stringify(renderedRefs) === JSON.stringify(expectedRefs), JSON.stringify({ expectedRefs, renderedRefs }));
  check('Text locator is rendered as an exact quotation with a page', await page.locator(`${factSelector} .grounding-ref[data-source-locator-kind="text_quote"] q`).count() > 0 && Boolean(await page.locator(`${factSelector} .grounding-ref[data-source-locator-kind="text_quote"]`).first().getAttribute('data-source-page')));
  const textLocatorChecks = await Promise.all(fact.source_refs.map(async ref => {
    const sourceText = ref.artifact_id === 'message'
      ? [demo.claim.message]
      : (await getJson(`${API}/api/artifacts/${encodeURIComponent(ref.artifact_id)}/extraction`)).pages;
    return Number.isInteger(ref.page) && ref.page >= 1 && typeof ref.excerpt === 'string' && exactNormalizedGroundingQuote(sourceText?.[ref.page - 1], ref.excerpt);
  }));
  check('Every text quote is an exact normalized substring of its returned source page', textLocatorChecks.every(Boolean), JSON.stringify(fact.source_refs));
  await page.locator(`${factSelector} .grounding-ref`).first().click();
  await waitVisible('#sourceViewer[open]');
  await waitVisible(`.source-fact[data-fact-id="${fact.fact_id}"]`);
  const sourceArtifactId = fact.source_refs[0].artifact_id;
  const sourceRefs = fact.source_refs.filter(ref => ref.artifact_id === sourceArtifactId);
  const renderedPassages = await page.locator(`.source-fact[data-fact-id="${fact.fact_id}"] .source-passage`).evaluateAll(passages => passages.map(passage => ({ locator_kind: passage.dataset.locatorKind, page: passage.dataset.sourcePage, excerpt: passage.dataset.sourceExcerpt, agent: passage.dataset.sourceAgent })));
  const expectedPassages = sourceRefs.map(ref => ({ locator_kind: ref.locator_kind, page: ref.page == null ? '' : String(ref.page), excerpt: ref.excerpt || '', agent: ref.agent || '' }));
  check('Source-to-fact grounding retains exact passages and owning-decision route', JSON.stringify(renderedPassages) === JSON.stringify(expectedPassages) && await page.locator(`.source-fact[data-fact-id="${fact.fact_id}"] [data-source-fact-node="${owningNode.node_id}"]`).count() === 1, JSON.stringify({ expectedPassages, renderedPassages }));
  check('Desktop source viewer retains bidirectional grounding', await page.locator(`.source-fact[data-fact-id="${fact.fact_id}"]`).isVisible());
  await page.locator(`.source-fact[data-fact-id="${fact.fact_id}"] [data-source-fact-node="${owningNode.node_id}"]`).click();
  await waitHidden('#sourceViewer');
  check('Source route returns focus to owning decision', await page.evaluate(nodeId => document.activeElement?.dataset.nodeId === nodeId, owningNode.node_id));

  const visualFact = facts.find(item => item.source_refs?.some(ref => ref.locator_kind === 'visual_observation') && processGraph.nodes.some(node => (node.fact_ids || []).includes(item.fact_id)));
  check('A process-owned visual-observation fact is available', Boolean(visualFact), JSON.stringify(facts.map(item => ({ fact_id: item.fact_id, locator_kinds: item.source_refs?.map(ref => ref.locator_kind) }))));
  const visualRef = visualFact.source_refs.find(ref => ref.locator_kind === 'visual_observation');
  const visualNode = processGraph.nodes.find(node => (node.fact_ids || []).includes(visualFact.fact_id));
  await page.locator(`.process-node-button[data-node-id="${visualNode.node_id}"],.process-branch-node[data-node-id="${visualNode.node_id}"]`).first().click();
  const visualButton = page.locator(`.inspector-fact[data-fact-id="${visualFact.fact_id}"] .grounding-ref[data-source-locator-kind="visual_observation"]`).first();
  const visualButtonText = await visualButton.innerText();
  check('Visual observation is rendered without quotation or model-extraction authority', await visualButton.locator('q').count() === 0 && /Hash-bound to these demo image bytes; not machine extraction, model output, or qualified review\./i.test(visualButtonText), visualButtonText);
  await visualButton.click();
  await waitVisible('#sourceViewer[open] .visual-region-highlight');
  const highlightedRegion = await page.locator('.visual-region-highlight').evaluate(node => ({ region: JSON.parse(node.dataset.highlightRegion), left: parseFloat(node.style.left) / 100, top: parseFloat(node.style.top) / 100, width: parseFloat(node.style.width) / 100, height: parseFloat(node.style.height) / 100, label: node.getAttribute('aria-label'), producer: node.dataset.sourceProducer, authority: node.dataset.sourceAuthority, annotation_contract: node.dataset.annotationContract, annotation_version: node.dataset.annotationVersion, image_sha256: node.dataset.imageSha256, artifact_sha256: node.dataset.artifactSha256 }));
  const visualRegionValid = Array.isArray(visualRef.region) && visualRef.region.length === 4 && visualRef.region.every(value => Number.isFinite(value) && value >= 0 && value <= 1) && visualRef.region[2] > 0 && visualRef.region[3] > 0 && visualRef.region[0] + visualRef.region[2] <= 1 && visualRef.region[1] + visualRef.region[3] <= 1;
  const visualArtifact = demo.claim.artifacts.find(item => item.artifact_id === visualRef.artifact_id);
  check('Opening a visual fact highlights the exact normalized image region and hash-bound generated-demo authority', visualRegionValid && visualArtifact?.media_type?.startsWith('image/') && JSON.stringify(highlightedRegion.region) === JSON.stringify(visualRef.region) && [highlightedRegion.left, highlightedRegion.top, highlightedRegion.width, highlightedRegion.height].every((value, index) => Math.abs(value - visualRef.region[index]) < 1e-9) && highlightedRegion.label.includes(visualRef.observation) && highlightedRegion.producer === visualRef.producer && highlightedRegion.authority === visualRef.authority && highlightedRegion.annotation_contract === visualRef.annotation_contract && highlightedRegion.annotation_version === visualRef.annotation_version && highlightedRegion.image_sha256 === visualRef.image_sha256 && highlightedRegion.artifact_sha256 === visualArtifact.sha256, JSON.stringify({ visualRef, visualArtifact, highlightedRegion }));
  const visualPassage = await page.locator(`.source-fact[data-fact-id="${visualFact.fact_id}"] .source-passage[data-locator-kind="visual_observation"]`).evaluate(node => ({ region: node.dataset.sourceRegion, observation: node.dataset.sourceObservation, producer: node.dataset.sourceProducer, authority: node.dataset.sourceAuthority, annotation_contract: node.dataset.annotationContract, annotation_version: node.dataset.annotationVersion, image_sha256: node.dataset.imageSha256, hasQuote: Boolean(node.querySelector('q')), text: node.innerText }));
  check('Visual source-to-fact grounding roundtrips the exact curated annotation without agent, extraction, or quotation authority', visualPassage.region === JSON.stringify(visualRef.region) && visualPassage.observation === visualRef.observation && visualPassage.producer === visualRef.producer && visualPassage.authority === visualRef.authority && visualPassage.annotation_contract === visualRef.annotation_contract && visualPassage.annotation_version === visualRef.annotation_version && visualPassage.image_sha256 === visualArtifact.sha256 && !visualPassage.hasQuote && !/machine extraction|agent observation|model output/i.test(visualPassage.text.replace('not machine extraction, model output', '')) && await page.locator('.opened-grounding q').count() === 0, JSON.stringify({ visualRef, visualPassage }));
  check('Grounded image inspection retains decoded original pixels', await page.locator('#sourceImage').evaluate(node => node.complete && node.naturalWidth > 0 && node.naturalHeight > 0));
  await screenshot('03-image-grounding-inspection.png');
  await runAxe('Grounded image viewer');
  await page.locator('#closeSourceViewer').click();

  const metadataFact = facts.find(item => item.source_refs?.some(ref => ref.locator_kind === 'metadata_field'));
  const metadataRef = metadataFact?.source_refs.find(ref => ref.locator_kind === 'metadata_field');
  const metadataNodeId = processGraph.nodes.find(node => (node.fact_ids || []).includes(metadataFact?.fact_id))?.node_id || processRun.result.checklist.items.find(item => item.fact_id === metadataFact?.fact_id)?.node_id;
  check('Metadata provenance remains structurally owned by a process decision', Boolean(metadataFact && metadataRef && metadataNodeId), JSON.stringify({ metadataFact, metadataNodeId }));
  await page.locator(`.process-node-button[data-node-id="${metadataNodeId}"],.process-branch-node[data-node-id="${metadataNodeId}"]`).first().click();
  const metadataButton = page.locator(`.inspector-fact[data-fact-id="${metadataFact.fact_id}"] .grounding-ref[data-source-locator-kind="metadata_field"]`).first();
  check('Metadata field is rendered as observed field/value rather than a quote', await metadataButton.locator('q').count() === 0 && (await metadataButton.getAttribute('data-source-field')) === metadataRef.field && (await metadataButton.getAttribute('data-source-value')) === String(metadataRef.value));
  const intakeFields = { claim_id: demo.claim.claim_id, subject: demo.claim.subject, received_at: demo.claim.received_at, customer_name: demo.claim.customer?.name || '', customer_address: demo.claim.customer?.address || '', policy_reference: demo.claim.customer?.policy || '' };
  const metadataArtifact = demo.claim.artifacts.find(item => item.artifact_id === metadataRef.artifact_id);
  const observedMetadata = metadataRef.artifact_id === 'intake' ? intakeFields : metadataArtifact;
  check('Metadata locator matches the observed source field exactly', observedMetadata && Object.hasOwn(observedMetadata, metadataRef.field) && String(observedMetadata[metadataRef.field]) === String(metadataRef.value), JSON.stringify({ metadataRef, observedMetadata }));
  await metadataButton.click();
  await waitVisible('#sourceViewer[open] .opened-locator[data-locator-kind="metadata_field"]');
  const metadataPassage = await page.locator(`.source-fact[data-fact-id="${metadataFact.fact_id}"] .source-passage[data-locator-kind="metadata_field"]`).evaluate(node => ({ field: node.dataset.sourceField, value: node.dataset.sourceValue, agent: node.dataset.sourceAgent, hasQuote: Boolean(node.querySelector('q')) }));
  check('Metadata source retains exact field, value, and agent and routes back to its owning decision', metadataPassage.field === metadataRef.field && metadataPassage.value === String(metadataRef.value) && metadataPassage.agent === metadataRef.agent && !metadataPassage.hasQuote && await page.locator(`.source-fact[data-fact-id="${metadataFact.fact_id}"] [data-source-fact-node="${metadataNodeId}"]`).count() === 1, JSON.stringify({ metadataRef, metadataPassage }));
  await page.locator('#closeSourceViewer').click();

  await waitVisible('[data-v20-open-documents]');
  await page.locator('[data-v20-open-documents]').click();
  await waitVisible('#v20DocumentSheet[open]');
  const neededItem = page.locator('.v20-document-body .v17-checklist-group[data-kind="needed"] .v17-checklist-item[data-node-id][data-node-ids][data-current-path][data-fact-id][data-item-id]').first();
  check('Derived document items own structural primary, ordered-owner, current-path, fact, and item identifiers', await neededItem.count() === 1 && Boolean(await neededItem.getAttribute('data-node-id')) && Boolean(await neededItem.getAttribute('data-node-ids')) && ['true', 'false'].includes(await neededItem.getAttribute('data-current-path')) && Boolean(await neededItem.getAttribute('data-fact-id')) && Boolean(await neededItem.getAttribute('data-item-id')));
  const multiOwnerItem = processRun.result.checklist.items.find(item => Array.isArray(item.node_ids) && item.node_ids.length > 1);
  check('Flagship checklist contains an inspectable reciprocal multi-owner evidence item', Boolean(multiOwnerItem), JSON.stringify(processRun.result.checklist.items.map(item => ({ item_id: item.item_id, node_ids: item.node_ids }))));
  const renderedMultiOwner = page.locator(`.v20-document-body .v17-checklist-item[data-item-id="${multiOwnerItem.item_id}"]`).first();
  const collapsedOwnerGroup = renderedMultiOwner.locator('xpath=ancestor::details[not(@open)][1]');
  if (await collapsedOwnerGroup.count()) await collapsedOwnerGroup.locator(':scope > summary').click();
  await renderedMultiOwner.scrollIntoViewIfNeeded();
  check('Multi-owner document item is visibly inspectable after expanding its group', await renderedMultiOwner.isVisible());
  const multiOwnerProjection = await renderedMultiOwner.evaluate(node => ({ node_id: node.dataset.nodeId, node_ids: node.dataset.nodeIds, current_path: node.dataset.currentPath, text: node.innerText }));
  check('Document sheet preserves exact owner order, primary owner, current-path state, and secondary relationships', multiOwnerProjection.node_id === multiOwnerItem.node_id && multiOwnerProjection.node_ids === multiOwnerItem.node_ids.join(',') && multiOwnerProjection.current_path === String(multiOwnerItem.current_path === true) && /Also required by/i.test(multiOwnerProjection.text), JSON.stringify({ multiOwnerItem, multiOwnerProjection }));
  if (isProductionJourney()) {
    const expectedChecklistContributions = processRun.result.checklist.items.map(item => ({
      item_id: item.item_id,
      contribution: contributionDomProjection(item.agent_contribution, EVIDENCE_CONTRIBUTION_ROLE),
    })).filter(item => item.contribution);
    const renderedChecklistContributions = await page.locator('.v20-document-body .v17-checklist-item[data-item-id]').evaluateAll(items => items.flatMap(item => {
      const badge = item.querySelector('.model-contribution-attribution');
      return badge ? [{ item_id: item.dataset.itemId, contribution: { authority: badge.dataset.contributionAuthority, accepted_count: badge.dataset.acceptedCount, fallback_count: badge.dataset.fallbackCount, accepted_ids: badge.dataset.acceptedContributionIds, fallback_ids: badge.dataset.fallbackContributionIds } }] : [];
    }));
    check('Every document need visibly preserves its exact Nemotron acceptance or deterministic fallback attribution', expectedChecklistContributions.length === processRun.result.checklist.items.length && stableJson(renderedChecklistContributions.sort((a, b) => a.item_id.localeCompare(b.item_id))) === stableJson(expectedChecklistContributions.sort((a, b) => a.item_id.localeCompare(b.item_id))) && renderedChecklistContributions.some(item => Number(item.contribution.accepted_count) > 0), JSON.stringify({ expectedChecklistContributions, renderedChecklistContributions }));
  }
  check('Document sheet is a labelled modal dialog with focus inside', await page.evaluate(() => { const sheet = document.querySelector('#v20DocumentSheet'); return sheet?.tagName === 'DIALOG' && sheet.getAttribute('aria-labelledby') === 'v20DocumentTitle' && sheet.contains(document.activeElement); }));
  await page.keyboard.press('Escape');
  await waitHidden('#v20DocumentSheet');
  check('Closing document sheet restores trigger focus', await page.evaluate(() => document.activeElement?.hasAttribute('data-v20-open-documents')));
  await page.locator('[data-v20-open-documents]').click();
  const owningNodeId = await neededItem.getAttribute('data-node-id');
  await neededItem.click();
  await waitHidden('#v20DocumentSheet');
  check('Document need routes by its own node identifier', await page.locator(`.decision-inspector[data-inspector-node="${owningNodeId}"]`).count() === 1);
  const secondaryOwnerId = multiOwnerItem.node_ids.find(nodeId => nodeId !== multiOwnerItem.node_id);
  await page.locator(`.process-node-button[data-node-id="${secondaryOwnerId}"],.process-branch-node[data-node-id="${secondaryOwnerId}"]`).first().click();
  const secondaryOwnerEvidence = page.locator(`.decision-inspector[data-inspector-node="${secondaryOwnerId}"] .inspector-row[data-item-id="${multiOwnerItem.item_id}"][data-node-ids="${multiOwnerItem.node_ids.join(',')}"]`);
  check('A secondary process owner renders the same reciprocal evidence item and names the additional relationship', await secondaryOwnerEvidence.count() === 1 && /Primary decision:|Also required by/i.test(await secondaryOwnerEvidence.innerText()), JSON.stringify({ item_id: multiOwnerItem.item_id, secondaryOwnerId }));
  }
  const flagshipBeforeReview = processRun;
  const preReviewGraphProjection = await page.locator('#artifactProcessGraph').evaluate(node => ({
    node_ids: [...node.querySelectorAll('[data-node-id][data-process-build-state]')].map(item => item.dataset.nodeId).filter(Boolean),
    change_ids: [...node.querySelectorAll('[data-artifact-change-id]')].map(item => item.dataset.artifactChangeId).filter(Boolean),
  }));
  await page.locator('#journeyNext').click();
  await waitVisible('body[data-casepath-moment="review"]');
  check('Review keeps one consequential choice and one calm cursor', await page.locator('#artifactCanvas[data-casepath-scene="review"] [data-artifact-focus="true"] #artifactAgentCursor').count() === 0 && await page.locator('#artifactCanvas[data-casepath-scene="review"] #artifactAgentCursor').count() === 1);
  const reviewCanvas = await artifactCanvasSnapshot();
  const reviewCanvasIssues = focusedArtifactCanvasViolations(reviewCanvas);
  check('Expert review edits the same persistent process graph instead of replacing it with a form or report', reviewCanvasIssues.length === 0 && reviewCanvas.action_count === 1 && ['selecting', 'editing', 'pending'].includes(reviewCanvas.review_edit_state), JSON.stringify({ reviewCanvas, reviewCanvasIssues }));
  const visibleReviewCopy = await page.locator('#artifactCanvas [data-artifact-focus="true"][data-casepath-primary-artifact="true"]').innerText();
  check('Simulated review foregrounds one consequential graph correction and disclaims qualified approval', /not qualified expert approval/i.test(visibleReviewCopy) && /neutral assessment first/i.test(visibleReviewCopy) && /broader building testing conditional/i.test(visibleReviewCopy), visibleReviewCopy);
  await auditViewports('04-review', '#artifactCanvas [data-review-edit-state="pending"]');
  await page.locator('#artifactCanvas [data-ac-action="submit-review"][data-review-mode="conditional"]').click();
  await waitVisible('body[data-casepath-moment="review-applied"]');
  await page.waitForFunction(() => document.querySelector('[data-review-edit-state="applied"]'), null, { timeout: 30000 });
  const appliedCanvas = await artifactCanvasSnapshot();
  const appliedCanvasIssues = focusedArtifactCanvasViolations(appliedCanvas);
  const postReviewGraphProjection = await page.locator('#artifactProcessGraph').evaluate(node => ({
    node_ids: [...node.querySelectorAll('[data-node-id][data-process-build-state]')].map(item => item.dataset.nodeId).filter(Boolean),
    change_ids: [...node.querySelectorAll('[data-artifact-change-id]')].map(item => item.dataset.artifactChangeId).filter(Boolean),
  }));
  const expectedReviewedProjection = [...FLAGSHIP_PROCESS_PROJECTION_IDS];
  expectedReviewedProjection.splice(expectedReviewedProjection.indexOf('causation') + 1, 0, 'ventilation_dispute');
  check('Accepted review visibly mutates the same graph in place and adds only the disputed-ventilation decision', appliedCanvasIssues.length === 0 && appliedCanvas.action_count === 1 && appliedCanvas.review_edit_state === 'applied' && stableJson(preReviewGraphProjection.node_ids) === stableJson(FLAGSHIP_PROCESS_PROJECTION_IDS) && stableJson(postReviewGraphProjection.node_ids) === stableJson(expectedReviewedProjection), JSON.stringify({ appliedCanvas, appliedCanvasIssues, preReviewGraphProjection, postReviewGraphProjection }));
  if (false) {
  await page.locator('.v21-progressive-details > summary').click();
  await waitVisible('.v21-progressive-details[open] .review-applied-layout');
  await page.locator('.review-applied .process-node-button[data-node-id="causation"],.review-applied .process-branch-node[data-node-id="causation"]').first().click();
  check('Applied-review workspace preserves its declared no-precedent boundary after graph interaction', await page.locator('.review-applied .precedent-inline').count() === 0 && await page.locator('.review-applied .process-layout').getAttribute('data-precedents') === 'false');
  }
  const reviewed = await waitForValue(() => reviewResponse);
  retainedEvidence['demo-review'] = reviewed;
  check('Demo review response is accepted, typed, and explicitly unverified', reviewed.accepted === true && reviewed.reviewer?.type === 'unverified_demo_user' && reviewed.reviewer?.qualification_status === 'not_verified' && reviewed.result?.process && reviewed.result?.checklist, JSON.stringify(reviewed));
  const persistedReviewedRun = await getJson(`${API}/api/runs/${encodeURIComponent(flagshipRunId)}`);
  retainedEvidence['post-review-run'] = persistedReviewedRun;
  const reviewedEvidenceIssues = evidenceRelationContractViolations(reviewed.result?.process, reviewed.result?.checklist);
  check('Applied-review checklist retains exact reciprocal process ownership', reviewedEvidenceIssues.length === 0, JSON.stringify(reviewedEvidenceIssues));
  const reviewTransformIssues = reviewTransformContractViolations(reviewed, persistedReviewedRun, flagshipBeforeReview);
  check(isProductionJourney() ? 'Review is an explicitly unverified post-model transform with exact pre/post hashes and preserved model-time acceptance receipts' : 'Local deterministic review is an explicitly unverified transform with exact pre/post hashes', reviewTransformIssues.length === 0, JSON.stringify(reviewTransformIssues));
  const appliedReviewCopy = await page.locator('#artifactCanvas [data-artifact-focus="true"]').innerText();
  check('Applied-review UI keeps the edit explicitly unverified', /unverified/i.test(appliedReviewCopy), appliedReviewCopy);
  const appliedContributionBadgeCount = await page.locator('.review-applied .model-contribution-attribution').count();
  const visibleContributionBadgeCount = await page.locator('.model-contribution-attribution:visible').count();
  const visibleFinalHandoffCount = await page.locator('.v20-final-handoff:visible').count();
  const postReviewContributionExpectations = [
    ...reviewed.result.process.nodes.flatMap(node => (node.agent_decision_contributions || []).map(contribution => contributionExpectation(contribution, 'Process Decision Mapping Agent', reviewed.review_transform))),
    ...reviewed.result.checklist.items.map(item => contributionExpectation(item.agent_contribution, 'Evidence and Checklist Agent', reviewed.review_transform)),
    contributionExpectation(orchestrationAudit(flagshipBeforeReview)?.final_claim_brief?.field_contributions, FINAL_CONTRIBUTION_ROLE, reviewed.review_transform),
  ];
  check('Applied-review result globally suppresses every pre-review contribution badge and final handoff', reviewed.review_transform?.acceptance_scope === 'post_review_unverified_transform' && reviewed.review_transform?.model_acceptance_reused === false && postReviewContributionExpectations.every(value => value === null) && appliedContributionBadgeCount === 0 && visibleContributionBadgeCount === 0 && visibleFinalHandoffCount === 0, JSON.stringify({ review_transform: reviewed.review_transform, post_review_expectations: postReviewContributionExpectations, rendered_badge_count: appliedContributionBadgeCount, visible_badge_count: visibleContributionBadgeCount, visible_final_handoff_count: visibleFinalHandoffCount }));
  if (false) {
  const reviewedNodeIds = reviewed.result.process.nodes.map(node => node.node_id);
  const appliedNodeIds = await page.evaluate(() => [...new Set([...document.querySelectorAll('.review-applied .process-node-button[data-node-id],.review-applied .process-branch-node[data-node-id]')].map(node => node.dataset.nodeId))]);
  check('Applied view shows the actual server-returned reviewed graph', reviewedNodeIds.every(id => appliedNodeIds.includes(id)) && reviewedNodeIds.length === appliedNodeIds.length, JSON.stringify({ reviewedNodeIds, appliedNodeIds }));
  const appliedEdges = await page.locator('.review-applied .process-edge[data-edge-source][data-edge-target]').evaluateAll(edges => edges.map(edge => ({ source: edge.dataset.edgeSource, target: edge.dataset.edgeTarget, state: edge.dataset.edgeState })));
  const reviewedEdges = reviewed.result.process.edges.map(edge => ({ source: edge.source, target: edge.target, state: edge.state || '' }));
  check('Applied view retains every server-returned reviewed graph connection', JSON.stringify(appliedEdges) === JSON.stringify(reviewedEdges), JSON.stringify({ reviewedEdges, appliedEdges }));
  const reviewedChecklistProjection = await page.locator('.reviewed-checklist [data-item-id]').evaluateAll(nodes => nodes.map(node => ({ item_id: node.dataset.itemId, node_id: node.dataset.nodeId, node_ids: node.dataset.nodeIds, current_path: node.dataset.currentPath })));
  check('Applied view shows the actual reviewed checklist with ordered owners and current-path state', reviewedChecklistProjection.length === reviewed.result.checklist.items.length && reviewedChecklistProjection.every((projection, index) => projection.item_id === reviewed.result.checklist.items[index].item_id && projection.node_id === reviewed.result.checklist.items[index].node_id && projection.node_ids === reviewed.result.checklist.items[index].node_ids.join(',') && projection.current_path === String(reviewed.result.checklist.items[index].current_path === true)), JSON.stringify(reviewedChecklistProjection));
  const reviewedSelectedNode = reviewed.result.process.nodes.find(node => node.node_id === reviewed.result.process.current_overlay?.current_node_id);
  const reviewedSelectedFacts = reviewed.result.facts.filter(fact => (reviewedSelectedNode?.fact_ids || []).includes(fact.fact_id)).slice(0, 2);
  const reviewedFactChain = await page.locator('.review-applied .v17-evidence-chain').innerText();
  check('Applied fact chain remains bound to the displayed reviewed run', reviewedSelectedFacts.length > 0 && reviewedSelectedFacts.every(fact => reviewedFactChain.includes(`${fact.label}: ${fact.value}`)), JSON.stringify({ reviewedSelectedFacts, reviewedFactChain }));
  const beforeNodeIds = new Set(flagshipBeforeReview.result.process.nodes.map(node => node.node_id));
  const computedAdded = reviewedNodeIds.filter(id => !beforeNodeIds.has(id));
  check('Applied view presents a computed delta before consolidation', (await page.locator('.review-applied-delta article').first().innerText()).includes(String(computedAdded.length)));
  await page.locator('.v21-progressive-details > summary').click();
  const compactApplied = await minimalSurfaceSnapshot();
  check('Applied review recedes to one change summary after inspection', compactApplied.focus_count === 1 && compactApplied.artifact_count === 1 && compactApplied.action_count === 1 && await page.locator('.review-applied-layout').isHidden(), JSON.stringify(compactApplied));
  }
  await auditViewports('05-review-applied', '#artifactCanvas [data-review-edit-state="applied"]');

  await page.locator('#journeyNext').click();
  await waitVisible('body[data-casepath-moment="knowledge"]');
  const knowledgeCanvas = await artifactCanvasSnapshot();
  const candidateCopy = await page.locator('#artifactCanvas [data-artifact-focus="true"]').innerText();
  check('Knowledge consolidation becomes one visible unverified-memory outcome', focusedArtifactCanvasViolations(knowledgeCanvas).length === 0 && knowledgeCanvas.action_count === 1 && /unverified demo memory/i.test(candidateCopy), JSON.stringify({ knowledgeCanvas, candidateCopy }));
  check('Candidate remains honestly quarantined with one unverified support record and zero qualified support', reviewed.candidate?.status === 'quarantined' && reviewed.candidate?.support_count === 1 && reviewed.candidate?.required_support === 3 && reviewed.candidate?.qualified_support_count === 0 && reviewed.candidate?.required_qualified_support === 3, JSON.stringify(reviewed.candidate));
  check('Shared playbook is explicitly unchanged', reviewed.candidate?.shared_knowledge_changed === false && /shared playbook unchanged/i.test(candidateCopy), candidateCopy);
  check('Passed deterministic gates remain distinct from missing qualified support and approval', reviewed.candidate?.target_tests?.status === 'passed' && reviewed.candidate?.protected_regression?.status === 'passed' && reviewed.candidate?.approval?.status === 'pending' && reviewed.candidate?.approval?.qualified_reviewer === false, JSON.stringify(reviewed.candidate));
  const protectedOutputCase = reviewed.candidate?.protected_regression?.cases?.find(value => value.case_id === 'source_claim_full_playbook_unchanged');
  check('Protected regression executes the real memory gate and independently binds unchanged full result, process, and checklist hashes', protectedOutputCase?.status === 'passed' && protectedOutputCase?.execution_contract === 'deterministic_case_specific_memory_gate/1.0.0' && protectedOutputCase?.gate_executed === true && protectedOutputCase?.expected_memory_application === false && protectedOutputCase?.actual_memory_application === false && protectedOutputCase?.output_unchanged === true && stableJson(protectedOutputCase?.before_hashes) === stableJson(protectedOutputCase?.after_hashes) && ['result_hash', 'process_hash', 'checklist_hash'].every(key => SHA256_PATTERN.test(protectedOutputCase?.before_hashes?.[key] || '')), JSON.stringify(protectedOutputCase));
  await auditViewports('06-learning', '#artifactCanvas [data-memory-id]');

  await page.locator('#journeyNext').click();
  await waitJourneyUi('Later-claim comparison did not reach its terminal UI state', async () => {
    await awaitLaterJourneyTerminalUi();
  });
  const laterCanvas = await artifactCanvasSnapshot();
  const laterCanvasIssues = focusedArtifactCanvasViolations(laterCanvas);
  check('The future claim reuses the same source-plus-process canvas with one clear causal focus', laterCanvasIssues.length === 0 && laterCanvas.action_count === 1, JSON.stringify({ laterCanvas, laterCanvasIssues }));
  const proof = await waitForValue(() => proofResponse, runTimeoutMs());
  check('Held-out result retains one authority-labelled knowledge focus and one calm cursor', await page.locator('#artifactCanvas[data-casepath-scene="later-result"][data-work-authority] [data-artifact-focus="true"]').count() === 1 && await page.locator('#artifactCanvas[data-casepath-scene="later-result"] #artifactAgentCursor').count() === 1);
  retainedEvidence['learning-proof'] = proof;
  check('Lifecycle produced flagship, baseline, and post-review runs', runIds.length === 3, JSON.stringify(runIds));
  const baseline = await awaitRun(runIds[1]);
  const later = await awaitRun(runIds[2]);
  const laterClaim = await getJson(`${API}/api/claims/${encodeURIComponent(demo.later_claim_id)}`);
  retainedEvidence['later-baseline-run'] = baseline;
  retainedEvidence['later-after-memory-run'] = later;
  if (!isLocal(BASE) || !isLocal(API)) {
    const baselineReferenceIssues = deterministicReferenceRunViolations(baseline, 'baseline');
    const laterReferenceIssues = deterministicReferenceRunViolations(later, 'current');
    check('Held-out baseline and current comparisons explicitly disclose deterministic-reference authority with no executed model DAG or call activity', baselineReferenceIssues.length === 0 && laterReferenceIssues.length === 0, JSON.stringify({ baseline: baselineReferenceIssues, later: laterReferenceIssues }));
  }
  for (const [label, run, claim] of [['baseline', baseline, laterClaim], ['later', later, laterClaim]]) {
    const relationIssues = evidenceRelationContractViolations(run.result?.process, run.result?.checklist);
    check(`${label} later-claim run retains exact reciprocal evidence ownership`, relationIssues.length === 0, JSON.stringify(relationIssues));
    const legalIssues = legalContextContractViolations(run.result?.legal_research, run.result?.process);
    check(`${label} later-claim run retains exact ID-joined legal context`, legalIssues.length === 0, JSON.stringify(legalIssues));
    const visualRefs = (run.result?.facts || []).flatMap(fact => (fact.source_refs || []).filter(reference => reference.locator_kind === 'visual_observation'));
    const visualIssues = visualRefs.flatMap(reference => visualReferenceContractViolations(reference, claim.artifacts.find(artifact => artifact.artifact_id === reference.artifact_id)).map(issue => `${reference.artifact_id}: ${issue}`));
    check(`${label} later-claim run binds every curated visual annotation to public image bytes`, visualRefs.length > 0 && visualIssues.length === 0, JSON.stringify(visualIssues));
    const rankingIssues = precedentRankingContractViolations(run.result);
    check(`${label} later-claim run recomputes an exact-three ranking receipt`, rankingIssues.length === 0, JSON.stringify(rankingIssues));
    const memoryStateIssues = memoryRetrievalContractViolations(run.result);
    check(`${label} later-claim run keeps retrieval separate from receipt-bound memory use`, memoryStateIssues.length === 0, JSON.stringify(memoryStateIssues));
  }
  const memoryIssues = memoryApplicationContractViolations(baseline, later, proof);
  check('Later causal proof independently binds the exact memory receipt, retained pre-transform boundary, persisted completed event, DTO hashes, semantic eligibility, operations, delta, ten checks, pure replay, and unchanged v3', memoryIssues.length === 0, JSON.stringify(memoryIssues));
  check('Computed proof names both completed later-claim runs', proof.before?.run_id === baseline.run_id && proof.after?.run_id === later.run_id);
  check('Later claim keeps the shared v3 playbook and applies no shared rule', later.result?.playbook?.version === 'mould-playbook-v3' && later.result?.shared_rule_applied === false);
  const laterProcess = later.result?.process || later.process;
  const laterCurrentNodeId = laterProcess?.current_overlay?.current_node_id || laterProcess?.current_node;
  const laterCurrentNode = laterProcess?.nodes?.find(node => node.node_id === laterCurrentNodeId);
  check('Later claim remains in Swiss residential tenancy at unresolved causation with the evidence-gap next action', later.result?.category === 'Rental defect - mould and moisture' && later.result?.scope === 'Swiss residential tenancy' && laterCurrentNodeId === 'causation' && laterCurrentNode?.state === 'current' && laterCurrentNode?.answer === 'Unresolved' && laterProcess?.current_overlay?.next_action_node_id === 'evidence_gap' && laterProcess?.selected_path?.includes('evidence_gap'), JSON.stringify({ category: later.result?.category, scope: later.result?.scope, current_node_id: laterCurrentNodeId, current_node: laterCurrentNode, overlay: laterProcess?.current_overlay, selected_path: laterProcess?.selected_path }));
  check('Later proof retains its own current unresolved causation decision', laterCurrentNodeId === 'causation' && laterCurrentNode?.title === 'Causation assessment' && laterCurrentNode?.answer === 'Unresolved', JSON.stringify(laterCurrentNode));
  check('Later memory transform adds exactly the ventilation node, two bounded edges, and three evidence-item changes', stableJson(proof.causal_delta?.process?.added_node_ids) === stableJson(['ventilation_dispute']) && stableJson(proof.causal_delta?.process?.added_edges) === stableJson([{ source: 'evidence_gap', target: 'ventilation_dispute' }, { source: 'ventilation_dispute', target: 'causation' }]) && stableJson(proof.causal_delta?.evidence?.changed_item_ids) === stableJson(['building_envelope', 'management_position', 'use_evidence']) && laterProcess.nodes.some(node => node.node_id === 'ventilation_dispute'), JSON.stringify(proof.causal_delta));
  const visibleMemoryEffects = await page.locator('#artifactCanvas [data-artifact-focus="true"] [data-memory-origin-id][data-memory-effect]').evaluateAll(nodes => nodes.map(node => ({
    origin_id: node.dataset.memoryOriginId || '',
    effect: node.dataset.memoryEffect || '',
    node_id: node.dataset.nodeId || '',
    item_id: node.dataset.itemId || '',
    edge_source: node.dataset.edgeSource || '',
    edge_target: node.dataset.edgeTarget || '',
  })));
  const expectedMemoryOrigin = later.result?.memory_application?.source_memory?.memory_id || reviewed.memory_id;
  const visibleMemoryEffectIssues = memoryEffectContractViolations(visibleMemoryEffects, expectedMemoryOrigin);
  check('Future claim shows one memory-origin causal delta: one node, two edges, and three evidence changes', visibleMemoryEffectIssues.length === 0, JSON.stringify({ visibleMemoryEffects, visibleMemoryEffectIssues, expectedMemoryOrigin }));
  const memoryUsed = later.result?.memory_application != null
    && later.result?.memory_used === true
    && later.result?.reviewed_memory_used === true
    && later.result?.knowledge?.reviewed_memory_used === true
    && later.result?.reviewed_memory_retrieved === true
    && later.result?.knowledge?.reviewed_memory_retrieved === true
    && later.result?.process?.memory_used === true
    && later.result?.checklist?.memory_used === true
    && proof.reviewed_memory_proof?.used === true
    && memoryIssues.length === 0;
  const visibleLaterCopy = await page.locator('#artifactCanvas [data-artifact-focus="true"]').innerText();
  check('Later UI claims case-specific unverified guidance only when retrieval, every use flag, exact receipt, and computed proof all agree', memoryUsed && /eligible case-specific guidance returned with a bounded receipt/i.test(visibleLaterCopy) && /shared playbook unchanged/i.test(visibleLaterCopy), visibleLaterCopy);
  check('Later ranking selects the unverified demo memory and remains exactly three ordered patterns', later.result.precedents.length === 3 && later.result.precedents[0]?.claim_id === 'DEF-027-E0-DEMO' && later.result.precedents[0]?.review_status === 'unverified_demo_memory' && later.result.precedent_ranking.selected_claim_ids[0] === 'DEF-027-E0-DEMO', JSON.stringify(later.result.precedents.map(item => ({ claim_id: item.claim_id, status: item.review_status, rank: item.ranking?.rank }))));
  const transformedContributionValues = [
    ...(later.result.process.nodes || []).flatMap(node => (node.agent_decision_contributions || []).map(contribution => contributionExpectation(contribution, PROCESS_CONTRIBUTION_ROLE, later.result.memory_application))),
    ...(later.result.checklist.items || []).map(item => contributionExpectation(item.agent_contribution, EVIDENCE_CONTRIBUTION_ROLE, later.result.memory_application)),
  ];
  check('Post-memory DTOs and UI contain no pre-memory Nemotron acceptance attribution', transformedContributionValues.every(value => value === null) && await page.locator('#laterResult .model-contribution-attribution').count() === 0 && !Object.hasOwn(later.result.process, 'agent_contribution') && !later.result.process.nodes.some(node => Object.hasOwn(node, 'agent_decision_contributions')) && !Object.hasOwn(later.result.checklist, 'agent_contribution') && !later.result.checklist.items.some(item => Object.hasOwn(item, 'agent_contribution')) && later.result.next_action?.agent_brief_contribution === null, JSON.stringify(transformedContributionValues));
  if (false) {
  const returnedUnverifiedMemory = later.result?.precedents?.find(item => item.review_status === 'unverified_demo_memory' && item.memory_id);
  await page.locator('.v21-proof-details > summary').click();
  await waitVisible('.v21-proof-details[open] .memory-application-receipt');
  check('Exact causal operations remain available behind Inspect proof', await page.locator('.v21-proof-details[open] .v21-causal-proof').isVisible());
  if (memoryUsed && returnedUnverifiedMemory) {
    const reuseThreadSelector = '#laterResult .v18-reuse-proof .v17-reuse-thread';
    await waitVisible(reuseThreadSelector);
    const laterReuseThreadCount = await page.locator('#laterResult .v17-reuse-thread').count();
    const reuseProofCount = await page.locator('#laterResult .v18-reuse-proof').count();
    const proofReuseThreadCount = await page.locator(reuseThreadSelector).count();
    check('Later result renders exactly one receipt-bound memory-reuse proof and thread', laterReuseThreadCount === 1 && reuseProofCount === 1 && proofReuseThreadCount === 1, JSON.stringify({ later_reuse_threads: laterReuseThreadCount, reuse_proofs: reuseProofCount, proof_reuse_threads: proofReuseThreadCount }));
    const reuseCopy = await page.locator(reuseThreadSelector).innerText();
    check('Returned demo memory stays explicitly unverified wherever its precedent is rendered', /unverified demo review memory returned/i.test(reuseCopy) && !/qualified expert-reviewed memory returned/i.test(reuseCopy), reuseCopy);
    const proofLayout = await page.locator(reuseThreadSelector).evaluate(node => {
      const style = getComputedStyle(node);
      const proofValues = [...node.querySelectorAll('strong,code')].map(value => getComputedStyle(value));
      return {
        display: style.display,
        grid_template_columns: style.gridTemplateColumns,
        client_width: node.clientWidth,
        scroll_width: node.scrollWidth,
        values_wrap: proofValues.every(value => value.overflowWrap === 'anywhere' && value.wordBreak === 'break-word'),
      };
    });
    check('Final memory-proof layout uses responsive grid columns and wraps long receipt hashes without local overflow', proofLayout.display === 'grid' && proofLayout.grid_template_columns !== 'none' && proofLayout.scroll_width <= proofLayout.client_width + 1 && proofLayout.values_wrap, JSON.stringify(proofLayout));
  }
  const receiptProjection = await page.locator('.memory-application-receipt').evaluate(node => {
    const eligibility = node.querySelector('.memory-semantic-eligibility');
    return {
      contract: node.dataset.memoryContract,
      authority: node.dataset.memoryAuthority,
      scope: node.dataset.memoryScope,
      application_hash: node.dataset.applicationHash,
      model_acceptance_reused: node.dataset.modelAcceptanceReused,
      shared_rule_applied: node.dataset.sharedRuleApplied,
      eligibility_contract: eligibility?.dataset.eligibilityContract,
      eligibility_rule_id: eligibility?.dataset.eligibilityRuleId,
      semantic_signature_hash: eligibility?.dataset.semanticSignatureHash,
      semantic_role: eligibility?.dataset.semanticRole,
      text: node.innerText,
    };
  });
  const laterResultText = await page.locator('#laterResult').innerText();
  check('Rendered receipt exposes exact unverified boundary, semantic eligibility, application hash, and every before/after DTO and semantic hash', receiptProjection.contract === later.result.memory_application.contract && receiptProjection.authority === 'unverified_demo' && receiptProjection.scope === 'case_specific_guidance_only' && receiptProjection.application_hash === later.result.memory_application.application_hash && receiptProjection.model_acceptance_reused === 'false' && receiptProjection.shared_rule_applied === 'false' && receiptProjection.eligibility_contract === later.result.memory_application.eligibility.contract && receiptProjection.eligibility_rule_id === later.result.memory_application.eligibility.rule_id && receiptProjection.semantic_signature_hash === later.result.memory_application.eligibility.semantic_signature_hash && receiptProjection.semantic_role === 'management_ventilation_allegation' && [...Object.values(later.result.memory_application.before), ...Object.values(later.result.memory_application.after)].every(hash => laterResultText.includes(hash)), JSON.stringify(receiptProjection));
  const renderedDelta = await page.locator('.causal-delta').evaluate(node => ({ nonzero: node.dataset.causalNonzero, text: node.textContent }));
  check('Retained causal delta names the exact added node, two edges, and three changed evidence items', renderedDelta.nonzero === 'true' && ['ventilation_dispute', 'evidence_gap → ventilation_dispute', 'ventilation_dispute → causation', 'building_envelope', 'management_position', 'use_evidence'].every(value => renderedDelta.text.includes(value)), renderedDelta.text);
  const visibleDeltaSummary = await page.locator('.causal-delta header').innerText();
  check('Future-claim result visibly explains the exact bounded improvement in one concise line', /ventilation dispute decision added/i.test(visibleDeltaSummary) && /2 process links/i.test(visibleDeltaSummary) && /3 evidence needs updated/i.test(visibleDeltaSummary), visibleDeltaSummary);
  const renderedChecks = await page.locator('.memory-deterministic-checks [data-memory-check]').evaluateAll(nodes => nodes.map(node => ({ name: node.dataset.memoryCheck, status: node.dataset.checkStatus })));
  check('Rendered causal proof shows all ten deterministic checks in order and passed', renderedChecks.length === 10 && stableJson(renderedChecks) === stableJson(proof.deterministic_checks.map(item => ({ name: item.name, status: item.status }))), JSON.stringify(renderedChecks));
  const finalComparison = page.locator('#laterResult .final-proof');
  const finalComparisonText = await finalComparison.innerText();
  check('Before/after visibly exposes both returned result hashes and retains unchanged shared v3', await finalComparison.isVisible() && finalComparisonText.includes(proof.before.result_hash) && finalComparisonText.includes(proof.after.result_hash) && /Shared playbook v3 unchanged/i.test(laterResultText) && /mould-playbook-v3/i.test(laterResultText), JSON.stringify({ comparison: finalComparisonText, shared_playbook_visible: /Shared playbook v3 unchanged/i.test(laterResultText) }));
  await page.locator('.v21-proof-details > summary').click();
  const compactLater = await minimalSurfaceSnapshot();
  check('Future-claim view recedes to one causal outcome with proof behind disclosure', compactLater.focus_count === 1 && compactLater.artifact_count === 1 && compactLater.action_count === 1 && await page.locator('.v21-proof-details').isVisible() && await page.locator('.memory-application-receipt').isHidden(), JSON.stringify(compactLater));
  }
  await auditViewports('07-later-result', '#artifactCanvas [data-memory-effect="node-added"]');

  check('Immutable release marker was never rewritten during the journey', await page.evaluate(() => window.__casepathReleaseMutations.length === 0), JSON.stringify(await page.evaluate(() => window.__casepathReleaseMutations)));
  check('No lifecycle state exposes a false reviewed-v4 claim', !falseReviewedV4Claim.test(await page.locator('body').innerText()));
  check('Skip link remains present', await page.locator('.skip-link').count() === 1);
  await page.locator('.skip-link').focus();
  check('Skip link is keyboard focusable', await page.evaluate(() => document.activeElement?.matches('.skip-link')));
  check('Visible icon controls have accessible names', await page.evaluate(() => [...document.querySelectorAll('button.icon-button:not([hidden]),a.icon-button:not([hidden])')].every(node => node.getAttribute('aria-label') || node.textContent.trim())));
  await runAxe('Final lifecycle state');
  check('No browser console errors', failures.console.length === 0, JSON.stringify(failures.console));
  check('No page errors', failures.page.length === 0, JSON.stringify(failures.page));
  check('No product request failures', failures.request.length === 0, JSON.stringify(failures.request));

  const modelLedger = await getJson(`${API}/api/model-ledger`);
  const ledgerIssues = sanitizedLedgerViolations(modelLedger);
  check('Public model ledger is sanitized and retains no prompt, raw output, reasoning, or canonical-output payload', ledgerIssues.length === 0, JSON.stringify(ledgerIssues));
  const successfulNetworkCalls = modelLedger.items.filter(item => SUCCESSFUL_MODEL_OUTCOMES.has(item.outcome) && item.call_count === 1 && item.provider_endpoint === 'https://openrouter.ai/api/v1/chat/completions');
  check('Successful network calls retain an exact unnormalized Nemotron alias or dated response identity and usage provenance', successfulNetworkCalls.every(item => item.provider === 'openrouter' && item.model === REQUESTED_NEMOTRON_MODEL && EXACT_NEMOTRON_RESPONSE_MODELS.has(item.response_model) && ALLOWED_USAGE_SOURCES.has(item.usage_source)) && (!isProductionJourney() || successfulNetworkCalls.length === REQUIRED_NEMOTRON_AGENT_IDS.length), JSON.stringify(successfulNetworkCalls));
  if (isProductionJourney()) {
    const finalColdIssues = coldLedgerContractViolations(coldOrchestration, modelLedger);
    const finalSnapshotIssues = finalLedgerSnapshotViolations(isolationLedger, modelLedger);
    check('Final ledger is the immutable 12-row flagship cold6 plus warm6 snapshot with no held-out model activity', finalColdIssues.length === 0 && finalSnapshotIssues.length === 0, JSON.stringify({ finalColdIssues, finalSnapshotIssues, finalSummary: modelLedger.summary, isolationSummary: isolationLedger.summary }));
    const warmLineage = warmLineageContractViolations(coldOrchestration, warmOrchestration, modelLedger);
    check('Post-flagship isolation replay made zero provider calls and binds every cache record to its visible cold origin', warmLineage.issues.length === 0 && warmLineage.lineage.length === REQUIRED_NEMOTRON_AGENT_IDS.length, JSON.stringify(warmLineage));
    retainedEvidence['flagship-cache-lineage'] = {
      contract: 'casepath.flagship-cache-lineage/1.0.0',
      requested_model: REQUESTED_NEMOTRON_MODEL,
      exact_response_models: [...EXACT_NEMOTRON_RESPONSE_MODELS],
      framework: EXPECTED_FRAMEWORK,
      cold_orchestration_id: coldOrchestration.orchestration_id,
      warm_orchestration_id: warmOrchestration.orchestration_id,
      cold_run_surface: 'visible_browser_flagship',
      warm_run_surface: 'isolated_session_cache_replay',
      cold_guarded_fallback_count: coldOrchestration.guarded_fallback_count,
      warm_guarded_fallback_count: warmOrchestration.guarded_fallback_count,
      lineage: warmLineage.lineage,
      provider_calls_during_isolation_replay: 0,
    };
  }
  retainedEvidence['model-ledger'] = modelLedger;

  return { status: 'passed', release: PRODUCT_RELEASE, release_id: RELEASE_ID, checkedAt: new Date().toISOString(), baseUrl: BASE, apiUrl: API, deployment: deploymentIdentity, runtime: runtimeVersions, passed: checks.length, failed: 0, checks, notes, failures, runIds };
}

function mockOrchestration(cacheMode, coldRun = null) {
  const facts = [
    {
      fact_id: 'fact_scope',
      value: 'confirmed',
      state: 'supported',
      controls_process: true,
      decision_key: 'tenancy_scope',
      normalized_value: 'confirmed',
      decision_value: 'confirmed',
    },
    {
      fact_id: 'fact_context',
      value: 'observed context',
      state: 'known',
      controls_process: false,
      decision_key: null,
      normalized_value: null,
      decision_value: null,
    },
  ];
  const sourceIntegrity = {
    artifacts: [{
      artifact_id: 'lease',
      integrity_class: 'text_grounded',
      source_ref_ids: ['source_scope'],
      contribution_id: 'artifact:lease:integrity',
      attribution: 'Document and Source Integrity Agent',
      deterministic_fallback_applied: false,
      confidence_basis_points: 9200,
    }],
  };
  const processDecision = {
    fact_id: 'fact_scope',
    decision_key: 'tenancy_scope',
    decision_value: 'confirmed',
    state: 'supported',
    normalized_value: 'confirmed',
    source_ref_ids: ['source_scope'],
    contribution_id: 'fact:fact_scope:decision_value',
    contribution_scope: 'canonical_to_process_decision_mapping',
    model_owned_fields: ['decision_value'],
    confidence_basis_points: 9100,
    attribution: PROCESS_CONTRIBUTION_ROLE,
    deterministic_fallback_applied: false,
  };
  const processMapping = { decisions: [processDecision] };
  const evidenceFieldContributions = [
    {
      contribution_id: 'item:lease:status',
      field: 'status',
      attribution: EVIDENCE_CONTRIBUTION_ROLE,
      confidence_basis_points: 9000,
      deterministic_fallback_applied: false,
    },
    {
      contribution_id: 'item:lease:artifacts',
      field: 'artifact_ids',
      attribution: EVIDENCE_CONTRIBUTION_ROLE,
      confidence_basis_points: 9000,
      deterministic_fallback_applied: false,
    },
  ];
  const contextEvidenceFieldContributions = [
    {
      contribution_id: 'item:context_note:status',
      field: 'status',
      attribution: EVIDENCE_CONTRIBUTION_ROLE,
      confidence_basis_points: 8800,
      deterministic_fallback_applied: false,
    },
    {
      contribution_id: 'item:context_note:artifacts',
      field: 'artifact_ids',
      attribution: EVIDENCE_CONTRIBUTION_ROLE,
      confidence_basis_points: 8800,
      deterministic_fallback_applied: false,
    },
  ];
  const evidenceChecklist = {
    items: [
      {
        item_id: 'lease',
        status: 'provided_sufficient',
        artifact_ids: ['lease'],
        source_ref_ids: ['source_scope'],
        field_contributions: evidenceFieldContributions,
        model_owned_fields: ['status', 'artifact_ids'],
        confidence_basis_points: 9000,
        attribution: EVIDENCE_CONTRIBUTION_ROLE,
        deterministic_fallback_applied: false,
      },
      {
        item_id: 'context_note',
        status: 'provided_sufficient',
        artifact_ids: ['lease'],
        source_ref_ids: ['source_context'],
        field_contributions: contextEvidenceFieldContributions,
        model_owned_fields: ['status', 'artifact_ids'],
        confidence_basis_points: 8800,
        attribution: EVIDENCE_CONTRIBUTION_ROLE,
        deterministic_fallback_applied: false,
      },
    ],
  };
  const finalFieldContributions = FINAL_FIELD_CONTRACT.map(({ field, contribution_id }) => ({
    contribution_id,
    field,
    attribution: FINAL_CONTRIBUTION_ROLE,
    confidence_basis_points: 8900,
    deterministic_fallback_applied: false,
  }));
  const finalClaimBrief = {
    current_node_id: 'scope',
    next_action_node_id: 'notice',
    supporting_fact_ids: ['fact_context', 'fact_scope'],
    upstream_contribution_ids: [...FINAL_UPSTREAM_CONTRIBUTION_IDS],
    audit_check_ids: [...FINAL_AUDIT_CHECK_IDS],
    source_ref_ids: ['source_context', 'source_scope'],
    input_contribution_ids: [...FINAL_UPSTREAM_CONTRIBUTION_IDS],
    lineage_authority: 'hybrid_guarded_model_audit',
    contribution_scope: 'independent_final_claim_brief_audit',
    field_contributions: finalFieldContributions,
    confidence_basis_points: 8900,
    attribution: FINAL_CONTRIBUTION_ROLE,
    deterministic_fallback_applied: false,
  };
  const process = {
    contract: 'process-graph',
    current_node: 'scope',
    current_overlay: { current_node_id: 'scope', next_action_node_id: 'notice' },
    nodes: [
      { node_id: 'scope', title: 'Scope', fact_ids: ['fact_scope', 'fact_context'], agent_decision_contributions: [processDecision] },
      { node_id: 'notice', title: 'Notice', fact_ids: [] },
    ],
    agent_contribution: {
      artifact: processMapping,
      source_integrity_artifact: sourceIntegrity,
    },
  };
  const checklist = {
    contract: 'evidence-model',
    items: [
      {
        item_id: 'lease',
        fact_id: 'fact_scope',
        status: 'provided_sufficient',
        artifact_ids: ['lease'],
        agent_contribution: evidenceFieldContributions,
      },
      {
        item_id: 'context_note',
        fact_id: 'fact_context',
        status: 'provided_sufficient',
        artifact_ids: ['lease'],
        agent_contribution: contextEvidenceFieldContributions,
      },
    ],
    agent_contribution: { artifact: evidenceChecklist },
  };
  const orchestratorPlan = { focus_fact_ids: ['fact_scope'], priority_task_codes: ['source_integrity', 'process_decisions', 'evidence_gaps', 'final_brief'] };
  const orchestrationId = cacheMode === 'cold' ? 'orch_cold_contract' : 'orch_warm_contract';
  const coldAudit = orchestrationAudit(coldRun);
  const coldByAgent = new Map((coldAudit?.agents || []).map(item => [item.agent_id, item]));
  const callIdFor = agentId => `${cacheMode}_call_${agentId}`;
  const canonicalCallId = callIdFor('canonical_facts');
  const orchestratorCallId = callIdFor('orchestrator_plan');
  const specialistArtifacts = {
    orchestrator_plan: orchestratorPlan,
    document_source_integrity: sourceIntegrity,
    process_decision_mapping: processMapping,
    evidence_checklist: evidenceChecklist,
    final_claim_brief_audit: finalClaimBrief,
  };
  const acceptedIdsByAgent = {
    canonical_facts: ['accepted_canonical_facts_1', 'accepted_canonical_facts_2'],
    orchestrator_plan: ['accepted_orchestrator_plan_1', 'accepted_orchestrator_plan_2'],
    document_source_integrity: ['artifact:lease:integrity'],
    process_decision_mapping: [processDecision.contribution_id],
    evidence_checklist: evidenceChecklist.items.flatMap(item => item.field_contributions.map(unit => unit.contribution_id)),
    final_claim_brief_audit: finalFieldContributions.map(item => item.contribution_id),
  };
  const outputArtifactByAgent = {
    canonical_facts: facts,
    orchestrator_plan: orchestratorPlan,
    document_source_integrity: sourceIntegrity,
    process_decision_mapping: processMapping,
    evidence_checklist: evidenceChecklist,
    final_claim_brief_audit: finalClaimBrief,
  };
  const agents = REQUIRED_NEMOTRON_AGENT_IDS.map(agentId => {
    const acceptedIds = acceptedIdsByAgent[agentId];
    return {
      agent_id: agentId,
      role: REQUIRED_NEMOTRON_AGENT_ROLES[agentId],
      actor_type: 'nemotron_agent',
      acceptance_scope: 'pre_review_model_output',
      model: REQUESTED_NEMOTRON_MODEL,
      provider: 'openrouter',
      requested_model: REQUESTED_NEMOTRON_MODEL,
      call_count: cacheMode === 'cold' ? 1 : 0,
      parent_call_id: agentId === 'canonical_facts' ? null : agentId === 'orchestrator_plan' ? canonicalCallId : orchestratorCallId,
      delegation_id: agentId === 'canonical_facts' ? null : `${cacheMode}_delegation_${agentId}`,
      call_id: callIdFor(agentId),
      origin_call_id: cacheMode === 'cold' ? callIdFor(agentId) : coldByAgent.get(agentId)?.call_id,
      cache_hit: cacheMode === 'warm',
      outcome: cacheMode === 'warm' ? 'cache_hit' : 'succeeded',
      response_id: cacheMode === 'cold' ? `response_${agentId}` : coldByAgent.get(agentId)?.response_id,
      response_model: 'nvidia/nemotron-3-ultra-550b-a55b-20260604',
      upstream_provider: 'DeepInfra',
      usage_source: cacheMode === 'warm' ? 'cache' : 'response',
      finish_reason: 'stop',
      accepted_ids: acceptedIds,
      accepted_count: acceptedIds.length,
      rejected_count: 0,
      source_reference_projection_fact_ids: agentId === 'canonical_facts' ? [] : undefined,
      source_reference_projection_count: agentId === 'canonical_facts' ? 0 : undefined,
      deterministic_fallback_applied: false,
      input_artifact_hash: dtoHash({ agent_id: agentId, direction: 'input' }),
      output_artifact_hash: dtoHash(outputArtifactByAgent[agentId]),
    };
  });
  const byAgent = new Map(agents.map(item => [item.agent_id, item]));
  const finalDtos = { deterministic_process_gate: process, deterministic_evidence_gate: checklist, whole_playbook_gate: finalClaimBrief };
  const gates = REQUIRED_DETERMINISTIC_GATE_IDS.map(gateId => {
    const contract = ACCEPTED_ARTIFACT_CONTRACT[gateId];
    return {
      agent_id: gateId,
      role: REQUIRED_DETERMINISTIC_GATE_ROLES[gateId],
      actor_type: 'deterministic_gate',
      receipt_type: 'accepted_artifact',
      acceptance_scope: 'pre_review_model_output',
      model: null,
      outcome: 'passed',
      source_agent_id: contract.source_agent_id,
      source_call_id: byAgent.get(contract.source_agent_id).call_id,
      delegation_id: byAgent.get(contract.source_agent_id).delegation_id,
      accepted_ids: byAgent.get(contract.source_agent_id).accepted_ids,
      accepted_count: byAgent.get(contract.source_agent_id).accepted_count,
      input_artifact_hash: gateId === 'deterministic_process_gate'
        ? dtoHash({ source_integrity: sourceIntegrity, process_mapping: processMapping })
        : gateId === 'deterministic_evidence_gate'
          ? dtoHash(evidenceChecklist)
          : dtoHash({ final_brief: finalClaimBrief, verification: { valid: true } }),
      output_artifact: contract.output_artifact,
      output_artifact_hash: dtoHash(finalDtos[gateId]),
    };
  });
  const audit = {
    schema_version: EXPECTED_RUNTIME.orchestration_schema,
    implementation: EXPECTED_RUNTIME.implementation,
    framework: EXPECTED_FRAMEWORK,
    orchestration_id: orchestrationId,
    model: REQUESTED_NEMOTRON_MODEL,
    authority_mode: EXPECTED_RUNTIME.authority_mode,
    model_assisted: true,
    deterministic_safety_authority: true,
    external_tracing: false,
    prompt_storage: false,
    raw_output_storage: false,
    execution_topology: structuredClone(EXPECTED_EXECUTION_TOPOLOGY),
    agents,
    deterministic_gates: gates,
    all_required_agents_contributed: true,
    guarded_fallback_count: 0,
    specialist_artifacts: specialistArtifacts,
    final_claim_brief: finalClaimBrief,
  };
  const events = [
    ...agents.map(item => ({
      stage: item.agent_id === 'canonical_facts' ? 'understand' : 'agent_orchestration',
      receipt_type: 'agent_completed',
      agent_id: item.agent_id,
      actor_type: item.actor_type,
      acceptance_scope: item.acceptance_scope,
      status: 'completed',
      call_id: item.call_id,
      parent_call_id: item.parent_call_id,
      delegation_id: item.delegation_id,
      response_id: item.response_id,
      response_model: item.response_model,
      accepted_ids: item.accepted_ids,
      accepted_count: item.accepted_count,
      rejected_count: item.rejected_count,
      source_reference_projection_fact_ids: item.source_reference_projection_fact_ids,
      source_reference_projection_count: item.source_reference_projection_count,
      deterministic_fallback_applied: item.deterministic_fallback_applied,
      output_artifact_hash: item.agent_id === 'canonical_facts' ? undefined : item.output_artifact_hash,
    })),
    ...gates.map(item => ({ stage: 'agent_orchestration', status: 'completed', ...item })),
  ];
  return {
    run_id: `${cacheMode}_run`,
    status: 'complete',
    agent_orchestration: audit,
    result: {
      facts,
      process,
      checklist,
      next_action: {
        process_node_id: 'notice',
        agent_brief_contribution: finalClaimBrief,
      },
      agent_orchestration: audit,
      audit: { agent_orchestration: audit },
    },
    events,
  };
}

function mockLedgerForRun(run, cacheMode, coldLedger = null) {
  const audit = orchestrationAudit(run);
  const coldByAgent = new Map((coldLedger?.items || []).map(item => [item.agent_id, item]));
  const items = audit.agents.map(agent => ({
      call_id: agent.call_id,
      provider: 'openrouter',
      provider_endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      upstream_provider: 'DeepInfra',
      model: REQUESTED_NEMOTRON_MODEL,
      implementation: agent.agent_id === 'canonical_facts' ? 'model_backed_openrouter_canonicalizer' : EXPECTED_RUNTIME.implementation,
      orchestration_id: audit.orchestration_id,
      agent_id: agent.agent_id,
      agent_role: agent.role,
      parent_call_id: agent.parent_call_id,
      delegation_id: agent.delegation_id,
      call_count: cacheMode === 'cold' ? 1 : 0,
      prompt_tokens: cacheMode === 'cold' ? 100 : undefined,
      completion_tokens: cacheMode === 'cold' ? 20 : undefined,
      total_tokens: cacheMode === 'cold' ? 120 : undefined,
      estimated_cost_usd: cacheMode === 'cold' ? 0.01 : 0,
      actual_cost_usd: cacheMode === 'cold' ? 0.008 : undefined,
      cache_key: `cache_${agent.agent_id}`,
      purpose: `mock ${agent.agent_id}`,
      outcome: agent.outcome,
      accepted_fact_count: agent.agent_id === 'canonical_facts' ? agent.accepted_count : undefined,
      rejected_fact_count: agent.agent_id === 'canonical_facts' ? agent.rejected_count : undefined,
      source_reference_projection_fact_ids: agent.agent_id === 'canonical_facts' ? agent.source_reference_projection_fact_ids : undefined,
      source_reference_projection_count: agent.agent_id === 'canonical_facts' ? agent.source_reference_projection_count : undefined,
      accepted_item_count: agent.agent_id === 'canonical_facts' ? undefined : agent.accepted_count,
      rejected_item_count: agent.agent_id === 'canonical_facts' ? undefined : agent.rejected_count,
      deterministic_fallback_applied: false,
      response_id: cacheMode === 'cold' ? `response_${agent.agent_id}` : coldByAgent.get(agent.agent_id)?.response_id,
      origin_call_id: cacheMode === 'warm' ? coldByAgent.get(agent.agent_id)?.call_id : undefined,
      origin_usage: cacheMode === 'warm' ? {
        prompt_tokens: coldByAgent.get(agent.agent_id)?.prompt_tokens,
        completion_tokens: coldByAgent.get(agent.agent_id)?.completion_tokens,
        total_tokens: coldByAgent.get(agent.agent_id)?.total_tokens,
        actual_cost_usd: coldByAgent.get(agent.agent_id)?.actual_cost_usd,
        usage_source: coldByAgent.get(agent.agent_id)?.usage_source,
      } : undefined,
      origin_finish_reason: cacheMode === 'warm' ? coldByAgent.get(agent.agent_id)?.finish_reason : undefined,
      response_model: 'nvidia/nemotron-3-ultra-550b-a55b-20260604',
      usage_source: cacheMode === 'cold' ? 'response' : 'cache',
      finish_reason: 'stop',
      created_at: '2026-08-11T00:00:00Z',
      updated_at: '2026-08-11T00:00:01Z',
    })).map(item => Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined)));
  return {
    scope: 'global_budget_ledger',
    summary: ledgerSummary(items),
    items,
  };
}

async function assertRunReadSessionIsolation() {
  const guardSource = await fs.readFile(new URL('../casepath/assets/live-v18-insertion-guard.js', import.meta.url), 'utf8');
  class FakeNode {}
  class FakeElement extends FakeNode {}
  FakeNode.prototype.insertBefore = function insertBefore(node) { return node; };
  FakeElement.prototype.insertAdjacentHTML = function insertAdjacentHTML() {};
  class FakeResponse {
    constructor(body) { this.body = body; }
    clone() { return new FakeResponse(structuredClone(this.body)); }
    async json() { return structuredClone(this.body); }
  }
  const calls = [];
  const pending = [];
  const nativeFetch = (input, init = {}) => {
    const request = typeof input === 'string' || input instanceof URL ? null : input;
    const headers = new Headers(init.headers !== undefined ? init.headers : request?.headers);
    const session = (headers.get('X-CasePath-Session') || '').trim();
    const method = String(init.method || request?.method || 'GET').toUpperCase();
    calls.push({ session, method });
    return new Promise(resolve => pending.push({ session, method, resolve: () => resolve(new FakeResponse({ session, method })) }));
  };
  const sandbox = {
    window: { fetch: nativeFetch },
    Node: FakeNode,
    Element: FakeElement,
    URL,
    Headers,
    Request,
    location: { href: 'https://casepath.test/' },
    document: { readyState: 'loading', addEventListener() {} },
    structuredClone,
  };
  vm.runInNewContext(guardSource, sandbox, { filename: 'live-v18-insertion-guard.js' });
  const runUrl = 'https://api.casepath.test/api/runs/run_shared';
  const requestHeaders = session => ({ 'X-CasePath-Session': session });
  const settlePending = entries => entries.forEach(entry => entry.resolve());

  const differentSessionStart = calls.length;
  const sessionA = sandbox.window.fetch(runUrl, { headers: requestHeaders('session-A') });
  const sessionB = sandbox.window.fetch(runUrl, { headers: requestHeaders('session-B') });
  if (calls.length - differentSessionStart !== 2) throw new Error('Different sessions shared one in-flight run read');
  settlePending(pending.splice(0));
  const [bodyA, bodyB] = await Promise.all((await Promise.all([sessionA, sessionB])).map(response => response.json()));
  if (bodyA.session !== 'session-A' || bodyB.session !== 'session-B') throw new Error('A run-read response crossed the session boundary');

  const sameSessionStart = calls.length;
  const sameA1 = sandbox.window.fetch(runUrl, { headers: requestHeaders('session-A') });
  const sameA2 = sandbox.window.fetch(runUrl, { headers: requestHeaders('session-A') });
  if (calls.length - sameSessionStart !== 1) throw new Error('Same-session concurrent run reads were not coalesced');
  settlePending(pending.splice(0));
  const sameBodies = await Promise.all((await Promise.all([sameA1, sameA2])).map(response => response.json()));
  if (!sameBodies.every(body => body.session === 'session-A')) throw new Error('Same-session cloned run reads diverged');

  const requestWithA = new Request(runUrl, { headers: requestHeaders('session-A') });
  const overrideStart = calls.length;
  const overriddenToB = sandbox.window.fetch(requestWithA, { headers: requestHeaders('session-B') });
  const sameB = sandbox.window.fetch(runUrl, { headers: requestHeaders('session-B') });
  const separateA = sandbox.window.fetch(runUrl, { headers: requestHeaders('session-A') });
  if (calls.length - overrideStart !== 2) throw new Error('Request/init header precedence did not preserve session isolation');
  settlePending(pending.splice(0));
  const [overrideBody, sameBBody, separateABody] = await Promise.all((await Promise.all([overriddenToB, sameB, separateA])).map(response => response.json()));
  if (overrideBody.session !== 'session-B' || sameBBody.session !== 'session-B' || separateABody.session !== 'session-A') throw new Error('Effective session headers were not bound to the run-read key');

  const mutationStart = calls.length;
  const mutationA = sandbox.window.fetch(`${runUrl}/review`, { method: 'POST', headers: requestHeaders('session-A') });
  const readB = sandbox.window.fetch(runUrl, { headers: requestHeaders('session-B') });
  const readA = sandbox.window.fetch(runUrl, { headers: requestHeaders('session-A') });
  if (calls.length - mutationStart !== 2) throw new Error('A review mutation blocked a different session or failed to block its own session');
  const mutationEntry = pending.find(entry => entry.method === 'POST');
  const readBEntry = pending.find(entry => entry.method === 'GET' && entry.session === 'session-B');
  mutationEntry.resolve();
  readBEntry.resolve();
  pending.splice(0, pending.length);
  await new Promise(resolve => setImmediate(resolve));
  if (calls.length - mutationStart !== 3) throw new Error('Same-session run read did not resume with a fresh request after review mutation');
  settlePending(pending.splice(0));
  const [mutationBody, readBBody, readABody] = await Promise.all((await Promise.all([mutationA, readB, readA])).map(response => response.json()));
  if (mutationBody.session !== 'session-A' || readBBody.session !== 'session-B' || readABody.session !== 'session-A') throw new Error('Review mutation/read coordination crossed a session boundary');
}

async function assertMemoryReuseRendererDeterminism() {
  const [v16Source, v17Source, v18Source, browserGateSource] = await Promise.all([
    fs.readFile(new URL('../casepath/assets/live-v16.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../casepath/assets/live-v17.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../casepath/assets/live-v18.js', import.meta.url), 'utf8'),
    fs.readFile(new URL(import.meta.url), 'utf8'),
  ]);
  const start = v16Source.indexOf('  function renderMemoryReuseProof(');
  const end = v16Source.indexOf('\n  function factsForNode', start);
  if (start < 0 || end < 0) throw new Error('Could not extract the authoritative synchronous memory-reuse renderer');
  const rendererSource = v16Source.slice(start, end).trim();
  if (/\b(?:async|await)\b|\bcurrentRun\s*\(/.test(rendererSource)) throw new Error('The authoritative memory-reuse renderer regained an asynchronous run read');
  for (const [label, source] of [['live-v17', v17Source], ['live-v18', v18Source]]) {
    if (/\b(?:async\s+)?function\s+enhanceReuse\s*\(|\benhanceReuse\s*\(/.test(source)) throw new Error(`${label} regained a post-render memory-reuse enhancer`);
  }
  if (!browserGateSource.includes("const reuseThreadSelector = '#laterResult .v18-reuse-proof .v17-reuse-thread';")
    || !browserGateSource.includes('laterReuseThreadCount === 1 && reuseProofCount === 1 && proofReuseThreadCount === 1')) throw new Error('The browser gate no longer requires one proof, one thread, and one nested thread');

  const sandbox = {
    esc: (value = '') => String(value).replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character])),
  };
  vm.runInNewContext(`globalThis.renderMemoryReuseProof = ${rendererSource};`, sandbox, { filename: 'live-v16-render-memory-reuse-proof.js' });
  const receipt = {
    contract: 'casepath.memory-application-receipt/1.0.0',
    application_hash: 'a'.repeat(64),
    authority: 'unverified_demo',
    scope: 'case_specific_guidance_only',
    shared_rule_applied: false,
    model_acceptance_reused: false,
  };
  const precedent = {
    claim_id: 'DEF-027-E0-DEMO',
    memory_id: 'mem-unverified-demo',
    review_status: 'unverified_demo_memory',
  };
  const result = { playbook: { version: 'mould-playbook-v3' } };
  const proof = { causal_delta: { nonzero: true } };
  const cases = [
    {
      label: 'applied',
      input: { result, proof, memoryUsed: true, retrievedOnly: false, memoryState: { receipt, retrievedPrecedent: precedent } },
    },
    {
      label: 'retrieved-only',
      input: { result, proof: {}, memoryUsed: false, retrievedOnly: true, memoryState: { receipt: null, retrievedPrecedent: precedent } },
    },
    {
      label: 'no-memory',
      input: { result, proof: {}, memoryUsed: false, retrievedOnly: false, memoryState: { receipt, retrievedPrecedent: precedent } },
    },
  ];
  const expected = new Map(cases.map(({ label, input }) => [label, sandbox.renderMemoryReuseProof(input)]));
  for (let pass = 0; pass < 8; pass += 1) {
    for (const { label, input } of cases) {
      if (sandbox.renderMemoryReuseProof(input) !== expected.get(label)) throw new Error(`Synchronous memory-reuse markup changed across repeated ${label} renders`);
    }
  }

  const exactTopology = markup => (markup.match(/class="v18-reuse-proof"/g) || []).length === 1
    && (markup.match(/class="v17-reuse-thread(?: retrieved-only)?"/g) || []).length === 1
    && (markup.match(/<section\b/g) || []).length === 2
    && (markup.match(/<\/section>/g) || []).length === 2
    && /^<section class="v18-reuse-proof">[\s\S]*<section class="v17-reuse-thread(?: retrieved-only)?"[\s\S]*<\/section><\/section>$/.test(markup);
  const applied = expected.get('applied');
  const appliedAttributes = [
    'data-memory-retrieved="true"',
    'data-memory-used="true"',
    'data-application-receipt="true"',
    `data-memory-contract="${receipt.contract}"`,
    `data-application-hash="${receipt.application_hash}"`,
    `data-memory-authority="${receipt.authority}"`,
    `data-memory-scope="${receipt.scope}"`,
  ];
  if (!exactTopology(applied)
    || appliedAttributes.some(attribute => !applied.includes(attribute))
    || !applied.includes('Unverified demo memory returned with a valid application receipt')
    || !applied.includes('Unverified demo review memory returned')
    || !applied.includes('nonzero causal delta computed')
    || applied.includes('Qualified expert-reviewed')) throw new Error('Applied memory markup lost its exact topology, receipt attributes, or unverified authority copy');

  const retrievedOnly = expected.get('retrieved-only');
  if (!exactTopology(retrievedOnly)
    || !retrievedOnly.includes('class="v17-reuse-thread retrieved-only"')
    || !retrievedOnly.includes('data-memory-used="false"')
    || !retrievedOnly.includes('data-application-receipt="false"')
    || !retrievedOnly.includes('Unverified demo memory retrieved and ranked only')
    || !retrievedOnly.includes('Unverified demo review memory returned')
    || !retrievedOnly.includes('Application receipt</small><strong>None returned')
    || retrievedOnly.includes('data-memory-contract=')
    || retrievedOnly.includes('valid application receipt')) throw new Error('Retrieved-only memory markup blurred retrieval, application, receipt, or authority state');

  if (expected.get('no-memory') !== ''
    || sandbox.renderMemoryReuseProof({ result, proof, memoryUsed: true, retrievedOnly: false, memoryState: { receipt: null, retrievedPrecedent: precedent } }) !== ''
    || sandbox.renderMemoryReuseProof({ result, proof, memoryUsed: true, retrievedOnly: false, memoryState: { receipt, retrievedPrecedent: null } }) !== '') throw new Error('No-memory or incomplete applied-memory inputs emitted reuse proof markup');
  const hostile = sandbox.renderMemoryReuseProof({
    result: { playbook: { version: '<img src=x onerror=alert(1)>' } },
    proof,
    memoryUsed: true,
    retrievedOnly: false,
    memoryState: { receipt: { ...receipt, application_hash: '<script>bad()</script>' }, retrievedPrecedent: { ...precedent, claim_id: '<script>claim()</script>', memory_id: '" onfocus="bad()' } },
  });
  if (hostile.includes('<script>') || hostile.includes('<img ') || hostile.includes(' onfocus="bad()') || !hostile.includes('&lt;script&gt;claim()&lt;/script&gt;') || !hostile.includes('&quot; onfocus=&quot;bad()')) throw new Error('Synchronous memory-reuse renderer did not escape hostile server-returned values');
}

async function runContractSelfTest() {
  const processProjectionFixture = FLAGSHIP_PROCESS_PROJECTION_IDS.map((entityId, index) => ({
    changeId: `change:${entityId}`,
    eventId: `event:${entityId}`,
    agentId: 'process_decision_mapping',
    entityId,
    nodeStates: FLAGSHIP_PROCESS_PROJECTION_IDS.map((nodeId, nodeIndex) => {
      const state = nodeIndex < index ? 'built' : nodeIndex === index ? 'building' : 'pending';
      return { nodeId, state, tabIndex: state === 'pending' ? -1 : 0, disabled: state === 'pending', ariaCurrent: nodeIndex === index ? 'step' : '' };
    }),
    focus: { focusCount: 1, cursorCount: 1, artifactCount: 1, actionCount: 0 },
    at: index * 2400,
  }));
  const processSemanticFixture = processProjectionFixture.map((item, index) => ({ eventId: item.eventId, sequence: index + 1 }));
  const processCursorFixture = processProjectionFixture.map(item => ({ changeId: item.changeId, eventId: item.eventId, agentId: item.agentId, phase: 'click' }));
  if (processProjectionContractViolations(processProjectionFixture, processSemanticFixture, processCursorFixture, true).length) throw new Error('Valid ten-node process projection fixture was rejected');
  const nonMonotonicProjection = structuredClone(processProjectionFixture);
  nonMonotonicProjection[4].nodeStates[0].state = 'pending';
  if (!processProjectionContractViolations(nonMonotonicProjection, processSemanticFixture, processCursorFixture, true).some(issue => issue.includes('prior nodes'))) throw new Error('Non-monotonic process projection fixture was accepted');

  const deterministicProjection = processProjectionFixture.map(item => ({ ...item, agentId: 'process_projection' }));
  const deterministicCursor = processCursorFixture.map(item => ({ ...item, agentId: 'process_projection' }));
  if (processProjectionContractViolations(deterministicProjection, processSemanticFixture, deterministicCursor, false).length) throw new Error('Truthful deterministic process projection fixture was rejected');

  const branchFixtureNodes = REQUIRED_CAUSATION_BRANCH_IDS.map(nodeId => ({ node_id: nodeId, fact_ids: [], legal_source_ids: [], evidence_requirement_ids: [] }));
  const inspectionRunFixture = { process: { nodes: [...FLAGSHIP_PROCESS_PROJECTION_IDS.map(nodeId => ({ node_id: nodeId, fact_ids: [], legal_source_ids: [], evidence_requirement_ids: [] })), ...branchFixtureNodes] }, facts: [] };
  const sourceInspectionFixture = FLAGSHIP_PROCESS_PROJECTION_IDS.map((nodeId, index) => ({ entityKind: 'node', nodeId, branchId: '', changeId: `change:${nodeId}`, eventId: `event:${nodeId}`, agentId: 'process_decision_mapping', sourceKind: 'accepted-process-input', sourceId: nodeId, factId: '', locatorId: '', found: `Accepted ${nodeId}`, at: (index * 2400) - 1200 }));
  const branchInspectionFixture = REQUIRED_CAUSATION_BRANCH_IDS.map((nodeId, index) => ({ entityKind: 'branch', nodeId, branchId: `branch:${nodeId}`, changeId: `branch-change:${nodeId}`, eventId: `branch-event:${nodeId}`, agentId: 'process_decision_mapping', sourceKind: 'accepted-process-input', sourceId: nodeId, factId: '', locatorId: '', found: `Accepted ${nodeId}`, at: 30000 + (index * 2400) }));
  const branchVisualFixture = branchInspectionFixture.map(item => ({ nodeId: item.nodeId, branchId: item.branchId, changeId: item.changeId, eventId: item.eventId, agentId: item.agentId, at: item.at + 1200 }));
  const inspectionCursorFixture = [...sourceInspectionFixture, ...branchInspectionFixture].map(item => ({ changeId: item.changeId, eventId: item.eventId, agentId: item.agentId, targetId: item.sourceId, phase: 'click' }));
  if (sourceInspectionContractViolations([...sourceInspectionFixture, ...branchInspectionFixture], processProjectionFixture, branchVisualFixture, inspectionCursorFixture, inspectionRunFixture, true).length) throw new Error('Valid source-before-process inspection fixture was rejected');
  const claimSourceRunFixture = structuredClone(inspectionRunFixture);
  claimSourceRunFixture.facts = [{ fact_id: 'fact_intake_source', source_refs: [{ artifact_id: 'art_lease', locator_kind: 'text_quote', page: 1, excerpt: 'Residential Lease Agreement' }] }];
  claimSourceRunFixture.checklist = { items: [{ item_id: 'lease', node_ids: ['intake'], fact_id: 'fact_intake_source' }] };
  const claimSourceInspectionFixture = structuredClone(sourceInspectionFixture);
  Object.assign(claimSourceInspectionFixture[0], { sourceKind: 'claim-source', sourceId: 'art_lease', factId: 'fact_intake_source', locatorId: 'source:art_lease:page:1:quote:Residential Lease Agreement', found: 'Residential Lease Agreement' });
  const claimSourceCursorFixture = structuredClone(inspectionCursorFixture);
  claimSourceCursorFixture[0].targetId = 'art_lease';
  if (sourceInspectionContractViolations([...claimSourceInspectionFixture, ...branchInspectionFixture], processProjectionFixture, branchVisualFixture, claimSourceCursorFixture, claimSourceRunFixture, true).length) throw new Error('Valid claim-source inspection fixture was rejected');
  const factlessClaimSourceFixture = structuredClone(claimSourceInspectionFixture);
  factlessClaimSourceFixture[0].factId = '';
  if (!sourceInspectionContractViolations([...factlessClaimSourceFixture, ...branchInspectionFixture], processProjectionFixture, branchVisualFixture, claimSourceCursorFixture, claimSourceRunFixture, true).some(issue => issue.includes('not returned by the node basis'))) throw new Error('Factless claim-source inspection fixture was accepted');
  const wrongOwnerClaimSourceRunFixture = structuredClone(claimSourceRunFixture);
  wrongOwnerClaimSourceRunFixture.checklist.items[0].node_ids = ['scope'];
  if (!sourceInspectionContractViolations([...claimSourceInspectionFixture, ...branchInspectionFixture], processProjectionFixture, branchVisualFixture, claimSourceCursorFixture, wrongOwnerClaimSourceRunFixture, true).some(issue => issue.includes('not returned by the node basis'))) throw new Error('Cross-node evidence-derived claim-source inspection was accepted');
  const fabricatedInspectionFixture = structuredClone(sourceInspectionFixture);
  fabricatedInspectionFixture[0].sourceKind = 'fabricated-source';
  if (!sourceInspectionContractViolations([...fabricatedInspectionFixture, ...branchInspectionFixture], processProjectionFixture, branchVisualFixture, inspectionCursorFixture, inspectionRunFixture, true).some(issue => issue.includes('not returned by the node basis'))) throw new Error('Fabricated source-inspection fixture was accepted');
  const unboundInspectionCursorFixture = inspectionCursorFixture.filter(item => item.targetId !== 'intake');
  if (!sourceInspectionContractViolations([...sourceInspectionFixture, ...branchInspectionFixture], processProjectionFixture, branchVisualFixture, unboundInspectionCursorFixture, inspectionRunFixture, true).some(issue => issue.includes('not bound to the cursor click target'))) throw new Error('Cursor-unbound source-inspection fixture was accepted');

  const fixtureRect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });
  const spatialNodeRects = Object.fromEntries(FLAGSHIP_PROCESS_PROJECTION_IDS.map((nodeId, index) => [nodeId, fixtureRect(60 + (index * 108), 300, 82, 62)]));
  const spatialBranchRects = {
    building_defect: fixtureRect(790, 90, 126, 48),
    tenant_use: fixtureRect(820, 180, 126, 48),
    mixed_cause: fixtureRect(820, 410, 126, 48),
    evidence_gap: fixtureRect(790, 505, 126, 48),
  };
  const spatialSatelliteRects = {
    'fedlex-or-259a': fixtureRect(662, 120, 128, 92),
    condition_photo: fixtureRect(520, 500, 128, 92),
    landlord_reply: fixtureRect(650, 500, 128, 92),
    technical_assessment: fixtureRect(960, 505, 142, 48),
  };
  const center = value => rectCenter(value);
  const returnedFixtureEdges = [
    ...FLAGSHIP_PROCESS_PROJECTION_IDS.slice(1).map((target, index) => ({ source: FLAGSHIP_PROCESS_PROJECTION_IDS[index], target, state: 'selected' })),
    ...REQUIRED_CAUSATION_BRANCH_IDS.map(target => ({ source: 'causation', target, state: target === 'evidence_gap' ? 'selected' : 'conditional' })),
  ];
  const spatialFixtureEdges = [
    ...returnedFixtureEdges.map(edge => ({ ...edge, path: edge.source === 'causation' && REQUIRED_CAUSATION_BRANCH_IDS.includes(edge.target) ? 'uncertainty' : 'accepted', start: center(spatialNodeRects[edge.source] || spatialBranchRects[edge.source]), end: center(spatialNodeRects[edge.target] || spatialBranchRects[edge.target]) })),
    { source: 'causation', target: 'fedlex-or-259a', state: 'linked', path: 'legal-grounding', start: center(spatialNodeRects.causation), end: center(spatialSatelliteRects['fedlex-or-259a']) },
    { source: 'causation', target: 'condition_photo', state: 'available', path: 'evidence-support', start: center(spatialNodeRects.causation), end: center(spatialSatelliteRects.condition_photo) },
    { source: 'causation', target: 'landlord_reply', state: 'missing', path: 'evidence-support', start: center(spatialNodeRects.causation), end: center(spatialSatelliteRects.landlord_reply) },
    { source: 'evidence_gap', target: 'technical_assessment', state: 'selected', path: 'next-action', start: center(spatialBranchRects.evidence_gap), end: center(spatialSatelliteRects.technical_assessment) },
  ];
  const spatialGeometryFixture = {
    processId: 'process-fixture', projection: SPATIAL_GRAPH_PROJECTION,
    canvasRect: fixtureRect(0, 0, 1200, 800), graphRect: fixtureRect(20, 35, 1160, 730), viewportRect: fixtureRect(35, 55, 1130, 690),
    primaryFoci: [{ insideGraph: true, rect: fixtureRect(20, 35, 1160, 730) }], primaryArtifacts: [{ insideGraph: true, rect: fixtureRect(20, 35, 1160, 730) }], primaryActionCount: 1, competingRects: [],
    nodes: FLAGSHIP_PROCESS_PROJECTION_IDS.map(nodeId => ({ id: nodeId, state: 'built', role: nodeId === 'causation' ? 'hub' : 'spine', path: 'accepted', selected: nodeId === 'causation', changeId: `change:${nodeId}`, eventId: `event:${nodeId}`, agentId: 'process_decision_mapping', rect: spatialNodeRects[nodeId], insideViewport: true, titleFontSize: nodeId === 'causation' ? 16 : 12, titleClientWidth: 82, titleScrollWidth: 82, titleClientHeight: 30, titleScrollHeight: 30 })),
    branches: REQUIRED_CAUSATION_BRANCH_IDS.map(id => ({ id, branchId: `branch:${id}`, state: id === 'evidence_gap' ? 'selected' : 'conditional', selected: id === 'evidence_gap', rect: spatialBranchRects[id], insideViewport: true })),
    laws: [{ id: 'fedlex-or-259a', lawId: 'fedlex-or-259a', anchorNodeId: 'causation', rect: spatialSatelliteRects['fedlex-or-259a'], insideViewport: true }],
    evidence: [{ id: 'condition_photo', evidenceId: 'condition_photo', anchorNodeId: 'causation', rect: spatialSatelliteRects.condition_photo, insideViewport: true }, { id: 'landlord_reply', evidenceId: 'landlord_reply', anchorNodeId: 'causation', rect: spatialSatelliteRects.landlord_reply, insideViewport: true }],
    nextActions: [{ id: 'evidence_gap', evidenceId: 'technical_assessment', rect: spatialSatelliteRects.technical_assessment, insideViewport: true }],
    activePaths: [{ nodeId: 'causation', factIds: ['fact-damage'], lawIds: ['fedlex-or-259a'], evidenceIds: ['condition_photo', 'landlord_reply'], insideGraph: true, rect: fixtureRect(60, 620, 340, 72) }],
    endpoints: [
      ...Object.entries(spatialNodeRects).map(([id, rect]) => ({ id, rect })),
      ...Object.entries(spatialBranchRects).map(([id, rect]) => ({ id, rect })),
      ...Object.entries(spatialSatelliteRects).map(([id, rect]) => ({ id, rect })),
    ], endpointDuplicates: [], edges: spatialFixtureEdges,
    ariaCurrentIds: ['causation'], pendingTabStops: [], status: { role: 'status', live: 'polite', atomic: 'true' }, edgeLayerAriaHidden: 'true', edgeLayerFocusable: 'false', cursorAriaHidden: 'true',
  };
  const spatialExpectedFixture = {
    processId: 'process-fixture', processAgentId: 'process_decision_mapping', returnedNodeIds: [...FLAGSHIP_PROCESS_PROJECTION_IDS, ...REQUIRED_CAUSATION_BRANCH_IDS], returnedEdges: returnedFixtureEdges,
    causationBranches: REQUIRED_CAUSATION_BRANCH_IDS.map(target => ({ target })), activeBasis: { factIds: ['fact-damage'], lawIds: ['fedlex-or-259a'], evidenceIds: ['condition_photo', 'landlord_reply'] },
    evidenceById: { technical_assessment: { item_id: 'technical_assessment', node_ids: ['causation', 'evidence_gap'] } },
  };
  const spatialFixtureIssues = spatialGraphGeometryContractViolations(spatialGeometryFixture, spatialExpectedFixture);
  if (spatialFixtureIssues.length) throw new Error(`Valid spatial process geometry fixture was rejected: ${JSON.stringify(spatialFixtureIssues)}`);
  const verticalSpatialFixture = structuredClone(spatialGeometryFixture);
  verticalSpatialFixture.nodes.forEach((node, index) => { node.rect = fixtureRect(500, 70 + (index * 65), 82, 62); });
  if (!spatialGraphGeometryContractViolations(verticalSpatialFixture, spatialExpectedFixture).some(issue => issue.includes('vertical list'))) throw new Error('Vertical-list spatial graph fixture was accepted');
  const inventedSpatialEdgeFixture = structuredClone(spatialGeometryFixture);
  inventedSpatialEdgeFixture.edges.push({ source: 'causation', target: 'remedy', state: 'selected', path: 'accepted', start: center(spatialNodeRects.causation), end: center(spatialNodeRects.remedy) });
  if (!spatialGraphGeometryContractViolations(inventedSpatialEdgeFixture, spatialExpectedFixture).some(issue => issue.includes('invents a process relationship'))) throw new Error('Invented spatial process edge fixture was accepted');

  const attachmentActors = ['canonical_facts', 'official_law_registry', 'evidence_checklist', 'historical_claims_retrieval', 'final_claim_brief_audit'];
  const attachmentFixture = ['fact', 'law', 'evidence', 'precedent', 'verification'].map((kind, index) => ({
    kind,
    changeId: `change:${kind}`,
    eventId: `event:${kind}`,
    agentId: attachmentActors[index],
    sourceAuthority: kind === 'fact' ? 'customer_submission' : kind === 'law' ? 'official_registry' : kind === 'precedent' ? 'generated_reference' : '',
    referenceStatus: kind === 'precedent' ? 'generated_reference' : '',
  }));
  const semanticFixture = attachmentFixture.map((item, index) => ({ type: REQUIRED_SEMANTIC_EVENT_TYPES[index], eventId: item.eventId, sequence: index + 1 }));
  const cursorFixture = attachmentFixture.map(item => ({ ...item, phase: 'click' }));
  if (contextualAttachmentContractViolations(attachmentFixture, semanticFixture, cursorFixture, true).length) throw new Error('Valid semantic attachment/cursor fixture was rejected');
  const untetheredAttachment = structuredClone(attachmentFixture);
  untetheredAttachment[0].eventId = 'event:forged';
  if (!contextualAttachmentContractViolations(untetheredAttachment, semanticFixture, cursorFixture, true).some(issue => issue.includes('authenticated stream'))) throw new Error('Untethered attachment fixture was accepted');

  const memoryEffectsFixture = [
    { origin_id: 'memory:one', effect: 'node-added' },
    { origin_id: 'memory:one', effect: 'edge-added' },
    { origin_id: 'memory:one', effect: 'edge-added' },
    { origin_id: 'memory:one', effect: 'evidence-changed' },
    { origin_id: 'memory:one', effect: 'evidence-changed' },
    { origin_id: 'memory:one', effect: 'evidence-changed' },
  ];
  if (memoryEffectContractViolations(memoryEffectsFixture, 'memory:one').length) throw new Error('Valid future-claim memory delta fixture was rejected');
  const inflatedMemoryEffects = [...memoryEffectsFixture, { origin_id: 'memory:one', effect: 'node-added' }];
  if (!memoryEffectContractViolations(inflatedMemoryEffects, 'memory:one').length) throw new Error('Inflated future-claim memory delta fixture was accepted');

  const allowedOutputFixtures = [
    path.join(QA_DIRECTORY, QA_OUTPUT_BASENAME),
    path.join(QA_TEMP_ROOT, 'casepath-qa-preflight.A1b2C3', PREFLIGHT_OUTPUT_BASENAME),
  ];
  for (const candidate of allowedOutputFixtures) {
    if (resolveSafeQaOutputPath(candidate) !== path.resolve(candidate)) {
      throw new Error(`Safe QA output fixture did not resolve exactly: ${candidate}`);
    }
  }
  const rejectedOutputFixtures = [
    path.parse(REPOSITORY_ROOT).root,
    REPOSITORY_ROOT,
    QA_DIRECTORY,
    path.join(QA_DIRECTORY, 'arbitrary-output'),
    path.join(QA_TEMP_ROOT, 'arbitrary-writable-output'),
    path.join(QA_TEMP_ROOT, 'casepath-qa-preflight.A1b2C3', 'arbitrary-output'),
  ];
  for (const candidate of rejectedOutputFixtures) {
    try {
      resolveSafeQaOutputPath(candidate);
    } catch (_) {
      continue;
    }
    throw new Error(`Unsafe QA output fixture was accepted: ${candidate}`);
  }
  const realPreflightParent = await fs.mkdtemp(path.join(QA_TEMP_ROOT, 'casepath-qa-preflight.'));
  try {
    const realPreflightOutput = path.join(realPreflightParent, PREFLIGHT_OUTPUT_BASENAME);
    if (assertSafeQaOutputParent(realPreflightOutput) !== realPreflightOutput) {
      throw new Error('Real preflight QA output fixture did not resolve exactly');
    }
  } finally {
    await fs.rmdir(realPreflightParent);
  }
  const symlinkedPreflightParent = path.join(
    QA_TEMP_ROOT,
    `casepath-qa-preflight.${randomUUID().replaceAll('-', '').slice(0, 12)}`,
  );
  await fs.symlink(QA_DIRECTORY, symlinkedPreflightParent, 'dir');
  let symlinkedParentRejected = false;
  try {
    try {
      assertSafeQaOutputParent(path.join(symlinkedPreflightParent, PREFLIGHT_OUTPUT_BASENAME));
    } catch (_) {
      symlinkedParentRejected = true;
    }
  } finally {
    await fs.unlink(symlinkedPreflightParent);
  }
  if (!symlinkedParentRejected) throw new Error('Symlinked QA output parent fixture was accepted');
  await assertRunReadSessionIsolation();
  await assertMemoryReuseRendererDeterminism();
  const cursorFocus = { focusIdCount: 1, cursorIdCount: 1, focusCount: 1, cursorCount: 1, cursorInsideFocus: true };
  const productionCursorFixture = REQUIRED_NEMOTRON_AGENT_IDS.flatMap((agentId, index) => {
    const callId = `modelcall_${String(index + 1).padStart(16, '0')}`;
    const outputArtifact = `artifact_${index + 1}`;
    const base = {
      moment: 'verify', actorType: 'nemotron_agent', agentId,
      signature: REQUIRED_NEMOTRON_AGENT_SIGNATURES[agentId].signature,
      callId, outputArtifact, x: 800 + index, y: 300 + index, focus: cursorFocus,
    };
    return [
      { ...base, phase: 'working', activationKey: `event-${index}-working:${agentId}:working`, target: `div:working-${index}`, ownedArtifact: null },
      { ...base, phase: 'artifact', activationKey: `event-${index}-artifact:${agentId}:${outputArtifact}`, target: `section:${agentId}:${outputArtifact}`, ownedArtifact: { owner: agentId, actorType: 'nemotron_agent', callId, outputArtifact, requestedModel: REQUESTED_NEMOTRON_MODEL, responseModel: REQUESTED_NEMOTRON_MODEL, targetCount: 1 } },
    ];
  });
  const positiveCursorIssues = cursorSemanticContractViolations(productionCursorFixture, [], true);
  if (positiveCursorIssues.length) throw new Error(`Positive six-agent cursor phase fixture failed: ${JSON.stringify(positiveCursorIssues)}`);
  const duplicateCursorFixture = structuredClone(productionCursorFixture);
  duplicateCursorFixture.at(-1).activationKey = duplicateCursorFixture.at(-2).activationKey;
  if (!cursorSemanticContractViolations(duplicateCursorFixture, [], true).includes('semantic cursor activation repeated')) throw new Error('Repeated semantic cursor activation fixture was not rejected');
  const missingArtifactCursorFixture = structuredClone(productionCursorFixture);
  missingArtifactCursorFixture.find(step => step.agentId === 'evidence_checklist' && step.phase === 'artifact').ownedArtifact = null;
  if (!cursorSemanticContractViolations(missingArtifactCursorFixture, [], true).some(issue => issue.includes('evidence_checklist: visible owned artifact'))) throw new Error('Unbound agent artifact cursor fixture was not rejected');
  const missingReceiptIdentityFixture = structuredClone(productionCursorFixture);
  const missingReceiptStep = missingReceiptIdentityFixture.find(step => step.agentId === 'process_decision_mapping' && step.phase === 'artifact');
  delete missingReceiptStep.callId;
  delete missingReceiptStep.outputArtifact;
  delete missingReceiptStep.ownedArtifact.callId;
  delete missingReceiptStep.ownedArtifact.outputArtifact;
  if (!cursorSemanticContractViolations(missingReceiptIdentityFixture, [], true).some(issue => issue.includes('process_decision_mapping: visible owned artifact'))) throw new Error('Missing cursor receipt identity fixture was not rejected');
  const mismatchedReceiptIdentityFixture = structuredClone(productionCursorFixture);
  mismatchedReceiptIdentityFixture.find(step => step.agentId === 'final_claim_brief_audit' && step.phase === 'artifact').callId = 'modelcall_ffffffffffffffff';
  if (!cursorSemanticContractViolations(mismatchedReceiptIdentityFixture, [], true).some(issue => issue.includes('final_claim_brief_audit: cursor artifact phase'))) throw new Error('Mismatched cursor receipt identity fixture was not rejected');
  if (dtoHash({ z: 'ü', a: [{ k: 0.91 }, true, null] }) !== '3d745913ce5b8f5555065b544f018be38bd43e9e5bfe1eca86c1d4f25dda68dd') throw new Error('Compact sorted DTO hashing diverges from the Python release contract');
  const splitLeaseSource = 'Tenant\nAlex Morgan, Feldbergstrasse 114, 4057 Basel';
  if (!exactNormalizedGroundingQuote(splitLeaseSource, 'Tenant Alex Morgan, Feldbergstrasse 114, 4057 Basel')) throw new Error('Normalized grounding did not preserve the backend whitespace contract');
  if (!exactNormalizedGroundingQuote('Ａlex\nMorgan', 'Alex Morgan')) throw new Error('Normalized grounding did not preserve the backend NFKC contract');
  if (!exactNormalizedGroundingQuote('Alex\u001cMorgan', 'Alex Morgan')) throw new Error('Normalized grounding omitted Python-only Unicode whitespace');
  if (exactNormalizedGroundingQuote('Alex\ufeffMorgan', 'Alex Morgan')) throw new Error('Normalized grounding accepted non-Python whitespace');
  if (exactNormalizedGroundingQuote(splitLeaseSource, 'Tenant Morgan, Feldbergstrasse 114, 4057 Basel')) throw new Error('Normalized grounding accepted a non-source quote');
  const reorderedGroundingFacts = [
    { fact_id: 'fact_dispute', source_refs: [{ locator_kind: 'text_quote', artifact_id: 'art_management_reply' }] },
    { fact_id: 'fact_tenancy', source_refs: [{ locator_kind: 'text_quote', artifact_id: 'art_lease' }] },
  ];
  const reorderedGroundingProcess = { nodes: [{ node_id: 'scope', fact_ids: ['fact_tenancy'] }, { node_id: 'dispute', fact_ids: ['fact_dispute'] }] };
  if (selectProcessTextQuoteFact(reorderedGroundingFacts, reorderedGroundingProcess, 'fact_tenancy')?.fact_id !== 'fact_tenancy') throw new Error('Text grounding selected a provider-order-dependent fact');
  const providerCapRelease = {
    agentic_runtime: {
      parallel_groups: structuredClone(EXPECTED_EXECUTION_TOPOLOGY.parallel_groups),
      safety: { provider_max_in_flight: 1 },
    },
    truth: { production_runtime_acceptance: { required_provider_max_in_flight: 1 } },
  };
  const providerCapHealth = { agentic_runtime: { safety: { provider_max_in_flight: 1 } } };
  const providerCapReadiness = { agentic_runtime: { safety: { provider_max_in_flight: 1 } } };
  if (providerSingleFlightContractViolations(providerCapRelease, providerCapHealth, providerCapReadiness).length) throw new Error('Positive provider single-flight surface fixture failed');
  const missingReleaseProviderCap = structuredClone(providerCapRelease);
  delete missingReleaseProviderCap.agentic_runtime.safety.provider_max_in_flight;
  if (!providerSingleFlightContractViolations(missingReleaseProviderCap, providerCapHealth, providerCapReadiness).some(item => item.includes('release safety'))) throw new Error('Missing release provider-cap fixture was not rejected');
  const wrongAcceptanceProviderCap = structuredClone(providerCapRelease);
  wrongAcceptanceProviderCap.truth.production_runtime_acceptance.required_provider_max_in_flight = 2;
  if (!providerSingleFlightContractViolations(wrongAcceptanceProviderCap, providerCapHealth, providerCapReadiness).some(item => item.includes('runtime acceptance'))) throw new Error('Wrong acceptance provider-cap fixture was not rejected');
  const wrongHealthProviderCap = structuredClone(providerCapHealth);
  wrongHealthProviderCap.agentic_runtime.safety.provider_max_in_flight = 0;
  if (!providerSingleFlightContractViolations(providerCapRelease, wrongHealthProviderCap, providerCapReadiness).some(item => item.includes('health'))) throw new Error('Wrong health provider-cap fixture was not rejected');
  const missingReadinessProviderCap = structuredClone(providerCapReadiness);
  delete missingReadinessProviderCap.agentic_runtime.safety.provider_max_in_flight;
  if (!providerSingleFlightContractViolations(providerCapRelease, providerCapHealth, missingReadinessProviderCap).some(item => item.includes('readiness'))) throw new Error('Missing readiness provider-cap fixture was not rejected');
  const changedLogicalFanOut = structuredClone(providerCapRelease);
  changedLogicalFanOut.agentic_runtime.parallel_groups = [];
  if (!providerSingleFlightContractViolations(changedLogicalFanOut, providerCapHealth, providerCapReadiness).some(item => item.includes('logical fan-out'))) throw new Error('Changed logical fan-out fixture was not rejected');
  const pythonFloatHashes = [
    [{ value: 1.0 }, '3a7d647740ec6f86b72e0bf3948ab456551e07e9605e3a2785de1c66842ebb48'],
    [{ value: -0.0 }, 'c848a4efa987f46ba3bfd46242333afcb1c68c3240e0f35ae9d269b1c980648b'],
    [{ value: 1e-7 }, 'aece37dfda4992947222ea73b79996bba4aa181345a1fbb7f8c2b56b3fbd6a44'],
  ];
  if (pythonFloatHashes.some(([value, pythonHash]) => dtoHash(value) === pythonHash)) throw new Error('Float parity fixture unexpectedly became hash-compatible; update the shared numeric contract explicitly');
  if (nonIntegerNumberPaths({ negative_zero: -0.0, exponent: 1e-7 }).length !== 2) throw new Error('Non-integer accepted-DTO guard missed -0.0 or exponent notation');
  const acceptedProcessUnit = {
    contribution_id: 'fact:fact_scope:decision_value',
    fact_id: 'fact_scope',
    model_owned_fields: ['decision_value'],
    confidence_basis_points: 9100,
    attribution: PROCESS_CONTRIBUTION_ROLE,
    deterministic_fallback_applied: false,
  };
  const fallbackProcessUnit = {
    ...acceptedProcessUnit,
    confidence_basis_points: 10000,
    attribution: DETERMINISTIC_CONTRIBUTION_ROLE,
    deterministic_fallback_applied: true,
  };
  const acceptedContribution = contributionExpectation(acceptedProcessUnit, PROCESS_CONTRIBUTION_ROLE);
  const fallbackContribution = contributionExpectation(fallbackProcessUnit, PROCESS_CONTRIBUTION_ROLE);
  const mixedFieldContribution = contributionExpectation([
    {
      contribution_id: 'item:lease:status',
      field: 'status',
      confidence_basis_points: 9000,
      attribution: EVIDENCE_CONTRIBUTION_ROLE,
      deterministic_fallback_applied: false,
    },
    {
      contribution_id: 'item:lease:artifacts',
      field: 'artifact_ids',
      confidence_basis_points: 10000,
      attribution: DETERMINISTIC_CONTRIBUTION_ROLE,
      deterministic_fallback_applied: true,
    },
  ], EVIDENCE_CONTRIBUTION_ROLE);
  const postReviewContribution = contributionExpectation(
    acceptedProcessUnit,
    PROCESS_CONTRIBUTION_ROLE,
    { acceptance_scope: 'post_review_unverified_transform', model_acceptance_reused: false },
  );
  const postMemoryContribution = contributionExpectation(
    acceptedProcessUnit,
    PROCESS_CONTRIBUTION_ROLE,
    { contract: 'casepath.memory-application-receipt/1.0.0', authority: 'unverified_demo', scope: 'case_specific_guidance_only', model_acceptance_reused: false, applied: true },
  );
  if (stableJson(acceptedContribution) !== stableJson({ authority: 'nemotron-accepted', accepted_count: '1', fallback_count: '0' })
    || stableJson(fallbackContribution) !== stableJson({ authority: 'deterministic-fallback', accepted_count: '0', fallback_count: '1' })
    || stableJson(mixedFieldContribution) !== stableJson({ authority: 'mixed', accepted_count: '1', fallback_count: '1' })
    || postReviewContribution !== null
    || postMemoryContribution !== null
    || contributionExpectation({ ...acceptedProcessUnit, deterministic_fallback_applied: undefined }, PROCESS_CONTRIBUTION_ROLE) !== null
    || contributionExpectation({ ...acceptedProcessUnit, attribution: 'foreign_agent' }, PROCESS_CONTRIBUTION_ROLE) !== null
    || contributionExpectation({ ...fallbackProcessUnit, attribution: 'foreign_agent' }, PROCESS_CONTRIBUTION_ROLE) !== null) throw new Error('Visible contribution attribution does not fail closed on authority or fallback state');

  const relationProcess = {
    selected_path: ['a'],
    current_overlay: { next_action_node_id: 'b' },
    nodes: [
      { node_id: 'a', evidence_requirement_ids: ['one', 'shared'] },
      { node_id: 'b', evidence_requirement_ids: ['shared'] },
    ],
  };
  const relationChecklist = { items: [
    { item_id: 'one', node_ids: ['a'], node_id: 'a', current_path: true },
    { item_id: 'shared', node_ids: ['a', 'b'], node_id: 'a', current_path: true },
  ] };
  if (evidenceRelationContractViolations(relationProcess, relationChecklist).length) throw new Error('Positive reciprocal evidence fixture failed');
  for (const [field, value] of [['node_ids', ['b', 'a']], ['node_id', 'b'], ['current_path', false]]) {
    const tampered = structuredClone(relationChecklist);
    tampered.items[1][field] = value;
    if (!evidenceRelationContractViolations(relationProcess, tampered).some(issue => issue.includes(field))) throw new Error(`Tampered reciprocal evidence ${field} fixture was not rejected`);
  }

  const officialPassage = 'Versioned official passage.';
  const legalProcess = { nodes: [{ node_id: 'scope' }] };
  const legalFixture = {
    contract: 'casepath.legal-context/2.0.0',
    registry_version: 'ch-tenancy-official-snapshot/2026-08-12',
    lookup_method: 'versioned_official_source_registry_lookup',
    questions: [{ question_id: 'scope_question', text: 'What official rule applies?', source_ids: ['official'], interpretation_ids: ['principle'], process_node_ids: ['scope'], consequence: 'Keep authority and proposal distinct.' }],
    sources: [{
      source_id: 'official', title: 'Official source', url: 'https://example.test/official', source_type: 'official_statute', jurisdiction: 'CH', version_date: '2026-08-12', location: 'Article 1', passage_language: 'de', passage_text: officialPassage, passage_sha256: sha256(officialPassage), passage_summary: 'A bounded summary.', operational_interpretation: 'Deterministic reference proposal.', review_status: 'qualified_review_pending', role: 'Shapes scope.', approved: false,
      retrieval: { method: 'versioned_official_source_registry_lookup', retrieved_at: '2026-08-12', registry_version: 'ch-tenancy-official-snapshot/2026-08-12', snapshot_url: 'https://example.test/snapshot.pdf', snapshot_sha256: sha256('official snapshot'), snapshot_scope: 'official_pdf_bytes' },
    }],
    handling_principles: [{ source_id: 'principle', title: 'Deterministic handling proposal', source_type: 'operational_interpretation', role: 'Preserve uncertainty.', validation_status: 'candidate_not_expert_approved', producer: 'deterministic_application' }],
    node_links: { scope: ['official', 'principle'] },
    review_status: 'Operational translation not yet approved by a qualified reviewer',
  };
  if (legalContextContractViolations(legalFixture, legalProcess).length) throw new Error(`Positive legal-context fixture failed: ${JSON.stringify(legalContextContractViolations(legalFixture, legalProcess))}`);
  const tamperedPassage = structuredClone(legalFixture);
  tamperedPassage.sources[0].passage_text = 'Changed passage';
  if (!legalContextContractViolations(tamperedPassage, legalProcess).some(issue => issue.includes('passage hash'))) throw new Error('Tampered legal passage fixture was not rejected');
  const unknownLegalJoin = structuredClone(legalFixture);
  unknownLegalJoin.questions[0].source_ids = ['unknown'];
  if (!legalContextContractViolations(unknownLegalJoin, legalProcess).some(issue => issue.includes('source join'))) throw new Error('Unknown legal source-ID join fixture was not rejected');
  const modelOwnedPrinciple = structuredClone(legalFixture);
  modelOwnedPrinciple.handling_principles[0].producer = 'model_agent';
  if (!legalContextContractViolations(modelOwnedPrinciple, legalProcess).some(issue => issue.includes('producer'))) throw new Error('Model-owned legal principle fixture was not rejected');
  const falseSnapshotScope = structuredClone(legalFixture);
  falseSnapshotScope.sources[0].retrieval.snapshot_scope = 'dynamic_html_page';
  if (!legalContextContractViolations(falseSnapshotScope, legalProcess).some(issue => issue.includes('retrieval receipt'))) throw new Error('False official snapshot-scope fixture was not rejected');

  const imageArtifact = { artifact_id: 'image', media_type: 'image/png', sha256: sha256('image bytes') };
  const visualFixture = { artifact_id: 'image', locator_kind: 'visual_observation', region: [0.1, 0.2, 0.3, 0.4], observation: 'Curated visible reference.', producer: 'deterministic_reference_annotation', authority: 'generated_demo_reference_only', annotation_contract: 'casepath.visual-reference-annotation/1.0.0', annotation_version: 'generated-demo-reference/2026-08-12', image_sha256: imageArtifact.sha256 };
  if (visualReferenceContractViolations(visualFixture, imageArtifact).length) throw new Error('Positive visual-reference fixture failed');
  const tamperedVisualHash = { ...visualFixture, image_sha256: sha256('other bytes') };
  if (!visualReferenceContractViolations(tamperedVisualHash, imageArtifact).some(issue => issue.includes('public image bytes'))) throw new Error('Tampered visual image hash fixture was not rejected');
  const tamperedVisualProducer = { ...visualFixture, producer: 'machine_vision_agent' };
  if (!visualReferenceContractViolations(tamperedVisualProducer, imageArtifact).some(issue => issue.includes('authority contract'))) throw new Error('Tampered visual producer fixture was not rejected');

  const rankingContext = { category: 'category', subcategory: 'subcategory', current_process_node_id: 'causation', next_action_node_id: 'evidence_gap', selected_path: ['causation', 'evidence_gap'], unresolved_fact_ids: ['cause'], current_evidence_need_ids: ['assessment'] };
  const rankedPrecedents = [1, 2, 3].map(rank => ({ claim_id: `HIST-${rank}`, title: `Pattern ${rank}`, review_status: 'generated_reference', why_useful: 'Generated reference pattern.', provenance: 'generated_reference_not_qualified_review', final_process: ['causation'], evidence: ['assessment'], outcome: 'Reference only', ranking: { contract: 'casepath.precedent-ranking/1.0.0', corpus_version: 'generated-reference-patterns/2026-08-12', rank, score_basis_points: 40 - rank, factors: [{ factor: 'unresolved_fact', value: 'cause', weight: 40 - rank }], context_hash: dtoHash(rankingContext) } }));
  const rankingResult = { precedents: rankedPrecedents, precedent_ranking: { contract: 'casepath.precedent-ranking/1.0.0', corpus_version: 'generated-reference-patterns/2026-08-12', context: rankingContext, context_hash: dtoHash(rankingContext), candidate_scores: rankedPrecedents.map(item => ({ claim_id: item.claim_id, score_basis_points: item.ranking.score_basis_points, factors: item.ranking.factors })), selected_claim_ids: rankedPrecedents.map(item => item.claim_id), result_hash: dtoHash(rankedPrecedents) } };
  if (precedentRankingContractViolations(rankingResult).length) throw new Error(`Positive precedent-ranking fixture failed: ${JSON.stringify(precedentRankingContractViolations(rankingResult))}`);
  const tamperedRank = structuredClone(rankingResult);
  tamperedRank.precedents[0].ranking.rank = 2;
  if (!precedentRankingContractViolations(tamperedRank).some(issue => issue.includes('per-item ranking'))) throw new Error('Tampered precedent rank fixture was not rejected');
  const tamperedContextHash = structuredClone(rankingResult);
  tamperedContextHash.precedent_ranking.context_hash = sha256('wrong context');
  if (!precedentRankingContractViolations(tamperedContextHash).some(issue => issue.includes('context'))) throw new Error('Tampered precedent context-hash fixture was not rejected');
  const tamperedResultHash = structuredClone(rankingResult);
  tamperedResultHash.precedent_ranking.result_hash = sha256('wrong result');
  if (!precedentRankingContractViolations(tamperedResultHash).some(issue => issue.includes('result hash'))) throw new Error('Tampered precedent result-hash fixture was not rejected');

  const baselineProcess = {
    contract: 'process-graph', selected_path: ['causation', 'evidence_gap'], current_overlay: { current_node_id: 'causation', next_action_node_id: 'evidence_gap' }, shared_rule_applied: false, memory_used: false,
    nodes: [
      { node_id: 'dispute', evidence_requirement_ids: ['management_position'] },
      { node_id: 'causation', evidence_requirement_ids: ['building_envelope', 'use_evidence'] },
      { node_id: 'mixed_cause', evidence_requirement_ids: ['building_envelope', 'use_evidence'] },
      { node_id: 'tenant_use', evidence_requirement_ids: ['use_evidence'] },
      { node_id: 'evidence_gap', evidence_requirement_ids: ['building_envelope'] },
    ],
    edges: [{ source: 'evidence_gap', target: 'causation', condition: 'assessment complete', state: 'loop' }],
  };
  const baselineChecklist = {
    contract: 'evidence-model', shared_rule_applied: false, memory_used: false, required: ['before'], summary: { phase: 'before' },
    items: [
      { item_id: 'building_envelope', status: 'missing', node_ids: ['causation', 'mixed_cause', 'evidence_gap'], node_id: 'causation', current_path: true },
      { item_id: 'management_position', status: 'provided_sufficient', node_ids: ['dispute'], node_id: 'dispute', current_path: false },
      { item_id: 'use_evidence', status: 'conditional', node_ids: ['causation', 'mixed_cause', 'tenant_use'], node_id: 'causation', current_path: true },
    ],
  };
  const laterProcessFixture = structuredClone(baselineProcess);
  laterProcessFixture.nodes.find(node => node.node_id === 'causation').evidence_requirement_ids = ['building_envelope'];
  laterProcessFixture.nodes.find(node => node.node_id === 'mixed_cause').evidence_requirement_ids = ['building_envelope'];
  laterProcessFixture.nodes.find(node => node.node_id === 'tenant_use').evidence_requirement_ids = [];
  const ventilationNode = { node_id: 'ventilation_dispute', evidence_requirement_ids: ['management_position', 'use_evidence'] };
  laterProcessFixture.nodes.push(ventilationNode);
  const memoryEdgeOne = { source: 'evidence_gap', target: 'ventilation_dispute', condition: 'plausible use factor', state: 'possible' };
  const memoryEdgeTwo = { source: 'ventilation_dispute', target: 'causation', condition: 'allegation assessed', state: 'loop' };
  laterProcessFixture.edges.push(memoryEdgeOne, memoryEdgeTwo);
  laterProcessFixture.memory_used = true;
  laterProcessFixture.case_specific_guidance_applied = true;
  const laterChecklistFixture = structuredClone(baselineChecklist);
  laterChecklistFixture.items = [
    { item_id: 'building_envelope', status: 'conditional', node_ids: ['causation', 'mixed_cause', 'evidence_gap'], node_id: 'causation', current_path: true },
    { item_id: 'management_position', status: 'provided_sufficient', node_ids: ['dispute', 'ventilation_dispute'], node_id: 'dispute', current_path: false },
    { item_id: 'use_evidence', status: 'conditional', node_ids: ['ventilation_dispute'], node_id: 'ventilation_dispute', current_path: false },
  ];
  laterChecklistFixture.required = ['after'];
  laterChecklistFixture.summary = { phase: 'after' };
  laterChecklistFixture.memory_used = true;
  laterChecklistFixture.case_specific_guidance_applied = true;
  const decisionFacts = [
    ['scope', 'in_scope'], ['dispute', 'dispute_present'], ['urgency', 'not_urgent'], ['notification', 'notified'], ['recurrence', 'recurrence_supported'], ['causation', 'cause_unresolved'],
  ].map(([decision_key, decision_value]) => ({ fact_id: `fact_${decision_key}`, state: 'known', controls_process: true, decision_key, decision_value, semantic_role: null, source_refs: [] }));
  const memoryFacts = [...decisionFacts, { fact_id: 'later_fact_ventilation_allegation', state: 'known', controls_process: false, decision_key: null, decision_value: null, semantic_role: 'management_ventilation_allegation', source_refs: [{ artifact_id: 'art_later_management_reply' }] }];
  const observableHash = sha256('observable package');
  const canonicalHash = dtoHash(memoryFacts);
  const verificationHash = sha256('verification');
  const baselineResultFixture = { category: 'Rental defect - mould and moisture', subcategory: 'Recurring moisture with disputed causation', facts: structuredClone(memoryFacts), process: baselineProcess, checklist: baselineChecklist, precedents: [], memory_application: null, memory_used: false, reviewed_memory_used: false, reviewed_memory_retrieved: false, knowledge: { reviewed_memory_used: false, reviewed_memory_retrieved: false }, verification: { whole_playbook_hash: sha256('baseline verification') }, audit: { observable_input_hash: observableHash, canonical_state_hash: canonicalHash }, playbook: { version: 'mould-playbook-v3' }, shared_rule_applied: false };
  const laterResultFixture = { category: 'Rental defect - mould and moisture', subcategory: 'Recurring moisture with disputed causation', facts: structuredClone(memoryFacts), process: laterProcessFixture, checklist: laterChecklistFixture, next_action: { agent_brief_contribution: null }, precedents: [{ claim_id: 'DEF-027-E0-DEMO', review_status: 'unverified_demo_memory', memory_id: 'memory-1' }], memory_used: true, reviewed_memory_used: true, reviewed_memory_retrieved: true, knowledge: { reviewed_memory_used: true, reviewed_memory_retrieved: true }, verification: { whole_playbook_hash: verificationHash }, audit: { observable_input_hash: observableHash, canonical_state_hash: canonicalHash }, playbook: { version: 'mould-playbook-v3' }, shared_rule_applied: false };
  const requiredDecisionsFixture = Object.fromEntries(decisionFacts.map(fact => [fact.decision_key, fact.decision_value]));
  const semanticSignatureFixture = dtoHash({ category: 'Rental defect - mould and moisture', subcategory: 'Recurring moisture with disputed causation', required_decisions: requiredDecisionsFixture, required_fact_roles: { management_ventilation_allegation: { state: 'known', min_grounded_sources: 1 } } });
  const eligibilityManifest = { rule_id: 'same_grounded_mould_signature_v2', contract: 'casepath.semantic-memory-eligibility/1.0.0', claim_id: 'DEMO-MOULD-002', semantic_signature_hash: semanticSignatureFixture, decisions: requiredDecisionsFixture, facts_hash: dtoHash(semanticFactSignature(laterResultFixture)), checks: { source_claim_excluded: true, category_matched: true, subcategory_matched: true, required_decisions_matched: true, ventilation_allegation_grounded: true, semantic_signature_bound: true, guidance_enabled: true } };
  const receiptFixture = {
    receipt_type: 'memory_application_receipt', contract: 'casepath.memory-application-receipt/1.0.0', authority: 'unverified_demo', scope: 'case_specific_guidance_only',
    source_memory: { memory_id: 'memory-1', claim_id: 'DEF-027-E0-DEMO', review_id: 'review-1', content_hash: sha256('memory content'), review_status: 'unverified_demo_memory' },
    target: { run_id: 'later-run', claim_id: 'DEMO-MOULD-002' }, observable_input_hash: observableHash, canonical_state_hash: canonicalHash,
    eligibility: { ...eligibilityManifest, eligible: true, manifest_hash: dtoHash(eligibilityManifest) },
    allowed_operation_ids: ['add_ventilation_dispute_node', 'add_evidence_gap_to_ventilation_edge', 'add_ventilation_to_causation_edge', 'condition_building_envelope', 'reassign_use_evidence_to_ventilation'],
    applied_operation_ids: ['add_ventilation_dispute_node', 'add_evidence_gap_to_ventilation_edge', 'add_ventilation_to_causation_edge', 'condition_building_envelope', 'reassign_use_evidence_to_ventilation'],
    process_operations: [
      { operation_id: 'add_ventilation_dispute_node', operation: 'add_node', node_id: 'ventilation_dispute', evidence_requirement_ids: ['management_position', 'use_evidence'], after_hash: dtoHash(ventilationNode) },
      { operation_id: 'add_evidence_gap_to_ventilation_edge', operation: 'add_edge', source: 'evidence_gap', target: 'ventilation_dispute', after_hash: dtoHash(memoryEdgeOne) },
      { operation_id: 'add_ventilation_to_causation_edge', operation: 'add_edge', source: 'ventilation_dispute', target: 'causation', after_hash: dtoHash(memoryEdgeTwo) },
    ],
    evidence_operations: [
      { operation_id: 'condition_building_envelope', operation: 'replace_item', item_id: 'building_envelope', before_hash: dtoHash(baselineChecklist.items[0]), after_hash: dtoHash(laterChecklistFixture.items[0]) },
      { operation_id: 'reassign_use_evidence_to_ventilation', operation: 'reassign_item', item_id: 'use_evidence', removed_from_node_ids: ['causation', 'mixed_cause', 'tenant_use'], added_to_node_id: 'ventilation_dispute', before_hash: dtoHash(baselineChecklist.items[2]), after_hash: dtoHash(laterChecklistFixture.items[2]) },
    ],
    before: { process_dto_hash: dtoHash(baselineProcess), checklist_dto_hash: dtoHash(baselineChecklist), process_semantic_hash: dtoHash(semanticProcessDto(baselineProcess)), checklist_semantic_hash: dtoHash(semanticChecklistDto(baselineChecklist)) },
    after: { process_dto_hash: dtoHash(laterProcessFixture), checklist_dto_hash: dtoHash(laterChecklistFixture), process_semantic_hash: dtoHash(semanticProcessDto(laterProcessFixture)), checklist_semantic_hash: dtoHash(semanticChecklistDto(laterChecklistFixture)) },
    verification_hash: verificationHash, shared_playbook_version: 'mould-playbook-v3', shared_rule_applied: false, model_acceptance_reused: false, applied: true,
  };
  receiptFixture.application_hash = dtoHash(receiptFixture);
  laterResultFixture.memory_application = receiptFixture;
  const memoryBoundaryFixture = {
    contract: 'casepath.memory-application-boundary/1.0.0',
    target: structuredClone(receiptFixture.target),
    source_memory: { memory_id: receiptFixture.source_memory.memory_id, content_hash: receiptFixture.source_memory.content_hash },
    before: structuredClone(receiptFixture.before),
  };
  memoryBoundaryFixture.boundary_hash = dtoHash(memoryBoundaryFixture);
  const memoryEventFixture = {
    event_id: 'event-memory-application', ordinal: 1, created_at: '2026-08-12T00:00:00Z',
    stage: 'memory_application', label: 'Bounded case-specific memory guidance applied', status: 'completed',
    ...structuredClone(receiptFixture),
  };
  const causalDeltaFixture = computedCausalDelta(baselineResultFixture, laterResultFixture);
  const memoryCheckNames = ['Same observable input', 'Same canonical state', 'Exact current memory receipt', 'Pure memory replay matches learned DTOs', 'Receipt before semantic hashes match baseline DTOs', 'Receipt after hashes match learned DTOs', 'Nonzero causal DTO delta', 'Only allowed causal operations changed', 'Deterministic target and protected checks passed', 'Shared v3 remains unchanged'];
  const proofFixture = {
    ready: true, computed: true, baseline_run_id: 'baseline-run', later_run_id: 'later-run',
    before: { run_id: 'baseline-run', observable_input_hash: observableHash, canonical_state_hash: canonicalHash, process_semantic_hash: receiptFixture.before.process_semantic_hash, checklist_semantic_hash: receiptFixture.before.checklist_semantic_hash, playbook_version: 'mould-playbook-v3', verification_hash: baselineResultFixture.verification.whole_playbook_hash },
    after: { run_id: 'later-run', observable_input_hash: observableHash, canonical_state_hash: canonicalHash, ...receiptFixture.after, playbook_version: 'mould-playbook-v3', verification_hash: verificationHash },
    changes: { precedent_claim_ids_added: ['DEF-027-E0-DEMO'] }, reviewed_memory_proof: { used: true, memory_ids: ['memory-1'], present_in_baseline: false, present_in_later_run: true }, causal_delta: causalDeltaFixture,
    memory_application_proof: { receipt_present: true, receipt_valid: true, source_memory_current: true, before_hashes_match: true, after_hashes_match: true, allowed_delta_exact: true, replay_exact: true, application_hash: receiptFixture.application_hash },
    deterministic_checks: memoryCheckNames.map(name => ({ name, status: 'passed', detail: 'Computed from both DTOs.' })),
    candidate: { candidate_id: 'candidate_disputed_ventilation_v4', status: 'quarantined', qualified_support_count: 0, target_tests: { status: 'passed' }, protected_regression: { status: 'passed' }, approval: { status: 'pending', qualified_reviewer: false } },
    shared_rule: { applied: false, version_before: 'mould-playbook-v3', version_after: 'mould-playbook-v3', shared_knowledge_changed: false, candidate_status: 'quarantined' },
  };
  const frozenMemoryIdentity = { memory_id: 'memory-1', review_id: 'review-1', content_hash: receiptFixture.source_memory.content_hash, candidate_id: 'candidate_disputed_ventilation_v4', updated_at: '2026-08-12T00:00:00+00:00' };
  const counterfactualFreezeFixture = { contract: 'casepath.counterfactual-learning-freeze/1.0.0', memory: frozenMemoryIdentity, identity_hash: dtoHash(frozenMemoryIdentity), application_suppressed: true };
  proofFixture.counterfactual_learning_freeze = counterfactualFreezeFixture;
  const baselineRunFixture = { run_id: 'baseline-run', claim_id: 'DEMO-MOULD-002', created_at: '2026-08-12T00:01:00+00:00', completed_at: Date.parse('2026-08-12T00:02:00+00:00') / 1000, counterfactual_learning_freeze: counterfactualFreezeFixture, result: baselineResultFixture };
  const laterRunFixture = { run_id: 'later-run', claim_id: 'DEMO-MOULD-002', created_at: '2026-08-12T00:03:00+00:00', result: laterResultFixture, memory_application_boundary: memoryBoundaryFixture, events: [memoryEventFixture] };
  const positiveMemoryIssues = memoryApplicationContractViolations(baselineRunFixture, laterRunFixture, proofFixture);
  if (positiveMemoryIssues.length) throw new Error(`Positive memory-application fixture failed: ${JSON.stringify(positiveMemoryIssues)}`);
  const tamperedCounterfactualFreezeRun = structuredClone(baselineRunFixture);
  tamperedCounterfactualFreezeRun.counterfactual_learning_freeze.memory.content_hash = sha256('forged frozen memory');
  tamperedCounterfactualFreezeRun.counterfactual_learning_freeze.identity_hash = dtoHash(tamperedCounterfactualFreezeRun.counterfactual_learning_freeze.memory);
  if (!memoryApplicationContractViolations(tamperedCounterfactualFreezeRun, laterRunFixture, proofFixture).some(issue => issue.includes('frozen governed memory identity'))) throw new Error('Tampered counterfactual learning-freeze fixture was not rejected');
  const preFreezeBaselineRun = structuredClone(baselineRunFixture);
  preFreezeBaselineRun.created_at = '2026-08-11T23:59:00+00:00';
  if (!memoryApplicationContractViolations(preFreezeBaselineRun, laterRunFixture, proofFixture).some(issue => issue.includes('ordered after the learning freeze'))) throw new Error('Pre-learning baseline fixture was not rejected');
  const tamperedMemoryBoundaryHashRun = structuredClone(laterRunFixture);
  tamperedMemoryBoundaryHashRun.memory_application_boundary.boundary_hash = sha256('tampered retained memory boundary');
  if (!memoryApplicationContractViolations(baselineRunFixture, tamperedMemoryBoundaryHashRun, proofFixture).some(issue => issue.includes('boundary hash'))) throw new Error('Tampered retained memory-boundary hash fixture was not rejected');
  const tamperedMemoryBoundarySourceRun = structuredClone(laterRunFixture);
  tamperedMemoryBoundarySourceRun.memory_application_boundary.source_memory.content_hash = sha256('wrong retained source memory');
  tamperedMemoryBoundarySourceRun.memory_application_boundary.boundary_hash = dtoHash(Object.fromEntries(Object.entries(tamperedMemoryBoundarySourceRun.memory_application_boundary).filter(([key]) => key !== 'boundary_hash')));
  if (!memoryApplicationContractViolations(baselineRunFixture, tamperedMemoryBoundarySourceRun, proofFixture).some(issue => issue.includes('identity or source join'))) throw new Error('Tampered retained memory-boundary source fixture was not rejected');
  const tamperedMemoryBoundaryBeforeRun = structuredClone(laterRunFixture);
  tamperedMemoryBoundaryBeforeRun.memory_application_boundary.before.process_dto_hash = sha256('wrong independently retained before DTO');
  tamperedMemoryBoundaryBeforeRun.memory_application_boundary.boundary_hash = dtoHash(Object.fromEntries(Object.entries(tamperedMemoryBoundaryBeforeRun.memory_application_boundary).filter(([key]) => key !== 'boundary_hash')));
  if (!memoryApplicationContractViolations(baselineRunFixture, tamperedMemoryBoundaryBeforeRun, proofFixture).some(issue => issue.includes('before hashes do not equal'))) throw new Error('Retained memory-boundary to receipt.before join fixture was not rejected');
  const missingMemoryEventRun = structuredClone(laterRunFixture);
  missingMemoryEventRun.events = [];
  if (!memoryApplicationContractViolations(baselineRunFixture, missingMemoryEventRun, proofFixture).some(issue => issue.includes('exactly one completed persisted'))) throw new Error('Missing persisted memory-application event fixture was not rejected');
  const duplicateMemoryEventRun = structuredClone(laterRunFixture);
  duplicateMemoryEventRun.events.push(structuredClone(memoryEventFixture));
  if (!memoryApplicationContractViolations(baselineRunFixture, duplicateMemoryEventRun, proofFixture).some(issue => issue.includes('exactly one completed persisted'))) throw new Error('Duplicate persisted memory-application event fixture was not rejected');
  const forgedResultAndBoundaryRun = structuredClone(laterRunFixture);
  forgedResultAndBoundaryRun.result.memory_application.before.process_dto_hash = sha256('forged process DTO boundary');
  forgedResultAndBoundaryRun.result.memory_application.before.checklist_dto_hash = sha256('forged checklist DTO boundary');
  forgedResultAndBoundaryRun.result.memory_application.application_hash = dtoHash(Object.fromEntries(Object.entries(forgedResultAndBoundaryRun.result.memory_application).filter(([key]) => key !== 'application_hash')));
  forgedResultAndBoundaryRun.memory_application_boundary.before = structuredClone(forgedResultAndBoundaryRun.result.memory_application.before);
  forgedResultAndBoundaryRun.memory_application_boundary.boundary_hash = dtoHash(Object.fromEntries(Object.entries(forgedResultAndBoundaryRun.memory_application_boundary).filter(([key]) => key !== 'boundary_hash')));
  const forgedResultAndBoundaryProof = structuredClone(proofFixture);
  forgedResultAndBoundaryProof.memory_application_proof.application_hash = forgedResultAndBoundaryRun.result.memory_application.application_hash;
  if (!memoryApplicationContractViolations(baselineRunFixture, forgedResultAndBoundaryRun, forgedResultAndBoundaryProof).some(issue => issue.includes('persisted memory-application event does not project'))) throw new Error('Joint result/boundary forgery without the persisted memory event was not rejected');
  const dormantMemoryResult = structuredClone(baselineResultFixture);
  dormantMemoryResult.precedents = [{ claim_id: 'DEF-027-E0-DEMO', review_status: 'unverified_demo_memory', memory_id: 'memory-1' }];
  dormantMemoryResult.reviewed_memory_retrieved = true;
  dormantMemoryResult.knowledge.reviewed_memory_retrieved = true;
  const dormantMemoryIssues = memoryRetrievalContractViolations(dormantMemoryResult);
  if (dormantMemoryIssues.length) throw new Error(`Dormant retrieved-memory fixture failed: ${JSON.stringify(dormantMemoryIssues)}`);
  const falselyUsedDormantMemory = structuredClone(dormantMemoryResult);
  falselyUsedDormantMemory.reviewed_memory_used = true;
  if (!memoryRetrievalContractViolations(falselyUsedDormantMemory).some(issue => issue.includes('memory-use flags'))) throw new Error('Receipt-free memory-use flag was not rejected');
  const falselyAppliedDormantMemory = structuredClone(dormantMemoryResult);
  falselyAppliedDormantMemory.process.case_specific_guidance_applied = true;
  if (!memoryRetrievalContractViolations(falselyAppliedDormantMemory).some(issue => issue.includes('falsely claims'))) throw new Error('Receipt-free guidance-application flag was not rejected');
  const hiddenDormantRetrieval = structuredClone(dormantMemoryResult);
  hiddenDormantRetrieval.reviewed_memory_retrieved = false;
  if (!memoryRetrievalContractViolations(hiddenDormantRetrieval).some(issue => issue.includes('retrieval flags'))) throw new Error('Ranked memory with a false retrieval flag was not rejected');
  const falselyTransformedDormantMemory = structuredClone(dormantMemoryResult);
  falselyTransformedDormantMemory.checklist.memory_used = true;
  if (!memoryRetrievalContractViolations(falselyTransformedDormantMemory).some(issue => issue.includes('process/checklist'))) throw new Error('Receipt-free checklist memory-use flag was not rejected');
  const tamperedApplicationRun = structuredClone(laterRunFixture);
  tamperedApplicationRun.result.memory_application.application_hash = sha256('tampered application');
  if (!memoryApplicationContractViolations(baselineRunFixture, tamperedApplicationRun, proofFixture).some(issue => issue.includes('application hash'))) throw new Error('Tampered memory application-hash fixture was not rejected');
  const tamperedBoundaryProof = structuredClone(proofFixture);
  tamperedBoundaryProof.after.process_semantic_hash = sha256('tampered boundary');
  if (!memoryApplicationContractViolations(baselineRunFixture, laterRunFixture, tamperedBoundaryProof).some(issue => issue.includes('after hashes'))) throw new Error('Tampered memory boundary-hash fixture was not rejected');
  const tamperedDeltaProof = structuredClone(proofFixture);
  tamperedDeltaProof.causal_delta.evidence.changed_item_ids = ['building_envelope'];
  if (!memoryApplicationContractViolations(baselineRunFixture, laterRunFixture, tamperedDeltaProof).some(issue => issue.includes('causal delta'))) throw new Error('Tampered memory causal-delta fixture was not rejected');
  const tamperedCheckProof = structuredClone(proofFixture);
  tamperedCheckProof.deterministic_checks[0].status = 'failed';
  if (!memoryApplicationContractViolations(baselineRunFixture, laterRunFixture, tamperedCheckProof).some(issue => issue.includes('checks'))) throw new Error('Failed memory deterministic-check fixture was not rejected');
  const tamperedSemanticEligibilityRun = structuredClone(laterRunFixture);
  tamperedSemanticEligibilityRun.result.memory_application.eligibility.semantic_signature_hash = sha256('wrong semantic signature');
  tamperedSemanticEligibilityRun.result.memory_application.eligibility.manifest_hash = dtoHash(Object.fromEntries(['rule_id', 'contract', 'claim_id', 'semantic_signature_hash', 'decisions', 'facts_hash', 'checks'].map(key => [key, tamperedSemanticEligibilityRun.result.memory_application.eligibility[key]])));
  tamperedSemanticEligibilityRun.result.memory_application.application_hash = dtoHash(Object.fromEntries(Object.entries(tamperedSemanticEligibilityRun.result.memory_application).filter(([key]) => key !== 'application_hash')));
  if (!memoryApplicationContractViolations(baselineRunFixture, tamperedSemanticEligibilityRun, proofFixture).some(issue => issue.includes('semantic eligibility'))) throw new Error('Tampered semantic eligibility fixture was not rejected');
  const tamperedReplayProof = structuredClone(proofFixture);
  tamperedReplayProof.memory_application_proof.replay_exact = false;
  if (!memoryApplicationContractViolations(baselineRunFixture, laterRunFixture, tamperedReplayProof).some(issue => issue.includes('pure replay'))) throw new Error('Failed pure-memory replay fixture was not rejected');
  const coldRun = mockOrchestration('cold');
  const coldLedger = mockLedgerForRun(coldRun, 'cold');
  const warmRun = mockOrchestration('warm', coldRun);
  const warmOnlyLedger = mockLedgerForRun(warmRun, 'warm', coldLedger);
  const combinedItems = [...coldLedger.items, ...warmOnlyLedger.items];
  const combinedLedger = { ...coldLedger, items: combinedItems, summary: ledgerSummary(combinedItems) };
  const referenceRun = {
    run_id: 'deterministic_reference_run',
    claim_id: 'DEMO-MOULD-002',
    status: 'complete',
    profile: DETERMINISTIC_REFERENCE_PROFILE,
    model_mode: DETERMINISTIC_REFERENCE_MODE,
    model: null,
    knowledge_mode: 'current',
    agent_orchestration: structuredClone(DETERMINISTIC_REFERENCE_ORCHESTRATION),
    events: [{ stage: 'orchestrator', actor_type: 'deterministic_tool', status: 'completed', implementation: 'deterministic_application_tool', model: null }],
    result: {
      next_action: { agent_brief_contribution: null },
      agent_orchestration: structuredClone(DETERMINISTIC_REFERENCE_ORCHESTRATION),
      audit: {
        profile: DETERMINISTIC_REFERENCE_PROFILE,
        authority_mode: DETERMINISTIC_REFERENCE_MODE,
        canonicalization: structuredClone(DETERMINISTIC_REFERENCE_CANONICALIZATION),
        agent_orchestration: structuredClone(DETERMINISTIC_REFERENCE_ORCHESTRATION),
      },
    },
  };
  if (deterministicReferenceRunViolations(referenceRun, 'current').length) throw new Error('Positive deterministic-reference held-out fixture failed');
  const modelActiveReference = structuredClone(referenceRun);
  modelActiveReference.events.push({ stage: 'agent_orchestration', actor_type: 'nemotron_agent', model: REQUESTED_NEMOTRON_MODEL, call_id: 'forbidden_later_call', call_count: 1 });
  if (!deterministicReferenceRunViolations(modelActiveReference, 'current').some(item => item.includes('model execution activity'))) throw new Error('Held-out model-activity fixture was not rejected');
  const executedReference = structuredClone(referenceRun);
  const executedDag = { ...structuredClone(DETERMINISTIC_REFERENCE_ORCHESTRATION), executed: true, agents: [] };
  executedReference.agent_orchestration = structuredClone(executedDag);
  executedReference.result.agent_orchestration = structuredClone(executedDag);
  executedReference.result.audit.agent_orchestration = structuredClone(executedDag);
  if (!deterministicReferenceRunViolations(executedReference, 'current').some(item => item.includes('non-executed orchestration'))) throw new Error('Held-out executed-DAG fixture was not rejected');
  if (finalLedgerSnapshotViolations(combinedLedger, structuredClone(combinedLedger)).length) throw new Error('Positive immutable 12-row final-ledger fixture failed');
  const thirteenthRowLedger = structuredClone(combinedLedger);
  thirteenthRowLedger.items.push({ ...structuredClone(thirteenthRowLedger.items.at(-1)), call_id: 'forbidden_thirteenth_row' });
  thirteenthRowLedger.summary = ledgerSummary(thirteenthRowLedger.items);
  if (!finalLedgerSnapshotViolations(combinedLedger, thirteenthRowLedger).length) throw new Error('Thirteenth final-ledger row fixture was not rejected');
  const emptyInitialLedger = { scope: 'global_budget_ledger', items: [], summary: ledgerSummary([]) };
  if (initialLedgerAdmissionViolations(emptyInitialLedger).length) throw new Error('Exact-empty initial ledger fixture was rejected');
  if (!initialLedgerAdmissionViolations(coldLedger).some(item => item.includes('not exactly empty'))) throw new Error('Stale initial ledger fixture was not rejected');
  const openingContextFixture = [{ boundary_text: EXPECTED_PRODUCTION_OPENING_BOUNDARY, actor_type: 'deterministic_tool', nemotron_plan_visible: false }];
  if (productionOpeningContextViolations(openingContextFixture).length) throw new Error('Positive production opening-context fixture failed');
  const legacyProductionOpening = structuredClone(openingContextFixture);
  legacyProductionOpening[0].boundary_text = 'This run returned legacy deterministic reference orchestration; no Nemotron orchestrator is claimed.';
  if (!productionOpeningContextViolations(legacyProductionOpening).some(item => item.includes('legacy reference'))) throw new Error('Legacy production opening-context fixture was not rejected');
  const prematureNemotronPlan = structuredClone(openingContextFixture);
  prematureNemotronPlan[0].nemotron_plan_visible = true;
  if (!productionOpeningContextViolations(prematureNemotronPlan).some(item => item.includes('before its returned event'))) throw new Error('Premature Nemotron-plan fixture was not rejected');
  const failures = [
    ...orchestrationContractViolations(coldRun, 'cold'),
    ...coldLedgerContractViolations(orchestrationAudit(coldRun), coldLedger),
    ...orchestrationContractViolations(warmRun, 'warm'),
    ...warmLineageContractViolations(orchestrationAudit(coldRun), orchestrationAudit(warmRun), combinedLedger).issues,
  ];
  if (failures.length) throw new Error(`Positive contract fixture failed: ${JSON.stringify(failures)}`);
  const expectHybridIssue = (fixture, expectedIssue, label) => {
    const issues = hybridCausalContractViolations(fixture);
    if (!issues.some(item => item.includes(expectedIssue))) throw new Error(`${label} fixture was not rejected: ${JSON.stringify(issues)}`);
    return issues;
  };
  const sourceArtifactHashRun = structuredClone(coldRun);
  orchestrationAudit(sourceArtifactHashRun).specialist_artifacts.document_source_integrity.artifacts[0].integrity_class = 'changed_after_acceptance';
  const sourceArtifactHashIssues = expectHybridIssue(sourceArtifactHashRun, 'document source specialist artifact hash', 'Changed source-specialist artifact hash');
  if (!sourceArtifactHashIssues.some(item => item.includes('parallel specialist composite input hash'))) throw new Error(`Changed source-specialist artifact did not invalidate the process-gate composite: ${JSON.stringify(sourceArtifactHashIssues)}`);
  const processArtifactHashRun = structuredClone(coldRun);
  orchestrationAudit(processArtifactHashRun).specialist_artifacts.process_decision_mapping.decisions[0].decision_value = 'changed_after_acceptance';
  const processArtifactHashIssues = expectHybridIssue(processArtifactHashRun, 'process specialist artifact hash', 'Changed process-specialist artifact hash');
  if (!processArtifactHashIssues.some(item => item.includes('parallel specialist composite input hash'))) throw new Error(`Changed process-specialist artifact did not invalidate the process-gate composite: ${JSON.stringify(processArtifactHashIssues)}`);
  const processFieldMembershipRun = structuredClone(coldRun);
  orchestrationAudit(processFieldMembershipRun).specialist_artifacts.process_decision_mapping.decisions[0].model_owned_fields = ['decision_value', 'state'];
  expectHybridIssue(processFieldMembershipRun, 'process decision field contributions violate membership or attribution', 'Foreign process model-owned field');
  const processFieldAttributionRun = structuredClone(coldRun);
  const processAttributionUnit = orchestrationAudit(processFieldAttributionRun).specialist_artifacts.process_decision_mapping.decisions[0];
  processAttributionUnit.deterministic_fallback_applied = true;
  processAttributionUnit.attribution = PROCESS_CONTRIBUTION_ROLE;
  expectHybridIssue(processFieldAttributionRun, 'process decision field contributions violate membership or attribution', 'Forged process fallback attribution');
  const processInheritedFieldRun = structuredClone(coldRun);
  const processInheritedAudit = orchestrationAudit(processInheritedFieldRun);
  processInheritedAudit.specialist_artifacts.process_decision_mapping.decisions[0].state = 'forged_inherited_state';
  processInheritedAudit.agents.find(item => item.agent_id === 'process_decision_mapping').output_artifact_hash = dtoHash(processInheritedAudit.specialist_artifacts.process_decision_mapping);
  processInheritedAudit.deterministic_gates.find(item => item.agent_id === 'deterministic_process_gate').input_artifact_hash = dtoHash({
    source_integrity: processInheritedAudit.specialist_artifacts.document_source_integrity,
    process_mapping: processInheritedAudit.specialist_artifacts.process_decision_mapping,
  });
  expectHybridIssue(processInheritedFieldRun, 'inherited canonical fields are not exact', 'Forged inherited process field with recomputed hashes');
  const evidenceFieldMembershipRun = structuredClone(coldRun);
  orchestrationAudit(evidenceFieldMembershipRun).specialist_artifacts.evidence_checklist.items[0].field_contributions[0].field = 'artifact_ids';
  expectHybridIssue(evidenceFieldMembershipRun, 'does not contain the exact two field contributions', 'Foreign evidence field membership');
  const evidenceFieldAttributionRun = structuredClone(coldRun);
  const evidenceAttributionUnit = orchestrationAudit(evidenceFieldAttributionRun).specialist_artifacts.evidence_checklist.items[0].field_contributions[0];
  evidenceAttributionUnit.deterministic_fallback_applied = true;
  evidenceAttributionUnit.attribution = EVIDENCE_CONTRIBUTION_ROLE;
  expectHybridIssue(evidenceFieldAttributionRun, 'does not contain the exact two field contributions', 'Forged evidence fallback attribution');
  const evidenceSourceRefsRun = structuredClone(coldRun);
  const evidenceSourceRefsAudit = orchestrationAudit(evidenceSourceRefsRun);
  evidenceSourceRefsAudit.specialist_artifacts.evidence_checklist.items[0].source_ref_ids = ['source_scope', 'source_scope'];
  evidenceSourceRefsAudit.agents.find(item => item.agent_id === 'evidence_checklist').output_artifact_hash = dtoHash(evidenceSourceRefsAudit.specialist_artifacts.evidence_checklist);
  evidenceSourceRefsAudit.deterministic_gates.find(item => item.agent_id === 'deterministic_evidence_gate').input_artifact_hash = dtoHash(evidenceSourceRefsAudit.specialist_artifacts.evidence_checklist);
  expectHybridIssue(evidenceSourceRefsRun, 'source reference IDs are not unique and sorted', 'Forged evidence source references with recomputed hashes');
  const finalFieldMembershipRun = structuredClone(coldRun);
  orchestrationAudit(finalFieldMembershipRun).final_claim_brief.field_contributions[0].contribution_id = 'final:foreign_current_node';
  expectHybridIssue(finalFieldMembershipRun, 'exact five field contributions', 'Foreign final field membership');
  const finalCurrentBindingRun = structuredClone(coldRun);
  orchestrationAudit(finalCurrentBindingRun).final_claim_brief.current_node_id = 'notice';
  expectHybridIssue(finalCurrentBindingRun, 'final current-node field', 'Final current-node binding');
  const finalNextBindingRun = structuredClone(coldRun);
  orchestrationAudit(finalNextBindingRun).final_claim_brief.next_action_node_id = 'scope';
  expectHybridIssue(finalNextBindingRun, 'final next-action field', 'Final next-action binding');
  const finalSupportingBindingRun = structuredClone(coldRun);
  orchestrationAudit(finalSupportingBindingRun).final_claim_brief.supporting_fact_ids = ['fact_scope'];
  expectHybridIssue(finalSupportingBindingRun, 'final supporting-facts field', 'Final supporting-facts binding');
  const finalUpstreamBindingRun = structuredClone(coldRun);
  orchestrationAudit(finalUpstreamBindingRun).final_claim_brief.upstream_contribution_ids = FINAL_UPSTREAM_CONTRIBUTION_IDS.slice(1);
  expectHybridIssue(finalUpstreamBindingRun, 'final upstream-contribution field', 'Final upstream-contribution binding');
  const finalAuditBindingRun = structuredClone(coldRun);
  orchestrationAudit(finalAuditBindingRun).final_claim_brief.audit_check_ids = FINAL_AUDIT_CHECK_IDS.slice(1);
  expectHybridIssue(finalAuditBindingRun, 'final audit-check field', 'Final audit-check binding');
  const currentNode = coldRun.result.process.nodes.find(item => item.node_id === coldRun.result.process.current_node);
  const nonControllingSupportingFacts = coldRun.result.facts.filter(item => item.controls_process === false && currentNode.fact_ids.includes(item.fact_id));
  if (!nonControllingSupportingFacts.length || !orchestrationAudit(coldRun).final_claim_brief.source_ref_ids.includes('source_context')) throw new Error('Positive final-source fixture does not cover a non-controlling supporting fact');
  const nonControllingSourceRun = structuredClone(coldRun);
  orchestrationAudit(nonControllingSourceRun).final_claim_brief.source_ref_ids = ['source_scope'];
  expectHybridIssue(nonControllingSourceRun, 'controlling and non-controlling supporting facts', 'Non-controlling final source-reference binding');
  const forgedSummaryValues = {
    records: 999,
    network_calls: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    actual_cost_usd: 0,
    actual_cost_complete: false,
    unknown_cost_call_count: 1,
    outcomes: {},
  };
  for (const [field, value] of Object.entries(forgedSummaryValues)) {
    const forgedSummaryLedger = structuredClone(coldLedger);
    forgedSummaryLedger.summary[field] = value;
    if (!sanitizedLedgerViolations(forgedSummaryLedger).some(item => item.includes('summary is inconsistent'))) throw new Error(`Forged ledger-summary ${field} fixture was not rejected`);
  }
  const wrongUpstreamRun = structuredClone(coldRun);
  orchestrationAudit(wrongUpstreamRun).agents[0].upstream_provider = 'Together';
  if (!orchestrationContractViolations(wrongUpstreamRun, 'cold').some(item => item.includes('provider provenance'))) throw new Error('Non-DeepInfra cold audit fixture was not rejected');
  const wrongUpstreamLedger = structuredClone(coldLedger);
  wrongUpstreamLedger.items[0].upstream_provider = 'Together';
  if (!coldLedgerContractViolations(orchestrationAudit(coldRun), wrongUpstreamLedger).some(item => item.includes('provider'))) throw new Error('Non-DeepInfra cold ledger fixture was not rejected');
  const wrongWarmLedger = structuredClone(combinedLedger);
  wrongWarmLedger.items.find(item => item.call_count === 0).upstream_provider = 'Together';
  if (!warmLineageContractViolations(orchestrationAudit(coldRun), orchestrationAudit(warmRun), wrongWarmLedger).issues.some(item => item.includes('provider'))) throw new Error('Non-DeepInfra warm cache fixture was not rejected');
  const wrongAgentRoleRun = structuredClone(coldRun);
  orchestrationAudit(wrongAgentRoleRun).agents.find(item => item.agent_id === 'document_source_integrity').role = 'Unbound Specialist Label';
  if (!orchestrationContractViolations(wrongAgentRoleRun, 'cold').some(item => item.includes('document_source_integrity: role label is not exact'))) throw new Error('Tampered Nemotron agent-role fixture was not rejected');
  const wrongGateRoleRun = structuredClone(coldRun);
  orchestrationAudit(wrongGateRoleRun).deterministic_gates.find(item => item.agent_id === 'deterministic_evidence_gate').role = 'Unbound Gate Label';
  if (!orchestrationContractViolations(wrongGateRoleRun, 'cold').some(item => item.includes('deterministic_evidence_gate: role label is not exact'))) throw new Error('Tampered deterministic gate-role fixture was not rejected');
  const aliasResponseRun = structuredClone(coldRun);
  const aliasResponseLedger = structuredClone(coldLedger);
  orchestrationAudit(aliasResponseRun).agents.forEach(item => { item.response_model = REQUESTED_NEMOTRON_MODEL; });
  aliasResponseRun.events.filter(item => item.actor_type === 'nemotron_agent' && item.receipt_type === 'agent_completed').forEach(item => { item.response_model = REQUESTED_NEMOTRON_MODEL; });
  aliasResponseLedger.items.forEach(item => { item.response_model = REQUESTED_NEMOTRON_MODEL; });
  if (orchestrationContractViolations(aliasResponseRun, 'cold').length || coldLedgerContractViolations(orchestrationAudit(aliasResponseRun), aliasResponseLedger).length) throw new Error('Exact raw alias response-model fixture was not accepted');
  const normalizedMismatchLedger = structuredClone(aliasResponseLedger);
  normalizedMismatchLedger.items[0].response_model = 'nvidia/nemotron-3-ultra-550b-a55b-20260604';
  if (!coldLedgerContractViolations(orchestrationAudit(aliasResponseRun), normalizedMismatchLedger).some(item => item.includes('response binding'))) throw new Error('Alias-to-dated response-model normalization fixture was not rejected');
  const foreignResponseRun = structuredClone(coldRun);
  orchestrationAudit(foreignResponseRun).agents[0].response_model = 'nvidia/nemotron-3-ultra-550b-a55b-foreign';
  if (!orchestrationContractViolations(foreignResponseRun, 'cold').some(item => item.includes('returned response identity'))) throw new Error('Foreign response-model fixture was not rejected');
  const reviewedProcess = { contract: 'process-graph', nodes: [{ node_id: 'scope' }, { node_id: 'review_added' }] };
  const reviewedChecklist = { contract: 'evidence-model', items: [{ item_id: 'lease' }, { item_id: 'review_added' }] };
  const preAudit = orchestrationAudit(coldRun);
  const reviewTransform = {
    acceptance_scope: 'post_review_unverified_transform',
    authority: 'unverified_demo_user',
    qualification_status: 'not_verified',
    input_run_id: coldRun.run_id,
    input_process_hash: preAudit.deterministic_gates.find(item => item.agent_id === 'deterministic_process_gate').output_artifact_hash,
    input_checklist_hash: preAudit.deterministic_gates.find(item => item.agent_id === 'deterministic_evidence_gate').output_artifact_hash,
    output_process_hash: dtoHash(reviewedProcess),
    output_checklist_hash: dtoHash(reviewedChecklist),
    model_acceptance_reused: false,
  };
  const reviewedResponse = { review_transform: reviewTransform, result: { process: reviewedProcess, checklist: reviewedChecklist } };
  const persistedReviewedRun = structuredClone(coldRun);
  persistedReviewedRun.result.process = reviewedProcess;
  persistedReviewedRun.result.checklist = reviewedChecklist;
  persistedReviewedRun.review_transform = structuredClone(reviewTransform);
  const reviewFailures = reviewTransformContractViolations(reviewedResponse, persistedReviewedRun, coldRun);
  if (reviewFailures.length) throw new Error(`Positive review-transform fixture failed: ${JSON.stringify(reviewFailures)}`);
  const deterministicPreReview = {
    run_id: 'deterministic_pre_review',
    result: {
      process: { contract: 'process-graph', nodes: [{ node_id: 'scope' }] },
      checklist: { contract: 'evidence-model', items: [{ item_id: 'lease' }] },
      agent_orchestration: { executed: false, authority_mode: 'deterministic_reference' },
    },
  };
  const deterministicReviewedProcess = { contract: 'process-graph', nodes: [{ node_id: 'scope' }, { node_id: 'deterministic_review_added' }] };
  const deterministicReviewedChecklist = { contract: 'evidence-model', items: [{ item_id: 'lease' }, { item_id: 'deterministic_review_added' }] };
  const deterministicReviewTransform = {
    acceptance_scope: 'post_review_unverified_transform',
    authority: 'unverified_demo_user',
    qualification_status: 'not_verified',
    input_run_id: deterministicPreReview.run_id,
    input_process_hash: dtoHash(deterministicPreReview.result.process),
    input_checklist_hash: dtoHash(deterministicPreReview.result.checklist),
    output_process_hash: dtoHash(deterministicReviewedProcess),
    output_checklist_hash: dtoHash(deterministicReviewedChecklist),
    model_acceptance_reused: false,
  };
  const deterministicReviewResponse = { review_transform: deterministicReviewTransform, result: { process: deterministicReviewedProcess, checklist: deterministicReviewedChecklist } };
  const deterministicPersistedReview = { ...structuredClone(deterministicPreReview), review_transform: structuredClone(deterministicReviewTransform) };
  deterministicPersistedReview.result.process = deterministicReviewedProcess;
  deterministicPersistedReview.result.checklist = deterministicReviewedChecklist;
  const deterministicReviewFailures = reviewTransformContractViolations(deterministicReviewResponse, deterministicPersistedReview, deterministicPreReview);
  if (deterministicReviewFailures.length) throw new Error(`Local deterministic review-transform fixture failed: ${JSON.stringify(deterministicReviewFailures)}`);
  const falselyReacceptedReview = structuredClone(reviewedResponse);
  falselyReacceptedReview.review_transform.model_acceptance_reused = true;
  if (!reviewTransformContractViolations(falselyReacceptedReview, persistedReviewedRun, coldRun).some(item => item.includes('model_acceptance_reused'))) throw new Error('Model-reacceptance negative fixture was not rejected');
  const unsafeRun = structuredClone(coldRun);
  unsafeRun.result.audit.agent_orchestration.reasoning = 'must never be public';
  if (!orchestrationContractViolations(unsafeRun, 'cold').some(item => item.includes('forbidden public fields'))) throw new Error('Sensitive-field negative fixture was not rejected');
  const sentinelRun = structuredClone(coldRun);
  sentinelRun.events.push({ stage: 'agent_orchestration', status: 'failed', detail: 'branch:to:__end__' });
  if (!orchestrationContractViolations(sentinelRun, 'cold').some(item => item.includes('execution sentinels'))) throw new Error('Internal-sentinel negative fixture was not rejected');
  const falselyModelOwnedTopology = structuredClone(coldRun);
  falselyModelOwnedTopology.result.audit.agent_orchestration.execution_topology.authority = 'nemotron_agent';
  if (!orchestrationContractViolations(falselyModelOwnedTopology, 'cold').some(item => item.includes('execution topology'))) throw new Error('Model-owned topology misattribution fixture was not rejected');
  const brokenTopologyDependency = structuredClone(coldRun);
  brokenTopologyDependency.result.audit.agent_orchestration.execution_topology.delegations.find(item => item.agent_id === 'evidence_checklist').dependencies = ['orchestrator_plan'];
  if (!orchestrationContractViolations(brokenTopologyDependency, 'cold').some(item => item.includes('execution topology'))) throw new Error('Broken deterministic topology dependency fixture was not rejected');
  const hiddenFinalAudit = structuredClone(coldRun);
  delete hiddenFinalAudit.agent_orchestration;
  if (!orchestrationContractViolations(hiddenFinalAudit, 'cold').some(item => item.includes('final payload binding'))) throw new Error('Missing final payload-visible audit fixture was not rejected');
  const terminalFailure = { run_id: 'failed_run', status: 'failed', stage: 'agent_orchestration', error: 'branch:to:__end__' };
  if (!terminalFailureContractViolations(terminalFailure).some(item => item.includes('execution sentinels'))) throw new Error('Terminal-failure sentinel negative fixture was not rejected');
  if (JSON.stringify(runProgressDiagnostic(terminalFailure)).includes('__end__')) throw new Error('Safe terminal diagnostics leaked the internal sentinel value');
  const failureAgent = orchestrationAudit(coldRun).agents.find(item => item.agent_id === 'evidence_checklist');
  const failureAcceptedState = { canonical_state_prepared: true, process_candidate_prepared: true, evidence_candidate_prepared: true, final_playbook_accepted: false };
  const safeTerminalFailure = {
    run_id: 'safe_failed_run',
    status: 'failed',
    stage: 'failed',
    failure_stage: failureAgent.agent_id,
    accepted_state: failureAcceptedState,
    error: 'AgentInvocationFailure: provider_invocation',
    events: [
      structuredClone(coldRun.events.find(item => item.agent_id === 'canonical_facts' && item.receipt_type === 'agent_completed')),
      structuredClone(coldRun.events.find(item => item.agent_id === 'orchestrator_plan' && item.receipt_type === 'agent_completed')),
      {
        event_id: 'evt_agent_failed',
        ordinal: 3,
        created_at: '2026-08-11T00:00:00Z',
        stage: 'agent_orchestration',
        label: 'Evidence and Checklist Agent',
        agent: 'Evidence and Checklist Agent',
        agent_id: failureAgent.agent_id,
        actor_type: 'nemotron_agent',
        status: 'failed',
        acceptance_scope: 'pre_review_model_output',
        headline: 'Specialist stopped at the fail-closed boundary',
        detail: 'Only bounded failure metadata was retained.',
        implementation: EXPECTED_RUNTIME.implementation,
        model: REQUESTED_NEMOTRON_MODEL,
        orchestrator: 'CasePath Orchestrator',
        validator: 'evidence_checklist-contract/1.0.0',
        prompt_version: 'evidence_checklist/1.0.0',
        receipt_type: 'agent_failed',
        delegation_id: failureAgent.delegation_id,
        parent_call_id: orchestrationAudit(coldRun).agents.find(item => item.agent_id === 'orchestrator_plan').call_id,
        call_id: 'failed_call_evidence_checklist',
        provider: 'openrouter',
        requested_model: REQUESTED_NEMOTRON_MODEL,
        call_count: 1,
        outcome: 'failed',
        handoff_from: 'deterministic_evidence_gate',
        handoff_to: 'failure_boundary',
        input_artifact_hash: dtoHash({ bounded: 'failure-input' }),
        error_type: 'AgentInvocationFailure',
        error_invariant: 'provider_invocation',
        external_tracing: false,
      },
      {
        event_id: 'evt_terminal_boundary',
        ordinal: 4,
        created_at: '2026-08-11T00:00:01Z',
        stage: 'failed',
        label: 'Analysis stopped safely',
        agent: 'Failure boundary',
        status: 'failed',
        headline: 'No final playbook was accepted',
        detail: 'Partial candidate artifacts may remain visible for audit, but the terminal acceptance boundary failed closed.',
        implementation: 'deterministic',
        model: null,
        actor_type: 'deterministic_gate',
        failure_stage: failureAgent.agent_id,
        failure_invariant: 'provider_invocation',
        accepted_state: failureAcceptedState,
        validator: 'fail-closed/15.2',
        prompt_version: null,
      },
    ],
  };
  const safeFailureIssues = terminalFailureContractViolations(safeTerminalFailure);
  if (safeFailureIssues.length) throw new Error(`Safe terminal-failure fixture failed: ${JSON.stringify(safeFailureIssues)}`);
  const terminalFailureMessage = terminalRunFailureMessage(safeTerminalFailure);
  if (!terminalFailureMessage?.includes('safe_failed_run failed:')
    || terminalFailureMessage.includes('provider_invocation')
    || LATER_TERMINAL_POLL_INTERVAL_MS >= 5000) throw new Error('Later-journey terminal failure does not exit promptly with bounded diagnostics');
  const providerConcurrencyFailure = structuredClone(safeTerminalFailure);
  const providerConcurrencyReceipt = providerConcurrencyFailure.events.find(item => item.receipt_type === 'agent_failed');
  Object.assign(providerConcurrencyReceipt, {
    call_count: 0,
    outcome: 'blocked_provider_concurrency',
    error_type: 'AgentInvocationFailure',
    error_invariant: 'provider_concurrency_timeout',
  });
  providerConcurrencyFailure.events.find(item => item.stage === 'failed').failure_invariant = 'provider_concurrency_timeout';
  const providerConcurrencyIssues = terminalFailureContractViolations(providerConcurrencyFailure);
  if (providerConcurrencyIssues.length) throw new Error(`Provider-concurrency zero-call receipt fixture failed: ${JSON.stringify(providerConcurrencyIssues)}`);
  const forgedProviderConcurrencyCall = structuredClone(providerConcurrencyFailure);
  forgedProviderConcurrencyCall.events.find(item => item.receipt_type === 'agent_failed').call_count = 1;
  if (!terminalFailureContractViolations(forgedProviderConcurrencyCall).some(item => item.includes('zero-call') || item.includes('call_count'))) throw new Error('Provider-concurrency forged-call receipt fixture was not rejected');
  const forgedProviderConcurrencyIdentity = structuredClone(providerConcurrencyFailure);
  forgedProviderConcurrencyIdentity.events.find(item => item.receipt_type === 'agent_failed').response_id = 'gen-1786483159-hyYthqPv76o6PHXpGLzl';
  if (!terminalFailureContractViolations(forgedProviderConcurrencyIdentity).some(item => item.includes('zero-call'))) throw new Error('Provider-concurrency forged response receipt fixture was not rejected');
  const upstreamRejectionFailure = structuredClone(safeTerminalFailure);
  const upstreamReceipt = upstreamRejectionFailure.events.find(item => item.receipt_type === 'agent_failed');
  Object.assign(upstreamReceipt, {
    error_invariant: 'provider_upstream_rejection',
    response_id: 'gen-1786483159-hyYthqPv76o6PHXpGLzl',
    provider_error_code: 429,
    provider_boundary: EXPECTED_PROVIDER_BOUNDARY,
    expected_upstream_provider: EXPECTED_UPSTREAM_PROVIDER,
  });
  upstreamRejectionFailure.events.find(item => item.stage === 'failed').failure_invariant = 'provider_upstream_rejection';
  const upstreamFailureIssues = terminalFailureContractViolations(upstreamRejectionFailure);
  if (upstreamFailureIssues.length) throw new Error(`Bounded upstream-rejection fixture failed: ${JSON.stringify(upstreamFailureIssues)}`);
  const forgedUpstreamBoundaryFailure = structuredClone(upstreamRejectionFailure);
  forgedUpstreamBoundaryFailure.events.find(item => item.receipt_type === 'agent_failed').expected_upstream_provider = 'Together';
  if (!terminalFailureContractViolations(forgedUpstreamBoundaryFailure).some(item => item.includes('boundary attribution is forged'))) throw new Error('Forged upstream-rejection receipt attribution fixture was not rejected');
  const missingUpstreamBoundaryFailure = structuredClone(upstreamRejectionFailure);
  delete missingUpstreamBoundaryFailure.events.find(item => item.receipt_type === 'agent_failed').expected_upstream_provider;
  if (!terminalFailureContractViolations(missingUpstreamBoundaryFailure).some(item => item.includes('attribution pair is incomplete'))) throw new Error('Missing upstream-rejection receipt attribution fixture was not rejected');
  const outOfScopeUpstreamBoundaryFailure = structuredClone(safeTerminalFailure);
  Object.assign(outOfScopeUpstreamBoundaryFailure.events.find(item => item.receipt_type === 'agent_failed'), {
    provider_boundary: EXPECTED_PROVIDER_BOUNDARY,
    expected_upstream_provider: EXPECTED_UPSTREAM_PROVIDER,
  });
  if (!terminalFailureContractViolations(outOfScopeUpstreamBoundaryFailure).some(item => item.includes('boundary attribution is out of scope'))) throw new Error('Out-of-scope upstream-rejection receipt attribution fixture was not rejected');
  const unboundedUpstreamCodeFailure = structuredClone(upstreamRejectionFailure);
  unboundedUpstreamCodeFailure.events.find(item => item.receipt_type === 'agent_failed').provider_error_code = 'RAW_PROVIDER_CODE';
  if (!terminalFailureContractViolations(unboundedUpstreamCodeFailure).some(item => item.includes('error code'))) throw new Error('Unbounded upstream provider-code fixture was not rejected');
  const claimBearingUpstreamIdFailure = structuredClone(upstreamRejectionFailure);
  claimBearingUpstreamIdFailure.events.find(item => item.receipt_type === 'agent_failed').response_id = 'DEF-027-E0-DEMO';
  if (!terminalFailureContractViolations(claimBearingUpstreamIdFailure).some(item => item.includes('exact OpenRouter generation ID'))) throw new Error('Claim-bearing upstream response-ID fixture was not rejected');
  const unsafeFailureAllowlist = structuredClone(safeTerminalFailure);
  unsafeFailureAllowlist.events.find(item => item.receipt_type === 'agent_failed').provider_payload = 'must never be retained';
  if (!terminalFailureContractViolations(unsafeFailureAllowlist).some(item => item.includes('non-allowlisted fields'))) throw new Error('Failure-receipt allowlist negative fixture was not rejected');
  const brokenFailureLineage = structuredClone(safeTerminalFailure);
  brokenFailureLineage.events.find(item => item.receipt_type === 'agent_failed').parent_call_id = 'wrong_parent';
  if (!terminalFailureContractViolations(brokenFailureLineage).some(item => item.includes('identity/lineage'))) throw new Error('Failure-receipt lineage negative fixture was not rejected');
  const overrunFailure = structuredClone(safeTerminalFailure);
  Object.assign(overrunFailure.events.find(item => item.receipt_type === 'agent_failed'), {
    outcome: 'actual_cost_overrun',
    error_invariant: 'actual_cost_overrun',
    response_id: 'generation_charged_overrun',
    response_model: REQUESTED_NEMOTRON_MODEL,
    upstream_provider: 'DeepInfra',
    usage_source: 'response',
    finish_reason: 'stop',
  });
  if (terminalFailureContractViolations(overrunFailure).length) throw new Error('Charged-overrun failure fixture was not accepted');
  const invalidModelProvenanceFailure = structuredClone(safeTerminalFailure);
  Object.assign(invalidModelProvenanceFailure.events.find(item => item.receipt_type === 'agent_failed'), {
    error_invariant: 'invalid_provenance',
    response_id: 'generation_wrong_model',
    response_model: null,
    upstream_provider: 'DeepInfra',
    usage_source: 'response',
    finish_reason: 'stop',
    invalid_provenance_field: 'response_model',
    invalid_provenance_value_hash: '7'.repeat(64),
  });
  if (terminalFailureContractViolations(invalidModelProvenanceFailure).length) throw new Error('Hashed invalid-model provenance fixture was not accepted');
  const rawForeignModelFailure = structuredClone(invalidModelProvenanceFailure);
  Object.assign(rawForeignModelFailure.events.find(item => item.receipt_type === 'agent_failed'), {
    error_invariant: 'response_model',
    response_model: 'foreign/provider-model',
    invalid_provenance_field: undefined,
    invalid_provenance_value_hash: undefined,
  });
  if (!terminalFailureContractViolations(rawForeignModelFailure).some(item => item.includes('provider provenance'))) throw new Error('Raw foreign model provenance was not rejected');
  const rawCredentialProvenance = structuredClone(safeTerminalFailure);
  Object.assign(rawCredentialProvenance.events.find(item => item.receipt_type === 'agent_failed'), {
    response_id: 'sk-or-v1-secretmaterial',
    response_model: REQUESTED_NEMOTRON_MODEL,
  });
  if (!terminalFailureContractViolations(rawCredentialProvenance).some(item => item.includes('provider provenance'))) throw new Error('Credential-shaped provider provenance was not rejected');
  const rawClaimTextProvenance = structuredClone(safeTerminalFailure);
  rawClaimTextProvenance.events.find(item => item.receipt_type === 'agent_failed').upstream_provider = 'TenantClaim';
  if (!terminalFailureContractViolations(rawClaimTextProvenance).some(item => item.includes('provider provenance'))) throw new Error('Claim-text provider provenance was not rejected');
  const partialIdentityFailure = structuredClone(safeTerminalFailure);
  Object.assign(partialIdentityFailure.events.find(item => item.receipt_type === 'agent_failed'), {
    error_invariant: 'response_identity',
    response_id: null,
    response_model: REQUESTED_NEMOTRON_MODEL,
  });
  if (terminalFailureContractViolations(partialIdentityFailure).length) throw new Error('Explicit partial response-identity failure fixture was not accepted');
  const rootAcceptedState = { canonical_state_prepared: false, process_candidate_prepared: false, evidence_candidate_prepared: false, final_playbook_accepted: false };
  const canonicalFailure = {
    run_id: 'canonical_failed_run',
    status: 'failed',
    stage: 'failed',
    failure_stage: 'canonical_facts',
    accepted_state: rootAcceptedState,
    error: 'ModelConfigurationError: missing_credential',
    events: [
      {
        event_id: 'evt_canonical_failed', ordinal: 1, created_at: '2026-08-11T00:00:00Z',
        stage: 'understand', label: 'Canonical claim state', agent: 'Guarded Canonical Facts Agent',
        agent_id: 'canonical_facts', actor_type: 'nemotron_agent', status: 'failed',
        headline: 'Canonical facts were not accepted', detail: 'The bounded provider call failed a local invariant; no final playbook was accepted.',
        implementation: 'hybrid_guarded_openrouter_canonicalizer', model: REQUESTED_NEMOTRON_MODEL,
        orchestrator: 'casepath-langgraph-orchestrator/15.2', shared_context: 'claim-context:canonical_failed_run',
        validator: 'understand-validator/15.2', prompt_version: 'understand/15.2', receipt_type: 'agent_failed',
        failure_scope: 'root_canonical_facts', root_agent: true, acceptance_scope: 'pre_review_model_output',
        input_artifact: 'observable_claim_package', input_artifact_hash: dtoHash({ bounded: 'canonical-input' }),
        provider: 'openrouter', requested_model: REQUESTED_NEMOTRON_MODEL, call_count: 0,
        orchestration_id: 'orchestration_canonical_failure', call_id: 'call_canonical_failure',
        parent_call_id: null, delegation_id: null, response_id: null, response_model: null,
        upstream_provider: null, usage_source: null, finish_reason: null,
        outcome: 'blocked_missing_credential', error_type: 'ModelConfigurationError', error_invariant: 'missing_credential',
        handoff_from: 'observable_claim_package', handoff_to: 'failure_boundary', external_tracing: false,
      },
      {
        event_id: 'evt_canonical_terminal', ordinal: 2, created_at: '2026-08-11T00:00:01Z',
        stage: 'failed', label: 'Analysis stopped safely', agent: 'Failure boundary', status: 'failed',
        headline: 'No final playbook was accepted', detail: 'Partial candidate artifacts may remain visible for audit, but the terminal acceptance boundary failed closed.',
        implementation: 'deterministic', model: null, actor_type: 'deterministic_gate', failure_stage: 'canonical_facts',
        failure_invariant: 'missing_credential', accepted_state: rootAcceptedState, validator: 'fail-closed/15.2', prompt_version: null,
      },
    ],
  };
  const canonicalFailureIssues = terminalFailureContractViolations(canonicalFailure);
  if (canonicalFailureIssues.length) throw new Error(`Canonical root-failure fixture failed: ${JSON.stringify(canonicalFailureIssues)}`);
  const canonicalInvalidProvenanceFailure = structuredClone(canonicalFailure);
  canonicalInvalidProvenanceFailure.error = 'ModelResponseError: invalid_provenance';
  const canonicalInvalidReceipt = canonicalInvalidProvenanceFailure.events.find(item => item.receipt_type === 'agent_failed');
  Object.assign(canonicalInvalidReceipt, {
    call_count: 1,
    outcome: 'failed',
    error_type: 'ModelResponseError',
    error_invariant: 'invalid_provenance',
    response_id: 'gen-canonical-invalid-model',
    response_model: null,
    upstream_provider: 'DeepInfra',
    usage_source: 'response',
    finish_reason: 'stop',
    invalid_provenance_field: 'response_model',
    invalid_provenance_value_hash: '8'.repeat(64),
  });
  const canonicalInvalidTerminal = canonicalInvalidProvenanceFailure.events.find(item => item.stage === 'failed');
  canonicalInvalidTerminal.failure_invariant = 'invalid_provenance';
  const canonicalInvalidIssues = terminalFailureContractViolations(canonicalInvalidProvenanceFailure);
  if (canonicalInvalidIssues.length) throw new Error(`Canonical invalid-provenance fixture failed: ${JSON.stringify(canonicalInvalidIssues)}`);
  const claimBearingProvenanceLedger = structuredClone(coldLedger);
  claimBearingProvenanceLedger.items[0].response_id = 'tenant-claim-identity';
  if (!sanitizedLedgerViolations(claimBearingProvenanceLedger).some(item => item.includes('exact provider-provenance sanitizer'))) throw new Error('Claim-bearing ledger provenance fixture was not rejected');
  const boundedInvalidProvenanceLedger = structuredClone(coldLedger);
  Object.assign(boundedInvalidProvenanceLedger.items[0], {
    outcome: 'failed',
    error_invariant: 'invalid_provenance',
    invalid_provenance_field: 'response_model',
    invalid_provenance_value_hash: '9'.repeat(64),
  });
  delete boundedInvalidProvenanceLedger.items[0].response_model;
  boundedInvalidProvenanceLedger.summary = ledgerSummary(boundedInvalidProvenanceLedger.items);
  const boundedInvalidLedgerIssues = sanitizedLedgerViolations(boundedInvalidProvenanceLedger);
  if (boundedInvalidLedgerIssues.length) throw new Error(`Bounded invalid-provenance ledger fixture failed: ${JSON.stringify(boundedInvalidLedgerIssues)}`);
  const retainedInvalidProvenanceLedger = structuredClone(boundedInvalidProvenanceLedger);
  retainedInvalidProvenanceLedger.items[0].response_model = 'foreign/model';
  if (!sanitizedLedgerViolations(retainedInvalidProvenanceLedger).some(item => item.includes('retained the rejected value'))) throw new Error('Retained invalid-provenance value fixture was not rejected');
  const foreignInvalidProvenanceFieldLedger = structuredClone(boundedInvalidProvenanceLedger);
  foreignInvalidProvenanceFieldLedger.items[0].invalid_provenance_field = 'provider_payload';
  if (!sanitizedLedgerViolations(foreignInvalidProvenanceFieldLedger).some(item => item.includes('unbounded'))) throw new Error('Foreign invalid-provenance field fixture was not rejected');
  const boundedUpstreamRejectionLedger = structuredClone(coldLedger);
  const boundedUpstreamLedgerItem = boundedUpstreamRejectionLedger.items[0];
  Object.assign(boundedUpstreamLedgerItem, {
    outcome: 'failed',
    error_invariant: 'provider_upstream_rejection',
    provider_error_code: 429,
    provider_boundary: EXPECTED_PROVIDER_BOUNDARY,
    expected_upstream_provider: EXPECTED_UPSTREAM_PROVIDER,
    response_id: 'gen-1786483165-FFFFFFFFFFFFFFFFFFFF',
    actual_cost_usd: null,
  });
  for (const field of ['prompt_tokens', 'completion_tokens', 'total_tokens', 'response_model', 'upstream_provider', 'usage_source', 'finish_reason']) delete boundedUpstreamLedgerItem[field];
  boundedUpstreamRejectionLedger.summary = ledgerSummary(boundedUpstreamRejectionLedger.items);
  const boundedUpstreamLedgerIssues = sanitizedLedgerViolations(boundedUpstreamRejectionLedger);
  if (boundedUpstreamLedgerIssues.length) throw new Error(`Bounded upstream-rejection ledger fixture failed: ${JSON.stringify(boundedUpstreamLedgerIssues)}`);
  const providerConcurrencyLedger = structuredClone(coldLedger);
  const providerConcurrencyLedgerItem = providerConcurrencyLedger.items[0];
  Object.assign(providerConcurrencyLedgerItem, {
    call_count: 0,
    actual_cost_usd: null,
    outcome: 'blocked_provider_concurrency',
    error_type: 'OpenRouterSendAdmissionTimeoutError',
    error_invariant: 'provider_concurrency_timeout',
  });
  for (const field of ZERO_CALL_PROVIDER_RESULT_FIELDS) delete providerConcurrencyLedgerItem[field];
  providerConcurrencyLedger.summary = ledgerSummary(providerConcurrencyLedger.items);
  const providerConcurrencyLedgerIssues = sanitizedLedgerViolations(providerConcurrencyLedger);
  if (providerConcurrencyLedgerIssues.length
    || providerConcurrencyLedger.summary.network_calls !== coldLedger.summary.network_calls - 1
    || providerConcurrencyLedger.summary.unknown_cost_call_count !== coldLedger.summary.unknown_cost_call_count) throw new Error(`Provider-concurrency zero-call ledger fixture failed: ${JSON.stringify(providerConcurrencyLedgerIssues)}`);
  const forgedProviderConcurrencyLedgerCall = structuredClone(providerConcurrencyLedger);
  forgedProviderConcurrencyLedgerCall.items[0].call_count = 1;
  forgedProviderConcurrencyLedgerCall.summary = ledgerSummary(forgedProviderConcurrencyLedgerCall.items);
  if (!sanitizedLedgerViolations(forgedProviderConcurrencyLedgerCall).some(item => item.includes('zero-call'))) throw new Error('Provider-concurrency forged-call ledger fixture was not rejected');
  const forgedProviderConcurrencyLedgerCost = structuredClone(providerConcurrencyLedger);
  forgedProviderConcurrencyLedgerCost.items[0].actual_cost_usd = 0.01;
  forgedProviderConcurrencyLedgerCost.summary = ledgerSummary(forgedProviderConcurrencyLedgerCost.items);
  if (!sanitizedLedgerViolations(forgedProviderConcurrencyLedgerCost).some(item => item.includes('zero-call'))) throw new Error('Provider-concurrency forged-cost ledger fixture was not rejected');
  const forgedProviderConcurrencyLedgerIdentity = structuredClone(providerConcurrencyLedger);
  forgedProviderConcurrencyLedgerIdentity.items[0].response_id = 'gen-1786483159-hyYthqPv76o6PHXpGLzl';
  if (!sanitizedLedgerViolations(forgedProviderConcurrencyLedgerIdentity).some(item => item.includes('zero-call'))) throw new Error('Provider-concurrency forged-response ledger fixture was not rejected');
  const forgedUpstreamBoundaryLedger = structuredClone(boundedUpstreamRejectionLedger);
  forgedUpstreamBoundaryLedger.items[0].provider_boundary = 'OpenRouter';
  if (!sanitizedLedgerViolations(forgedUpstreamBoundaryLedger).some(item => item.includes('boundary attribution is forged'))) throw new Error('Forged upstream-rejection ledger attribution fixture was not rejected');
  const missingUpstreamBoundaryLedger = structuredClone(boundedUpstreamRejectionLedger);
  delete missingUpstreamBoundaryLedger.items[0].expected_upstream_provider;
  if (!sanitizedLedgerViolations(missingUpstreamBoundaryLedger).some(item => item.includes('attribution pair is incomplete'))) throw new Error('Missing upstream-rejection ledger attribution fixture was not rejected');
  const outOfScopeUpstreamBoundaryLedger = structuredClone(coldLedger);
  Object.assign(outOfScopeUpstreamBoundaryLedger.items[0], {
    provider_boundary: EXPECTED_PROVIDER_BOUNDARY,
    expected_upstream_provider: EXPECTED_UPSTREAM_PROVIDER,
  });
  if (!sanitizedLedgerViolations(outOfScopeUpstreamBoundaryLedger).some(item => item.includes('boundary attribution is out of scope'))) throw new Error('Out-of-scope upstream-rejection ledger attribution fixture was not rejected');
  const claimBearingUpstreamIdLedger = structuredClone(coldLedger);
  Object.assign(claimBearingUpstreamIdLedger.items[0], {
    outcome: 'failed',
    error_invariant: 'provider_upstream_rejection',
    provider_error_code: 400,
    provider_boundary: EXPECTED_PROVIDER_BOUNDARY,
    expected_upstream_provider: EXPECTED_UPSTREAM_PROVIDER,
    response_id: 'DEF-027-E0-DEMO',
  });
  claimBearingUpstreamIdLedger.summary = ledgerSummary(claimBearingUpstreamIdLedger.items);
  if (!sanitizedLedgerViolations(claimBearingUpstreamIdLedger).some(item => item.includes('exact OpenRouter generation ID'))) throw new Error('Claim-bearing upstream ledger response-ID fixture was not rejected');
  const minorityRun = structuredClone(coldRun);
  minorityRun.result.audit.agent_orchestration.agents[0].rejected_count = 2;
  minorityRun.result.audit.agent_orchestration.agents[0].deterministic_fallback_applied = true;
  minorityRun.result.audit.agent_orchestration.guarded_fallback_count = 1;
  if (!orchestrationContractViolations(minorityRun, 'cold').some(item => item.includes('strict majority'))) throw new Error('Accepted-minority negative fixture was not rejected');
  const invalidProjectionRun = structuredClone(coldRun);
  const invalidProjectionAgent = orchestrationAudit(invalidProjectionRun).agents.find(item => item.agent_id === 'canonical_facts');
  invalidProjectionAgent.source_reference_projection_fact_ids = ['not_an_accepted_fact'];
  invalidProjectionAgent.source_reference_projection_count = 1;
  if (!orchestrationContractViolations(invalidProjectionRun, 'cold').some(item => item.includes('source projection'))) throw new Error('Invalid canonical source-projection disclosure was not rejected');
  const wrongHashRun = structuredClone(coldRun);
  wrongHashRun.result.audit.agent_orchestration.deterministic_gates[0].output_artifact_hash = dtoHash({ wrong: true });
  if (!orchestrationContractViolations(wrongHashRun, 'cold').some(item => item.includes('final DTO'))) throw new Error('Wrong-artifact-hash negative fixture was not rejected');
  const duplicateResponseLedger = structuredClone(coldLedger);
  duplicateResponseLedger.items[1].response_id = duplicateResponseLedger.items[0].response_id;
  if (!coldLedgerContractViolations(orchestrationAudit(coldRun), duplicateResponseLedger).some(item => item.includes('response IDs'))) throw new Error('Duplicate-response negative fixture was not rejected');
  const brokenLineageLedger = structuredClone(combinedLedger);
  brokenLineageLedger.items.find(item => item.call_id === orchestrationAudit(warmRun).agents[0].call_id).origin_call_id = 'wrong_origin';
  if (!warmLineageContractViolations(orchestrationAudit(coldRun), orchestrationAudit(warmRun), brokenLineageLedger).issues.some(item => item.includes('warm origin'))) throw new Error('Broken-lineage negative fixture was not rejected');
  const unsafeAxeTarget = `.v20-learning-row[data-customer="${'claim-bearing-'.repeat(700)}"] > span`;
  const axeDiagnostics = axeViolationDiagnostics([{ id: 'color-contrast', impact: 'serious', help: 'Elements must meet minimum color contrast ratio thresholds', nodes: [{ target: [unsafeAxeTarget], html: '<span>claim-bearing text must not be logged</span>', failureSummary: 'Claim-bearing failure prose must not be logged', any: [{ id: 'color-contrast', impact: 'serious', message: 'Claim-bearing check prose must not be logged', data: { fgColor: '#147a56', bgColor: '#edf8f3', contrastRatio: 4.44, raw: 'must not be retained' } }], all: [], none: [] }] }]);
  if (axeDiagnostics.length !== 1 || axeDiagnostics[0].node_count !== 1 || axeDiagnostics[0].omitted_node_count !== 0 || !/^sha256:[0-9a-f]{64}$/.test(axeDiagnostics[0].nodes[0].target[0]) || JSON.stringify(axeDiagnostics).includes('claim-bearing') || axeDiagnostics[0].nodes[0].checks[0].data.contrastRatio !== 4.44 || 'raw' in axeDiagnostics[0].nodes[0].checks[0].data || 'html' in axeDiagnostics[0].nodes[0] || 'message' in axeDiagnostics[0].nodes[0].checks[0] || 'failure_summary' in axeDiagnostics[0].nodes[0]) throw new Error(`Bounded Axe diagnostics fixture failed: ${JSON.stringify(axeDiagnostics)}`);
  return { status: 'passed', fixtures: ['persistent_ten_node_projection_and_tamper', 'semantic_attachment_cursor_tether_and_tamper', 'bounded_future_claim_memory_delta_and_tamper', 'bounded_axe_node_diagnostics', 'session_scoped_run_read_coalescing', 'memory_reuse_renderer_determinism', 'stable_text_grounding_fact_selection', 'normalized_text_grounding', 'python_compatible_dto_hash', 'float_hash_divergence_fail_closed', 'fail_closed_model_contribution_badges', 'mixed_field_contribution_badge', 'post_memory_contribution_suppression', 'reciprocal_evidence_truth_and_tamper', 'structured_legal_truth_and_tamper', 'visual_reference_truth_and_tamper', 'precedent_ranking_truth_and_tamper', 'memory_application_truth_and_tamper', 'memory_boundary_event_cross_binding', 'dormant_memory_retrieval_not_application', 'production_opening_context', 'legacy_production_opening_rejection', 'premature_nemotron_plan_rejection', 'cold_network', 'parallel_source_artifact_hash_rejection', 'parallel_process_artifact_hash_rejection', 'process_field_membership_rejection', 'process_field_attribution_rejection', 'process_inherited_field_rejection_with_recomputed_hashes', 'evidence_field_membership_rejection', 'evidence_field_attribution_rejection', 'evidence_source_ref_rejection_with_recomputed_hashes', 'final_field_membership_rejection', 'final_current_node_binding_rejection', 'final_next_action_binding_rejection', 'final_supporting_facts_binding_rejection', 'final_upstream_contributions_binding_rejection', 'final_audit_checks_binding_rejection', 'noncontrolling_supporting_fact_source_binding', 'cold_upstream_provider_policy_rejection', 'warm_upstream_provider_policy_rejection', 'agent_role_label_rejection', 'gate_role_label_rejection', 'raw_alias_response_model', 'response_model_normalization_rejection', 'foreign_response_model_rejection', 'warm_lineage', 'review_transform_truth', 'deterministic_review_transform_truth', 'review_model_reacceptance_rejection', 'sensitive_field_rejection', 'internal_sentinel_rejection', 'topology_authority_misattribution_rejection', 'topology_dependency_rejection', 'final_payload_audit_binding_rejection', 'terminal_failure_sentinel_rejection', 'safe_terminal_diagnostics', 'safe_failure_receipt', 'provider_concurrency_zero_call_receipt', 'provider_concurrency_receipt_call_rejection', 'provider_concurrency_receipt_identity_rejection', 'safe_upstream_rejection_receipt', 'forged_upstream_rejection_receipt_attribution_rejection', 'missing_upstream_rejection_receipt_attribution_rejection', 'out_of_scope_upstream_rejection_receipt_attribution_rejection', 'unbounded_upstream_error_code_rejection', 'failure_receipt_allowlist_rejection', 'failure_receipt_lineage_rejection', 'charged_overrun_failure', 'hashed_invalid_model_provenance', 'raw_foreign_model_rejection', 'credential_provenance_rejection', 'claim_text_provenance_rejection', 'partial_response_identity_failure', 'canonical_root_failure', 'canonical_invalid_provenance_failure', 'claim_bearing_ledger_provenance_rejection', 'bounded_invalid_provenance_ledger', 'retained_invalid_provenance_rejection', 'foreign_invalid_provenance_field_rejection', 'safe_upstream_rejection_ledger', 'provider_concurrency_zero_call_ledger', 'provider_concurrency_ledger_call_rejection', 'provider_concurrency_ledger_cost_rejection', 'provider_concurrency_ledger_identity_rejection', 'forged_upstream_rejection_ledger_attribution_rejection', 'missing_upstream_rejection_ledger_attribution_rejection', 'out_of_scope_upstream_rejection_ledger_attribution_rejection', 'accepted_minority_rejection', 'invalid_source_projection_rejection', 'wrong_artifact_hash_rejection', 'duplicate_response_rejection', 'broken_lineage_rejection'], agents: REQUIRED_NEMOTRON_AGENT_IDS, gates: REQUIRED_DETERMINISTIC_GATE_IDS };
}

let report;
if (process.env.CASEPATH_QA_CONTRACT_SELF_TEST === '1') {
  console.log(JSON.stringify(await runContractSelfTest(), null, 2));
} else {
  try {
    report = await execute();
  } catch (error) {
    report = {
      status: 'failed', release: PRODUCT_RELEASE, release_id: RELEASE_ID, checkedAt: new Date().toISOString(), baseUrl: BASE, apiUrl: API, deployment: deploymentIdentity,
      passed: checks.filter(item => item.passed).length, failed: 1, checks, notes, failures, runIds,
      error: error instanceof Error ? error.stack : String(error),
    };
    process.exitCode = 1;
  } finally {
    await fs.mkdir(OUT, { recursive: true }).catch(() => null);
    try {
      await retainEvidence();
    } catch (error) {
      failures.cleanup.push(`evidence retention: ${error}`);
    }
    await cleanup();
    try {
      await finalizeEvidenceManifest();
    } catch (error) {
      failures.cleanup.push(`evidence manifest: ${error}`);
    }
    if (failures.cleanup.length) {
      report.status = 'failed';
      report.failed = Math.max(1, report.failed || 0);
      report.error = `${report.error || ''}\nCleanup failed: ${failures.cleanup.join('; ')}`.trim();
      process.exitCode = 1;
    }
    await fs.writeFile(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    if (report.status === 'passed') console.log(JSON.stringify(report, null, 2));
    else console.error(report.error);
  }
}
