import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const API = (process.env.API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const RELEASE_ID = 'casepath-v20-reference-20260811';
const PRODUCT_RELEASE = '20.0.0';
const API_RELEASE = '15.2.0';
const REQUESTED_NEMOTRON_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b';
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
const REQUIRED_DETERMINISTIC_GATE_IDS = Object.freeze([
  'deterministic_process_gate',
  'deterministic_evidence_gate',
  'whole_playbook_gate',
]);
const ACCEPTED_ARTIFACT_CONTRACT = Object.freeze({
  deterministic_process_gate: { output_artifact: 'process_graph', source_agent_id: 'process_decision_mapping' },
  deterministic_evidence_gate: { output_artifact: 'evidence_model', source_agent_id: 'evidence_checklist' },
  whole_playbook_gate: { output_artifact: 'final_claim_brief', source_agent_id: 'final_claim_brief_audit' },
});
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
  'error_invariant', 'provider_error_code', 'invalid_provenance_field', 'invalid_provenance_value_hash',
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
  'invalid_provenance_field', 'invalid_provenance_value_hash', 'external_tracing',
]);
const FAILURE_OUTCOMES = new Set(['failed', 'blocked_cost_guard', 'blocked_missing_credential', 'actual_cost_overrun']);
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
});
const EXPECTED_FAILED_MODEL_ATTEMPT_RECORDS = Object.freeze(
  Array.from({ length: 9 }, (_, index) => `casepath/releases/model-validation-attempt-20260811-${String(index + 1).padStart(2, '0')}.json`),
);
const EXPECTED_PRODUCTION_OPENING_BOUNDARY = 'Application code opened the shared context; no model call is claimed for this setup step. The call-bound Nemotron plan appears only when its returned event arrives.';
const QA_SESSION_ID = `qa-${randomUUID()}`;
const ISOLATION_SESSION_ID = `qa-isolation-${randomUUID()}`;
const ALLOW_PRODUCTION_MUTATION = process.env.CASEPATH_ALLOW_PRODUCTION_MUTATION === '1';
const OUT = path.resolve('guided-v13-smoke-out');
const checks = [];
const notes = [];
const failures = { console: [], page: [], request: [], cleanup: [] };
const runIds = [];
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

function exactMembers(values, expected) {
  return Array.isArray(values)
    && values.length === expected.length
    && new Set(values).size === values.length
    && expected.every(value => values.includes(value));
}

function contributionExpectation(value, expectedAttribution, reviewTransform = null) {
  if (reviewTransform?.acceptance_scope === 'post_review_unverified_transform') return null;
  const entries = (Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : [])
    .filter(item => item && typeof item === 'object');
  const acceptedCount = entries.filter(item => item.deterministic_fallback_applied === false && item.attribution === expectedAttribution).length;
  const fallbackCount = entries.filter(item => item.deterministic_fallback_applied === true).length;
  if (!acceptedCount && !fallbackCount) return null;
  return {
    authority: acceptedCount && fallbackCount ? 'mixed' : acceptedCount ? 'nemotron-accepted' : 'deterministic-fallback',
    accepted_count: String(acceptedCount),
    fallback_count: String(fallbackCount),
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
      && receipt.call_count === (['blocked_cost_guard', 'blocked_missing_credential'].includes(receipt.outcome) ? 0 : 1)
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

function isNemotronRun(run) {
  const audit = orchestrationAudit(run);
  return audit?.implementation === EXPECTED_RUNTIME.implementation
    && audit?.model === REQUESTED_NEMOTRON_MODEL
    && exactMembers(audit?.agents?.map(item => item.agent_id), REQUIRED_NEMOTRON_AGENT_IDS)
    && exactMembers(audit?.deterministic_gates?.map(item => item.agent_id), REQUIRED_DETERMINISTIC_GATE_IDS);
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
  check('Release contract keeps three deterministic authority gates and disables external trace payload storage', exactMembers(runtime?.deterministic_gates?.map(item => item.gate_id), REQUIRED_DETERMINISTIC_GATE_IDS) && runtime?.safety?.deterministic_safety_authority === true && runtime?.safety?.external_tracing === false && runtime?.safety?.prompt_storage === false && runtime?.safety?.raw_output_storage === false, JSON.stringify(runtime?.safety));
  check('Release contract delegates the mutable production verdict to hash-bound same-commit QA artifacts', runtimeAcceptance?.verdict_authority === 'dynamic_same_commit_qa_artifacts' && runtimeAcceptance?.source_contract_embeds_runtime_verdict === false && exactMembers(Object.keys(dynamicEvidence || {}), ['qa_gate', 'report_path', 'evidence_manifest_path', 'evidence_manifest_contract', 'required_report_status', 'requires_release_id_match', 'requires_non_unknown_source_commit', 'requires_same_source_commit']) && dynamicEvidence?.qa_gate === 'focused-flagship-journey-v20' && dynamicEvidence?.report_path === 'report.json' && dynamicEvidence?.evidence_manifest_path === 'evidence-manifest.json' && dynamicEvidence?.evidence_manifest_contract === 'casepath.qa-evidence-manifest/1.0.0' && dynamicEvidence?.required_report_status === 'passed' && dynamicEvidence?.requires_release_id_match === true && dynamicEvidence?.requires_non_unknown_source_commit === true && dynamicEvidence?.requires_same_source_commit === true, JSON.stringify(runtimeAcceptance));
  check('Dynamic production acceptance declares every exact paid-call, contribution, cold-run, gate, and fallback criterion', exactMembers(Object.keys(runtimeAcceptance || {}), ['verdict_authority', 'source_contract_embeds_runtime_verdict', 'dynamic_evidence', ...Object.keys(EXPECTED_RUNTIME_ACCEPTANCE_CRITERIA)]) && Object.entries(EXPECTED_RUNTIME_ACCEPTANCE_CRITERIA).every(([key, value]) => runtimeAcceptance?.[key] === value), JSON.stringify(runtimeAcceptance));
  check('Release separates deterministic build proof and failed-closed history from current runtime acceptance', stableJson(releaseContract?.truth?.deterministic_build) === stableJson({ status: 'passed', execution_mode: 'deterministic_reference', model_calls: 0, model_backed: false }) && releaseContract?.truth?.historical_model_validation?.scope === 'failed_closed_history_only' && releaseContract?.truth?.historical_model_validation?.establishes_current_runtime_acceptance === false && stableJson(releaseContract?.truth?.historical_model_validation?.evidence_records) === stableJson(EXPECTED_FAILED_MODEL_ATTEMPT_RECORDS), JSON.stringify(releaseContract?.truth));
  check('Release keeps unearned expert, legal, operational, and real-claim claims false', ['independent_expert_review', 'blind_review_completed', 'legal_approval', 'operational_validation', 'real_claims_approved'].every(key => releaseContract?.truth?.[key] === false) && releaseContract?.truth?.generated_data_only === true, JSON.stringify(releaseContract?.truth));
  check('Release acceptance identity uses independent component versions but one release/source identity', releaseContract?.compatibility?.component_versions_are_independent === true && /same release_id/i.test(releaseContract?.compatibility?.acceptance_rule || '') && /same non-unknown source commit/i.test(releaseContract?.compatibility?.acceptance_rule || ''), JSON.stringify(releaseContract?.compatibility));
}

function assertHealthRuntimeContract(health, releaseRuntime) {
  const runtime = health.agentic_runtime;
  if (!isProductionJourney()) {
    check('Local health remains in deterministic reference mode without activating a model', health.model_mode === 'deterministic_reference' && health.model == null && health.runtime_profile === 'deterministic_reference' && runtime?.profile === 'deterministic_reference' && runtime?.execution_mode === 'deterministic_reference' && runtime?.authority_mode === 'deterministic_reference' && runtime?.implementation === 'deterministic_reference' && runtime?.schema == null && exactMembers(runtime?.required_agent_ids, []) && exactMembers(runtime?.deterministic_gate_ids, []), JSON.stringify({ model_mode: health.model_mode, model: health.model, runtime }));
    check('Local deterministic health still reports the pinned inactive framework and trace-disabled safety posture', stableJson(runtime?.framework) === stableJson(EXPECTED_FRAMEWORK) && runtime?.safety?.external_tracing === false && runtime?.safety?.prompt_storage === false && runtime?.safety?.raw_output_storage === false, JSON.stringify(runtime));
    return;
  }
  check('Production health returns the active Nemotron LangGraph runtime profile and schema', health.runtime_profile === EXPECTED_RUNTIME.runtime_profile && runtime?.profile === EXPECTED_RUNTIME.runtime_profile && runtime?.execution_mode === 'nemotron_multi_agent' && runtime?.authority_mode === EXPECTED_RUNTIME.authority_mode && runtime?.implementation === EXPECTED_RUNTIME.implementation && runtime?.schema === EXPECTED_RUNTIME.orchestration_schema && health.model === REQUESTED_NEMOTRON_MODEL, JSON.stringify(runtime));
  check('Production health returns the exact requested framework versions', stableJson(runtime?.framework) === stableJson(releaseRuntime.framework) && stableJson(runtime?.framework) === stableJson(EXPECTED_FRAMEWORK), JSON.stringify(runtime?.framework));
  check('Production health returns the exact six model roles and three deterministic gates', exactMembers(runtime?.required_agent_ids, REQUIRED_NEMOTRON_AGENT_IDS) && exactMembers(runtime?.deterministic_gate_ids, REQUIRED_DETERMINISTIC_GATE_IDS), JSON.stringify(runtime));
  check('Production health attests the exact private DeepInfra route and disables tracing, storage, fallback, and inference retries', runtime?.safety?.deterministic_contract_authority === true && runtime?.safety?.external_tracing === false && runtime?.safety?.prompt_storage === false && runtime?.safety?.raw_output_storage === false && runtime?.safety?.model_fallback === false && runtime?.safety?.automatic_inference_retry === false && stableJson(runtime?.safety?.provider_routing) === stableJson({ endpoint_tag: 'deepinfra/fp4', expected_upstream_provider: 'DeepInfra', allow_fallbacks: false, require_parameters: true, data_collection: 'deny' }), JSON.stringify(runtime?.safety));
}

function assertReadinessContract(readiness) {
  const budgetCredential = readiness?.model_budget?.credential_configured;
  const runtimeCredential = readiness?.agentic_runtime?.safety?.credential_configured;
  check('Readiness safely exposes only matching boolean OpenRouter credential receipts', typeof budgetCredential === 'boolean' && typeof runtimeCredential === 'boolean' && budgetCredential === runtimeCredential, JSON.stringify({ budgetCredential, runtimeCredential }));
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
  const deadline = Date.now() + timeout;
  const pollInterval = isProductionJourney() ? 1000 : 250;
  let latest = null;
  while (Date.now() < deadline) {
    const run = await getJsonForSession(`${API}/api/runs/${encodeURIComponent(runId)}`, sessionId);
    latest = run;
    if (run.status === 'complete') return run;
    if (run.status === 'failed') {
      const terminalIssues = terminalFailureContractViolations(run);
      if (terminalIssues.length) throw new Error(`run ${runId} failed public-safety contract: ${JSON.stringify(terminalIssues)}`);
      throw new Error(`run ${runId} failed: ${JSON.stringify(runProgressDiagnostic(run))}`);
    }
    await sleep(pollInterval);
  }
  throw new Error(`run ${runId} timed out after ${timeout}ms: ${JSON.stringify(runProgressDiagnostic(latest))}`);
}

async function awaitRun(runId) {
  return awaitRunForSession(runId, QA_SESSION_ID);
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
  for (const viewport of [
    { width: 390, height: 844, name: '390' },
    { width: 320, height: 700, name: '320' },
  ]) {
    await page.setViewportSize(viewport);
    await sleep(120);
    const overflow = await horizontalOverflow();
    check(`${label} at ${viewport.name}px has no page-level horizontal overflow`, overflow <= 1, `overflow=${overflow}`);
    check(`${label} at ${viewport.name}px retains its primary artifact`, await page.locator(selector).first().isVisible());
    check(`${label} at ${viewport.name}px keeps the source claim available`, await page.locator('.submission-pane').isVisible());
    await screenshot(`${label}-${viewport.name}.png`, true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await sleep(120);
  check(`${label} returns to desktop`, await page.locator(selector).first().isVisible());
}

async function runAxe(label) {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(item => ['serious', 'critical'].includes(item.impact));
  check(`${label} has no serious or critical axe violations`, serious.length === 0, JSON.stringify(serious.map(item => ({ id: item.id, impact: item.impact }))));
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
    '01-start-390.png',
    '02-ready-process-390.png',
    '04-review-390.png',
    '05-review-applied-390.png',
    '06-learning-390.png',
    '07-later-result-390.png',
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

  const [frontendDeployment, health, readiness, releaseContract] = await Promise.all([
    getJson(`${BASE}/deployment.json`),
    getJson(`${API}/healthz`),
    getJson(`${API}/readyz`),
    getJson(`${BASE}/release.json`),
  ]);
  deploymentIdentity = { ...deploymentIdentity, frontend: frontendDeployment, api: health };
  retainedEvidence['deployment-identity'] = deploymentIdentity;
  retainedEvidence['release-contract'] = releaseContract;
  retainedEvidence['readiness-receipt'] = readiness;
  assertDeploymentAlignment(frontendDeployment, health);
  assertReleaseRuntimeContract(releaseContract);
  assertHealthRuntimeContract(health, releaseContract.agentic_runtime);
  assertReadinessContract(readiness);
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
    window.__casepathVisibleAgentIds = [];
    window.__casepathVisibleGateIds = [];
    window.__casepathOpeningContexts = [];
    window.addEventListener('casepath:render', event => {
      if (event.detail?.moment !== 'opening') return;
      const actorCard = document.querySelector('#orchestrationProof .orchestration-actor-card');
      window.__casepathOpeningContexts.push({
        boundary_text: document.querySelector('#stageCanvas[data-casepath-moment="opening"] .live-question strong')?.textContent || '',
        actor_type: actorCard?.dataset.actorType || '',
        nemotron_plan_visible: Boolean(document.querySelector('#orchestrationProof .orchestration-actor-card[data-actor-type="nemotron_agent"][data-actor-id="orchestrator_plan"]')),
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
      new MutationObserver(captureOrchestrationProof).observe(document.documentElement, { attributes: true, childList: true, subtree: true, attributeFilter: ['data-actor-id', 'data-gate-id', 'data-actor-type'] });
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
  const flagshipScriptPaths = ['assets/live-v16.js', 'assets/live-v17.js', 'assets/live-v18.js', 'assets/live-v18-handoff.js', 'assets/live-v20-focus.js'];
  const flagshipScriptSources = await Promise.all(flagshipScriptPaths.map(async scriptPath => ({ scriptPath, source: await getText(`${BASE}/${scriptPath}`) })));
  const syntheticActorLabels = ['Agent complete', 'Attachment Parsing Agent', 'Claim Understanding Agent', 'Legal Research Agent', 'Process Discovery Agent', 'Document Requirements Agent', 'Historical Claims Agent', 'Verification Agent', 'Knowledge Agent'];
  const syntheticActorSources = flagshipScriptSources.flatMap(({ scriptPath, source }) => syntheticActorLabels.filter(label => source.includes(label)).map(label => `${scriptPath}:${label}`));
  check('Loaded flagship scripts never present deterministic stages or knowledge governance as extra model agents', syntheticActorSources.length === 0, JSON.stringify(syntheticActorSources));

  await page.waitForFunction(expected => document.querySelectorAll('.attachment-row').length === expected, demo.claim.artifacts.length, { timeout: 120000 });
  await page.waitForFunction(() => !document.querySelector('#runCasePath')?.disabled, null, { timeout: 120000 });
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

  await page.locator(`[data-artifact-id="${pdf.artifact_id}"]`).click();
  await waitVisible('#sourceViewer[open]');
  await page.waitForFunction(() => document.querySelector('#sourceViewer')?.getAttribute('aria-busy') === 'false');
  check('Source dialog moves focus inside on open', await page.evaluate(() => document.querySelector('#sourceViewer')?.contains(document.activeElement)));
  check('PDF original pages remain inspectable', await page.locator('.page-thumb').count() === pdf.page_count && await page.locator('#documentPage').isVisible());
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
  await page.setViewportSize({ width: 390, height: 844 });
  check('Mobile source viewer retains source-to-fact region', await page.locator('#sourceEvidence').isVisible());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('#closeSourceViewer').click();
  check('Closing source dialog restores attachment focus', await page.evaluate(artifactId => document.activeElement?.dataset.artifactId === artifactId, pdf.artifact_id));

  await page.locator(`[data-artifact-id="${image.artifact_id}"]`).click();
  await waitVisible('#sourceImage');
  const imageCount = demo.claim.artifacts.filter(item => item.media_type?.startsWith('image/')).length;
  check('Image gallery controls appear only when useful', imageCount > 1 ? await page.locator('#sourceGalleryNav').isVisible() : await page.locator('#sourceGalleryNav').isHidden());
  if (imageCount > 1) {
    const firstImageTitle = await page.locator('#sourceViewerTitle').innerText();
    await page.locator('#sourceNext').click();
    check('Image next control opens the adjacent original image', (await page.locator('#sourceViewerTitle').innerText()) !== firstImageTitle);
    await page.locator('#sourcePrevious').click();
    check('Image previous control returns to the original image', (await page.locator('#sourceViewerTitle').innerText()) === firstImageTitle);
  }
  await page.locator('#closeSourceViewer').click();

  await page.locator(`[data-artifact-id="${email.artifact_id}"]`).click();
  await waitVisible('#sourceViewer .email-document');
  check('Email original and extraction representations remain inspectable', await page.locator('#sourceViewer .email-document').isVisible());
  await page.locator('#sourceTabExtraction').click();
  await waitVisible('#sourceStage .extraction-page');
  await page.locator('#closeSourceViewer').click();

  await page.locator('#runCasePath').click();
  await waitVisible('#liveWorkspace');
  const flagshipRunId = await waitForValue(() => runIds[0]);
  if (isProductionJourney()) {
    await page.waitForFunction(() => window.__casepathOpeningContexts?.length > 0, null, { timeout: runTimeoutMs() });
    const openingContexts = await page.evaluate(() => window.__casepathOpeningContexts);
    const openingContextIssues = productionOpeningContextViolations(openingContexts);
    check('First live production frame attributes shared-context setup to application code and waits for the returned Nemotron plan', openingContextIssues.length === 0, JSON.stringify({ openingContexts, openingContextIssues }));
  }
  const visibleProofCaptures = isProductionJourney() ? [
    (async () => {
      await waitVisible('.orchestration-actor-card[data-actor-type="nemotron_agent"][data-call-id]:not([data-call-id=""])', runTimeoutMs());
      await screenshot('02-live-nemotron-agent.png');
    })(),
    (async () => {
      await waitVisible('.orchestration-receipt.gate-receipt[data-actor-type="deterministic_gate"]:is([data-artifact-id="process_graph"],[data-artifact-id="evidence_model"],[data-artifact-id="final_claim_brief"])', runTimeoutMs());
      await screenshot('03-deterministic-accepted-artifact.png');
    })(),
  ] : [];
  const [processRun] = await waitJourneyUi('Visible flagship cold orchestration did not complete', () => Promise.all([
    awaitRun(flagshipRunId),
    ...visibleProofCaptures,
  ]));
  retainedEvidence['flagship-run'] = processRun;
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
    await waitVisible('.process-layout', runTimeoutMs());
  });
  if (isProductionJourney()) {
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
  check('Main spine remains the dominant collapsed graph', await page.locator('.process-spine .process-node').count() === processGraph.main_spine.length && await page.locator('#processBranchGrid').isHidden());
  if (isProductionJourney()) {
    const expectedProcessContributions = processGraph.nodes.map(node => ({
      node_id: node.node_id,
      contribution: contributionExpectation(node.agent_decision_contributions, 'Process Decision Mapping Agent'),
    })).filter(item => item.contribution);
    const renderedProcessContributions = await page.locator('.process-map .process-node-button[data-node-id],.process-map .process-branch-node[data-node-id]').evaluateAll(nodes => nodes.flatMap(node => {
      const badge = node.querySelector('.model-contribution-attribution');
      return badge ? [{ node_id: node.dataset.nodeId, contribution: { authority: badge.dataset.contributionAuthority, accepted_count: badge.dataset.acceptedCount, fallback_count: badge.dataset.fallbackCount } }] : [];
    }));
    check('Every visible process contribution is exactly bound to returned Nemotron acceptance or deterministic fallback', stableJson(renderedProcessContributions.sort((a, b) => a.node_id.localeCompare(b.node_id))) === stableJson(expectedProcessContributions.sort((a, b) => a.node_id.localeCompare(b.node_id))) && renderedProcessContributions.some(item => Number(item.contribution.accepted_count) > 0), JSON.stringify({ expectedProcessContributions, renderedProcessContributions }));
  }
  await page.locator('[data-toggle-all-branches]').click();
  const renderedNodeIds = await page.evaluate(() => [...new Set([...document.querySelectorAll('.process-node-button[data-node-id],.process-branch-node[data-node-id]')].map(node => node.dataset.nodeId))]);
  const expectedNodeIds = processGraph.nodes.map(node => node.node_id);
  check('Every backend process node is experienceable', expectedNodeIds.every(id => renderedNodeIds.includes(id)) && renderedNodeIds.length === expectedNodeIds.length, JSON.stringify({ expectedNodeIds, renderedNodeIds }));
  check('Official law, unapproved model interpretation, and generated-reference provenance remain distinct', await page.locator('.law-marker.official').count() > 0 && await page.locator('.law-marker.interpretation').count() > 0 && /Generated reference precedent/i.test(await page.locator('.precedent-mini').first().innerText()));
  const renderedEdges = await page.locator('.process-edge[data-edge-source][data-edge-target]').evaluateAll(edges => edges.map(edge => ({ source: edge.dataset.edgeSource, target: edge.dataset.edgeTarget, state: edge.dataset.edgeState })));
  const expectedEdges = processGraph.edges.map(edge => ({ source: edge.source, target: edge.target, state: edge.state || '' }));
  check('Every backend process edge is experienceable with structural endpoints and state', JSON.stringify(renderedEdges) === JSON.stringify(expectedEdges), JSON.stringify({ expectedEdges, renderedEdges }));
  await page.locator('.process-edge-ledger summary').click();
  check('Compact connection ledger is keyboard-actionable', await page.locator('.process-edge').first().isVisible());
  const firstEdgeTarget = processGraph.edges[0].target;
  await page.locator('.process-edge').first().click();
  check('A graph connection routes to its destination decision', await page.locator(`.decision-inspector[data-inspector-node="${firstEdgeTarget}"]`).count() === 1);
  const firstBranchId = processGraph.nodes.find(node => !processGraph.main_spine.includes(node.node_id)).node_id;
  await page.locator(`.process-branch-node[data-node-id="${firstBranchId}"]`).click();
  check('Branch expansion is actionable', await page.locator(`.decision-inspector[data-inspector-node="${firstBranchId}"]`).count() === 1);
  await auditViewports('02-ready-process', '.process-layout');

  const facts = processRun.result?.facts || processRun.understanding?.facts || [];
  const fact = facts.find(item => item.source_refs?.length && item.source_refs.every(ref => ref.locator_kind === 'text_quote') && processGraph.nodes.some(node => (node.fact_ids || []).includes(item.fact_id)));
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
    return Number.isInteger(ref.page) && ref.page >= 1 && typeof ref.excerpt === 'string' && ref.excerpt.length > 0 && String(sourceText?.[ref.page - 1] || '').includes(ref.excerpt);
  }));
  check('Every text quote is an exact substring of its returned source page', textLocatorChecks.every(Boolean), JSON.stringify(fact.source_refs));
  await page.locator(`${factSelector} .grounding-ref`).first().click();
  await waitVisible('#sourceViewer[open]');
  await waitVisible(`.source-fact[data-fact-id="${fact.fact_id}"]`);
  const sourceArtifactId = fact.source_refs[0].artifact_id;
  const sourceRefs = fact.source_refs.filter(ref => ref.artifact_id === sourceArtifactId);
  const renderedPassages = await page.locator(`.source-fact[data-fact-id="${fact.fact_id}"] .source-passage`).evaluateAll(passages => passages.map(passage => ({ locator_kind: passage.dataset.locatorKind, page: passage.dataset.sourcePage, excerpt: passage.dataset.sourceExcerpt, agent: passage.dataset.sourceAgent })));
  const expectedPassages = sourceRefs.map(ref => ({ locator_kind: ref.locator_kind, page: ref.page == null ? '' : String(ref.page), excerpt: ref.excerpt || '', agent: ref.agent || '' }));
  check('Source-to-fact grounding retains exact passages and owning-decision route', JSON.stringify(renderedPassages) === JSON.stringify(expectedPassages) && await page.locator(`.source-fact[data-fact-id="${fact.fact_id}"] [data-source-fact-node="${owningNode.node_id}"]`).count() === 1, JSON.stringify({ expectedPassages, renderedPassages }));
  await page.setViewportSize({ width: 320, height: 700 });
  check('320px source viewer retains bidirectional grounding', await page.locator(`.source-fact[data-fact-id="${fact.fact_id}"]`).isVisible());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator(`.source-fact[data-fact-id="${fact.fact_id}"] [data-source-fact-node="${owningNode.node_id}"]`).click();
  await waitHidden('#sourceViewer');
  check('Source route returns focus to owning decision', await page.evaluate(nodeId => document.activeElement?.dataset.nodeId === nodeId, owningNode.node_id));

  const visualFact = facts.find(item => item.source_refs?.some(ref => ref.locator_kind === 'visual_observation') && processGraph.nodes.some(node => (node.fact_ids || []).includes(item.fact_id)));
  check('A process-owned visual-observation fact is available', Boolean(visualFact), JSON.stringify(facts.map(item => ({ fact_id: item.fact_id, locator_kinds: item.source_refs?.map(ref => ref.locator_kind) }))));
  const visualRef = visualFact.source_refs.find(ref => ref.locator_kind === 'visual_observation');
  const visualNode = processGraph.nodes.find(node => (node.fact_ids || []).includes(visualFact.fact_id));
  await page.locator(`.process-node-button[data-node-id="${visualNode.node_id}"],.process-branch-node[data-node-id="${visualNode.node_id}"]`).first().click();
  const visualButton = page.locator(`.inspector-fact[data-fact-id="${visualFact.fact_id}"] .grounding-ref[data-source-locator-kind="visual_observation"]`).first();
  check('Visual observation is not rendered as an exact quote', await visualButton.locator('q').count() === 0 && /not an exact quote/i.test(await visualButton.innerText()));
  await visualButton.click();
  await waitVisible('#sourceViewer[open] .visual-region-highlight');
  const highlightedRegion = await page.locator('.visual-region-highlight').evaluate(node => ({ region: JSON.parse(node.dataset.highlightRegion), left: parseFloat(node.style.left) / 100, top: parseFloat(node.style.top) / 100, width: parseFloat(node.style.width) / 100, height: parseFloat(node.style.height) / 100, label: node.getAttribute('aria-label') }));
  const visualRegionValid = Array.isArray(visualRef.region) && visualRef.region.length === 4 && visualRef.region.every(value => Number.isFinite(value) && value >= 0 && value <= 1) && visualRef.region[2] > 0 && visualRef.region[3] > 0 && visualRef.region[0] + visualRef.region[2] <= 1 && visualRef.region[1] + visualRef.region[3] <= 1;
  const visualArtifact = demo.claim.artifacts.find(item => item.artifact_id === visualRef.artifact_id);
  check('Opening a visual fact highlights the exact normalized image region', visualRegionValid && visualArtifact?.media_type?.startsWith('image/') && JSON.stringify(highlightedRegion.region) === JSON.stringify(visualRef.region) && [highlightedRegion.left, highlightedRegion.top, highlightedRegion.width, highlightedRegion.height].every((value, index) => Math.abs(value - visualRef.region[index]) < 1e-9) && highlightedRegion.label.includes(visualRef.observation), JSON.stringify({ visualRef, visualArtifact, highlightedRegion }));
  const visualPassage = await page.locator(`.source-fact[data-fact-id="${visualFact.fact_id}"] .source-passage[data-locator-kind="visual_observation"]`).evaluate(node => ({ region: node.dataset.sourceRegion, observation: node.dataset.sourceObservation, agent: node.dataset.sourceAgent, hasQuote: Boolean(node.querySelector('q')) }));
  check('Visual source-to-fact grounding retains exact observation, region, and agent without quotation markup', visualPassage.region === JSON.stringify(visualRef.region) && visualPassage.observation === visualRef.observation && visualPassage.agent === visualRef.agent && !visualPassage.hasQuote && await page.locator('.opened-grounding q').count() === 0, JSON.stringify({ visualRef, visualPassage }));
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
  const neededItem = page.locator('.v20-document-body .v17-checklist-group[data-kind="needed"] .v17-checklist-item[data-node-id][data-fact-id][data-item-id]').first();
  check('Derived document items own structural node, fact, and item identifiers', await neededItem.count() === 1 && Boolean(await neededItem.getAttribute('data-node-id')) && Boolean(await neededItem.getAttribute('data-fact-id')) && Boolean(await neededItem.getAttribute('data-item-id')));
  if (isProductionJourney()) {
    const expectedChecklistContributions = processRun.result.checklist.items.map(item => ({
      item_id: item.item_id,
      contribution: contributionExpectation(item.agent_contribution, 'Evidence and Checklist Agent'),
    })).filter(item => item.contribution);
    const renderedChecklistContributions = await page.locator('.v20-document-body .v17-checklist-item[data-item-id]').evaluateAll(items => items.flatMap(item => {
      const badge = item.querySelector('.model-contribution-attribution');
      return badge ? [{ item_id: item.dataset.itemId, contribution: { authority: badge.dataset.contributionAuthority, accepted_count: badge.dataset.acceptedCount, fallback_count: badge.dataset.fallbackCount } }] : [];
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
  const flagshipBeforeReview = processRun;
  await page.locator('#journeyNext').click();
  await waitVisible('body[data-casepath-moment="review"]');
  const demoReviewCopy = await page.locator('#stageCanvas').innerText();
  check('Simulated demo review remains beside the complete graph and disclaims qualified approval', await page.locator('.review-graph .process-layout').count() === 1 && await page.locator('.review-choice').count() === 2 && /simulated demo review/i.test(demoReviewCopy) && /not qualified expert approval/i.test(demoReviewCopy), demoReviewCopy);
  await page.locator('input[value="required_now"]').check();
  await waitVisible('.v19-review-branch-preview[data-mode="required_now"]');
  await page.locator('input[value="conditional"]').check();
  await waitVisible('.v19-review-branch-preview[data-mode="conditional"]');
  await auditViewports('04-review', '#reviewForm');
  await page.locator('#reviewForm button[type="submit"]').click();
  await waitVisible('body[data-casepath-moment="review-applied"]');
  const reviewed = await waitForValue(() => reviewResponse);
  retainedEvidence['demo-review'] = reviewed;
  check('Demo review response is accepted, typed, and explicitly unverified', reviewed.accepted === true && reviewed.reviewer?.type === 'unverified_demo_user' && reviewed.reviewer?.qualification_status === 'not_verified' && reviewed.result?.process && reviewed.result?.checklist, JSON.stringify(reviewed));
  const persistedReviewedRun = await getJson(`${API}/api/runs/${encodeURIComponent(flagshipRunId)}`);
  retainedEvidence['post-review-run'] = persistedReviewedRun;
  const reviewTransformIssues = reviewTransformContractViolations(reviewed, persistedReviewedRun, flagshipBeforeReview);
  check(isProductionJourney() ? 'Review is an explicitly unverified post-model transform with exact pre/post hashes and preserved model-time acceptance receipts' : 'Local deterministic review is an explicitly unverified transform with exact pre/post hashes', reviewTransformIssues.length === 0, JSON.stringify(reviewTransformIssues));
  const appliedReviewCopy = await page.locator('#stageCanvas').innerText();
  check('Applied-review UI keeps the edit explicitly unverified', /unverified/i.test(appliedReviewCopy), appliedReviewCopy);
  if (isProductionJourney()) check('Applied-review UI says model acceptance was not reused for the unverified edit', /model acceptance\b[^.]{0,120}\b(?:was|is)\s+not reused/i.test(appliedReviewCopy), appliedReviewCopy);
  const appliedContributionBadgeCount = await page.locator('.review-applied .model-contribution-attribution').count();
  const postReviewContributionExpectations = [
    ...reviewed.result.process.nodes.flatMap(node => (node.agent_decision_contributions || []).map(contribution => contributionExpectation(contribution, 'Process Decision Mapping Agent', reviewed.review_transform))),
    ...reviewed.result.checklist.items.map(item => contributionExpectation(item.agent_contribution, 'Evidence and Checklist Agent', reviewed.review_transform)),
  ];
  check('Applied-review result fails closed on every pre-review model contribution badge', reviewed.review_transform?.acceptance_scope === 'post_review_unverified_transform' && reviewed.review_transform?.model_acceptance_reused === false && postReviewContributionExpectations.every(value => value === null) && appliedContributionBadgeCount === 0, JSON.stringify({ review_transform: reviewed.review_transform, post_review_expectations: postReviewContributionExpectations, rendered_badge_count: appliedContributionBadgeCount }));
  const reviewedNodeIds = reviewed.result.process.nodes.map(node => node.node_id);
  const appliedNodeIds = await page.evaluate(() => [...new Set([...document.querySelectorAll('.review-applied .process-node-button[data-node-id],.review-applied .process-branch-node[data-node-id]')].map(node => node.dataset.nodeId))]);
  check('Applied view shows the actual server-returned reviewed graph', reviewedNodeIds.every(id => appliedNodeIds.includes(id)) && reviewedNodeIds.length === appliedNodeIds.length);
  const appliedEdges = await page.locator('.review-applied .process-edge[data-edge-source][data-edge-target]').evaluateAll(edges => edges.map(edge => ({ source: edge.dataset.edgeSource, target: edge.dataset.edgeTarget, state: edge.dataset.edgeState })));
  const reviewedEdges = reviewed.result.process.edges.map(edge => ({ source: edge.source, target: edge.target, state: edge.state || '' }));
  check('Applied view retains every server-returned reviewed graph connection', JSON.stringify(appliedEdges) === JSON.stringify(reviewedEdges), JSON.stringify({ reviewedEdges, appliedEdges }));
  check('Applied view shows the actual server-returned reviewed checklist', await page.locator('.reviewed-checklist [data-item-id]').count() === reviewed.result.checklist.items.length);
  const reviewedSelectedNode = reviewed.result.process.nodes.find(node => node.node_id === reviewed.result.process.current_overlay?.current_node_id);
  const reviewedSelectedFacts = reviewed.result.facts.filter(fact => (reviewedSelectedNode?.fact_ids || []).includes(fact.fact_id)).slice(0, 2);
  const reviewedFactChain = await page.locator('.review-applied .v17-evidence-chain').innerText();
  check('Applied fact chain remains bound to the displayed reviewed run', reviewedSelectedFacts.length > 0 && reviewedSelectedFacts.every(fact => reviewedFactChain.includes(`${fact.label}: ${fact.value}`)), JSON.stringify({ reviewedSelectedFacts, reviewedFactChain }));
  const beforeNodeIds = new Set(flagshipBeforeReview.result.process.nodes.map(node => node.node_id));
  const computedAdded = reviewedNodeIds.filter(id => !beforeNodeIds.has(id));
  check('Applied view presents a computed delta before consolidation', (await page.locator('.review-applied-delta article').first().innerText()).includes(String(computedAdded.length)));
  await auditViewports('05-review-applied', '.review-applied');

  await page.locator('#journeyNext').click();
  await waitVisible('.v20-learning-summary');
  check('Candidate is honestly quarantined at one of three', reviewed.candidate?.status === 'quarantined' && reviewed.candidate?.support_count === 1 && reviewed.candidate?.required_support === 3 && /1 of 3 support records/i.test(await page.locator('[data-outcome="candidate"]').innerText()));
  check('Shared playbook is explicitly unchanged', reviewed.candidate?.shared_knowledge_changed === false && /shared playbook unchanged/i.test(await page.locator('.v20-learning-summary').innerText()) && /mould-playbook-v3/i.test(await page.locator('[data-outcome="shared-playbook"]').innerText()));
  check('Unrun gates are not presented as successes', /not_run/i.test(await page.locator('[data-outcome="candidate"]').innerText()) && !/playbook released|6\/6 passed|12\/12 unchanged/i.test(await page.locator('.v20-learning-summary').innerText()));
  await auditViewports('06-learning', '.v20-learning-summary');

  await page.locator('#journeyNext').click();
  await waitJourneyUi('Later-claim comparison did not reach its terminal UI state', async () => {
    await waitText('#journeyNext', /Restart the demo/i, runTimeoutMs());
    await waitVisible('body[data-casepath-moment="later-result"]', runTimeoutMs());
  });
  const proof = await waitForValue(() => proofResponse, runTimeoutMs());
  retainedEvidence['learning-proof'] = proof;
  check('Lifecycle produced flagship, baseline, and post-review runs', runIds.length === 3, JSON.stringify(runIds));
  const baseline = await awaitRun(runIds[1]);
  const later = await awaitRun(runIds[2]);
  retainedEvidence['later-baseline-run'] = baseline;
  retainedEvidence['later-after-memory-run'] = later;
  if (!isLocal(BASE) || !isLocal(API)) {
    check('Both later-claim comparisons retain the same bounded Nemotron contract', isNemotronRun(baseline) && isNemotronRun(later), JSON.stringify({ baseline: baseline.result?.audit?.canonicalization, later: later.result?.audit?.canonicalization }));
  }
  check('Computed proof names both completed later-claim runs', proof.before?.run_id === baseline.run_id && proof.after?.run_id === later.run_id);
  check('Later claim keeps the shared v3 playbook and applies no shared rule', later.result?.playbook?.version === 'mould-playbook-v3' && later.result?.shared_rule_applied === false);
  const laterProcess = later.result?.process || later.process;
  const laterCurrentNodeId = laterProcess?.current_overlay?.current_node_id || laterProcess?.current_node;
  const laterCurrentNode = laterProcess?.nodes?.find(node => node.node_id === laterCurrentNodeId);
  check('Later claim stops at the returned unverified tenant-law scope gate', later.result?.category === 'Moisture and condensation report' && later.result?.scope === 'Residential-tenancy scope unverified' && laterCurrentNodeId === 'scope' && laterCurrentNode?.state === 'current' && laterCurrentNode?.answer === 'Unverified', JSON.stringify({ category: later.result?.category, scope: later.result?.scope, current_node_id: laterCurrentNodeId, current_node: laterCurrentNode }));
  const laterScope = page.locator('#laterResult .later-process-result .process-node.current .process-node-button[data-node-id="scope"]');
  check('Later UI renders its own current scope node as Unverified', await laterScope.count() === 1 && /Current decision/i.test(await laterScope.innerText()) && /Tenant-law scope/i.test(await laterScope.innerText()) && /Unverified/i.test(await laterScope.innerText()), await page.locator('#laterResult .later-process-result').innerText());
  const laterProcessText = await page.locator('#laterResult .later-process-result').innerText();
  const downstreamPrimaryIds = ['dispute', 'urgency', 'notification', 'defect', 'causation', 'responsibility', 'remedy'];
  const completedDownstreamCount = await page.locator(downstreamPrimaryIds.map(nodeId => `#laterResult .later-process-result .process-node.complete .process-node-button[data-node-id="${nodeId}"]`).join(',')).count();
  check('Later UI does not reuse the flagship in-scope path or completed downstream decisions', !/\bIn scope\b/i.test(laterProcessText) && completedDownstreamCount === 0, JSON.stringify({ laterProcessText, completedDownstreamCount }));
  const memoryUsed = later.result?.reviewed_memory_used === true && proof.reviewed_memory_proof?.used === true;
  check('Later UI claims unverified demo-memory use only when both run and proof return it', memoryUsed ? await page.locator('.v20-later-heading[data-memory-used="true"]').count() === 1 && /unverified demo memory used/i.test(await page.locator('.v20-later-heading').innerText()) : !/unverified demo memory used/i.test(await page.locator('.v20-later-heading').innerText()));
  check('Before/after uses returned hashes and computed changes', (await page.locator('#laterResult').innerText()).includes(proof.before.result_hash) && (await page.locator('#laterResult').innerText()).includes(proof.after.result_hash));
  await auditViewports('07-later-result', '#laterResult .before-after');

  check('Immutable release marker was never rewritten during the journey', await page.evaluate(() => window.__casepathReleaseMutations.length === 0), JSON.stringify(await page.evaluate(() => window.__casepathReleaseMutations)));
  check('Skip link remains present', await page.locator('.skip-link').count() === 1);
  check('Visible icon controls have accessible names', await page.evaluate(() => [...document.querySelectorAll('button.icon-button:not([hidden]),a.icon-button:not([hidden])')].every(node => node.getAttribute('aria-label') || node.textContent.trim())));
  await runAxe('Final lifecycle state');
  check('No browser console errors', failures.console.length === 0, JSON.stringify(failures.console));
  check('No page errors', failures.page.length === 0, JSON.stringify(failures.page));
  check('No product request failures', failures.request.length === 0, JSON.stringify(failures.request));

  const modelLedger = await getJson(`${API}/api/model-ledger`);
  const ledgerIssues = sanitizedLedgerViolations(modelLedger);
  check('Public model ledger is sanitized and retains no prompt, raw output, reasoning, or canonical-output payload', ledgerIssues.length === 0, JSON.stringify(ledgerIssues));
  const successfulNetworkCalls = modelLedger.items.filter(item => SUCCESSFUL_MODEL_OUTCOMES.has(item.outcome) && item.call_count === 1 && item.provider_endpoint === 'https://openrouter.ai/api/v1/chat/completions');
  check('Successful network calls retain an exact unnormalized Nemotron alias or dated response identity and usage provenance', successfulNetworkCalls.every(item => item.provider === 'openrouter' && item.model === REQUESTED_NEMOTRON_MODEL && EXACT_NEMOTRON_RESPONSE_MODELS.has(item.response_model) && ALLOWED_USAGE_SOURCES.has(item.usage_source)), JSON.stringify(successfulNetworkCalls));
  if (isProductionJourney()) {
    const finalColdIssues = coldLedgerContractViolations(coldOrchestration, modelLedger);
    check('Final ledger still contains all six immutable visible-flagship cold-call acceptance records', finalColdIssues.length === 0, JSON.stringify(finalColdIssues));
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
  const process = { contract: 'process-graph', nodes: [{ node_id: 'scope' }] };
  const checklist = { contract: 'evidence-model', items: [{ item_id: 'lease' }] };
  const finalClaimBrief = { current_node_id: 'scope', next_action_node_id: 'notice' };
  const orchestrationId = cacheMode === 'cold' ? 'orch_cold_contract' : 'orch_warm_contract';
  const coldAudit = orchestrationAudit(coldRun);
  const coldByAgent = new Map((coldAudit?.agents || []).map(item => [item.agent_id, item]));
  const callIdFor = agentId => `${cacheMode}_call_${agentId}`;
  const canonicalCallId = callIdFor('canonical_facts');
  const orchestratorCallId = callIdFor('orchestrator_plan');
  const agents = REQUIRED_NEMOTRON_AGENT_IDS.map(agentId => ({
    agent_id: agentId,
    role: `Mock ${agentId}`,
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
    accepted_ids: [`accepted_${agentId}_1`, `accepted_${agentId}_2`],
    accepted_count: 2,
    rejected_count: 0,
    source_reference_projection_fact_ids: agentId === 'canonical_facts' ? [] : undefined,
    source_reference_projection_count: agentId === 'canonical_facts' ? 0 : undefined,
    deterministic_fallback_applied: false,
    input_artifact_hash: dtoHash({ agent_id: agentId, direction: 'input' }),
    output_artifact_hash: dtoHash({ agent_id: agentId, direction: 'output' }),
  }));
  const byAgent = new Map(agents.map(item => [item.agent_id, item]));
  const finalDtos = { deterministic_process_gate: process, deterministic_evidence_gate: checklist, whole_playbook_gate: finalClaimBrief };
  const gates = REQUIRED_DETERMINISTIC_GATE_IDS.map(gateId => {
    const contract = ACCEPTED_ARTIFACT_CONTRACT[gateId];
    return {
      agent_id: gateId,
      role: `Mock ${gateId}`,
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
      input_artifact_hash: dtoHash({ gate_id: gateId, direction: 'input' }),
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
  return { run_id: `${cacheMode}_run`, status: 'complete', agent_orchestration: audit, result: { process, checklist, agent_orchestration: audit, audit: { agent_orchestration: audit } }, events };
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

function runContractSelfTest() {
  if (dtoHash({ z: 'ü', a: [{ k: 0.91 }, true, null] }) !== '3d745913ce5b8f5555065b544f018be38bd43e9e5bfe1eca86c1d4f25dda68dd') throw new Error('Compact sorted DTO hashing diverges from the Python release contract');
  const pythonFloatHashes = [
    [{ value: 1.0 }, '3a7d647740ec6f86b72e0bf3948ab456551e07e9605e3a2785de1c66842ebb48'],
    [{ value: -0.0 }, 'c848a4efa987f46ba3bfd46242333afcb1c68c3240e0f35ae9d269b1c980648b'],
    [{ value: 1e-7 }, 'aece37dfda4992947222ea73b79996bba4aa181345a1fbb7f8c2b56b3fbd6a44'],
  ];
  if (pythonFloatHashes.some(([value, pythonHash]) => dtoHash(value) === pythonHash)) throw new Error('Float parity fixture unexpectedly became hash-compatible; update the shared numeric contract explicitly');
  if (nonIntegerNumberPaths({ negative_zero: -0.0, exponent: 1e-7 }).length !== 2) throw new Error('Non-integer accepted-DTO guard missed -0.0 or exponent notation');
  const acceptedContribution = contributionExpectation({ attribution: 'Process Decision Mapping Agent', deterministic_fallback_applied: false }, 'Process Decision Mapping Agent');
  const fallbackContribution = contributionExpectation({ attribution: 'deterministic_application', deterministic_fallback_applied: true }, 'Process Decision Mapping Agent');
  const postReviewContribution = contributionExpectation(
    { attribution: 'Process Decision Mapping Agent', deterministic_fallback_applied: false },
    'Process Decision Mapping Agent',
    { acceptance_scope: 'post_review_unverified_transform', model_acceptance_reused: false },
  );
  if (stableJson(acceptedContribution) !== stableJson({ authority: 'nemotron-accepted', accepted_count: '1', fallback_count: '0' })
    || stableJson(fallbackContribution) !== stableJson({ authority: 'deterministic-fallback', accepted_count: '0', fallback_count: '1' })
    || postReviewContribution !== null
    || contributionExpectation({ attribution: 'Process Decision Mapping Agent' }, 'Process Decision Mapping Agent') !== null
    || contributionExpectation({ attribution: 'foreign_agent', deterministic_fallback_applied: false }, 'Process Decision Mapping Agent') !== null) throw new Error('Visible contribution attribution does not fail closed on authority or fallback state');
  const coldRun = mockOrchestration('cold');
  const coldLedger = mockLedgerForRun(coldRun, 'cold');
  const warmRun = mockOrchestration('warm', coldRun);
  const warmOnlyLedger = mockLedgerForRun(warmRun, 'warm', coldLedger);
  const combinedItems = [...coldLedger.items, ...warmOnlyLedger.items];
  const combinedLedger = { ...coldLedger, items: combinedItems, summary: ledgerSummary(combinedItems) };
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
  const upstreamRejectionFailure = structuredClone(safeTerminalFailure);
  const upstreamReceipt = upstreamRejectionFailure.events.find(item => item.receipt_type === 'agent_failed');
  Object.assign(upstreamReceipt, {
    error_invariant: 'provider_upstream_rejection',
    response_id: 'gen-1786483159-hyYthqPv76o6PHXpGLzl',
    provider_error_code: 400,
  });
  upstreamRejectionFailure.events.find(item => item.stage === 'failed').failure_invariant = 'provider_upstream_rejection';
  const upstreamFailureIssues = terminalFailureContractViolations(upstreamRejectionFailure);
  if (upstreamFailureIssues.length) throw new Error(`Bounded upstream-rejection fixture failed: ${JSON.stringify(upstreamFailureIssues)}`);
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
  const claimBearingUpstreamIdLedger = structuredClone(coldLedger);
  Object.assign(claimBearingUpstreamIdLedger.items[0], {
    outcome: 'failed',
    error_invariant: 'provider_upstream_rejection',
    provider_error_code: 400,
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
  return { status: 'passed', fixtures: ['python_compatible_dto_hash', 'float_hash_divergence_fail_closed', 'fail_closed_model_contribution_badges', 'production_opening_context', 'legacy_production_opening_rejection', 'premature_nemotron_plan_rejection', 'cold_network', 'cold_upstream_provider_policy_rejection', 'warm_upstream_provider_policy_rejection', 'raw_alias_response_model', 'response_model_normalization_rejection', 'foreign_response_model_rejection', 'warm_lineage', 'review_transform_truth', 'deterministic_review_transform_truth', 'review_model_reacceptance_rejection', 'sensitive_field_rejection', 'internal_sentinel_rejection', 'topology_authority_misattribution_rejection', 'topology_dependency_rejection', 'final_payload_audit_binding_rejection', 'terminal_failure_sentinel_rejection', 'safe_terminal_diagnostics', 'safe_failure_receipt', 'safe_upstream_rejection_receipt', 'unbounded_upstream_error_code_rejection', 'failure_receipt_allowlist_rejection', 'failure_receipt_lineage_rejection', 'charged_overrun_failure', 'hashed_invalid_model_provenance', 'raw_foreign_model_rejection', 'credential_provenance_rejection', 'claim_text_provenance_rejection', 'partial_response_identity_failure', 'canonical_root_failure', 'canonical_invalid_provenance_failure', 'claim_bearing_ledger_provenance_rejection', 'bounded_invalid_provenance_ledger', 'retained_invalid_provenance_rejection', 'foreign_invalid_provenance_field_rejection', 'accepted_minority_rejection', 'invalid_source_projection_rejection', 'wrong_artifact_hash_rejection', 'duplicate_response_rejection', 'broken_lineage_rejection'], agents: REQUIRED_NEMOTRON_AGENT_IDS, gates: REQUIRED_DETERMINISTIC_GATE_IDS };
}

let report;
if (process.env.CASEPATH_QA_CONTRACT_SELF_TEST === '1') {
  console.log(JSON.stringify(runContractSelfTest(), null, 2));
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
