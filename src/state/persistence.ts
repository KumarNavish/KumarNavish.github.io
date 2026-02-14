import type { MemoryItem } from "../cl/memory";
import type { EwcState, RouterMode, RouterParams } from "../cl/router";
import type { Example, ProcessId } from "../domain/types";
import type { ContinualComparisonResult, MemoryStrategyId } from "../eval/continual_comparison";

export type DemoTabId = "inbox" | "teach" | "evaluate" | "memory" | "audit";

export interface AuditEntryState {
  id: number;
  timestamp: string;
  action: string;
  detail: string;
}

export interface EvalSnapshotState {
  id: number;
  timestamp: string;
  seenProcesses: ProcessId[];
  result: ContinualComparisonResult;
}

export interface DemoControlsState {
  memoryStrategyId: MemoryStrategyId;
  memoryBudget: number;
  retrievalK: number;
  clMode: RouterMode;
  driftEnabled: boolean;
}

export interface DemoStateSnapshot {
  activeTab: DemoTabId;
  controls: DemoControlsState;
  seenProcesses: ProcessId[];
  trainStream: Example[];
  memoryItems: MemoryItem[];
  routerParams: RouterParams;
  ewcState: EwcState | null;
  auditLog: AuditEntryState[];
  evalSnapshots: EvalSnapshotState[];
  comparisonResult: ContinualComparisonResult | null;
  inboxRequest: string;
}

interface SerializedRouterParams {
  W: number[];
  b: number[];
}

interface SerializedEwcState {
  lambda: number;
  fisherW: number[];
  fisherB: number[];
  refW: number[];
  refB: number[];
}

interface SerializedMemoryItem {
  id: string;
  process_id: string;
  risk_tag: string;
  embedding: number[];
  seen_at: number;
  payload?: Record<string, unknown>;
}

interface PersistedDemoStateV1 {
  version: 1;
  updatedAt: string;
  activeTab: DemoTabId;
  controls: DemoControlsState;
  seenProcesses: ProcessId[];
  trainStream: Example[];
  memoryItems: SerializedMemoryItem[];
  router: SerializedRouterParams;
  ewcState: SerializedEwcState | null;
  auditLog: AuditEntryState[];
  evalSnapshots: EvalSnapshotState[];
  comparisonResult: ContinualComparisonResult | null;
  inboxRequest: string;
}

const STORAGE_KEY = "cpac_demo_state_v1";

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "number" && Number.isFinite(entry));
}

function toNumberArray(vec: Float32Array): number[] {
  return Array.from(vec);
}

function toFloat32Array(values: number[]): Float32Array {
  return new Float32Array(values);
}

function serializeMemoryItem(item: MemoryItem): SerializedMemoryItem {
  return {
    id: item.id,
    process_id: item.process_id,
    risk_tag: item.risk_tag,
    embedding: toNumberArray(item.embedding),
    seen_at: item.seen_at,
    payload: item.payload,
  };
}

function deserializeMemoryItem(raw: SerializedMemoryItem): MemoryItem {
  return {
    id: raw.id,
    process_id: raw.process_id,
    risk_tag: raw.risk_tag as "low" | "medium" | "high",
    embedding: toFloat32Array(raw.embedding),
    seen_at: raw.seen_at,
    payload: raw.payload,
  };
}

export function serializeDemoState(snapshot: DemoStateSnapshot): PersistedDemoStateV1 {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    activeTab: snapshot.activeTab,
    controls: snapshot.controls,
    seenProcesses: snapshot.seenProcesses,
    trainStream: snapshot.trainStream,
    memoryItems: snapshot.memoryItems.map(serializeMemoryItem),
    router: {
      W: toNumberArray(snapshot.routerParams.W),
      b: toNumberArray(snapshot.routerParams.b),
    },
    ewcState: snapshot.ewcState
      ? {
          lambda: snapshot.ewcState.lambda,
          fisherW: toNumberArray(snapshot.ewcState.fisherW),
          fisherB: toNumberArray(snapshot.ewcState.fisherB),
          refW: toNumberArray(snapshot.ewcState.refW),
          refB: toNumberArray(snapshot.ewcState.refB),
        }
      : null,
    auditLog: snapshot.auditLog,
    evalSnapshots: snapshot.evalSnapshots,
    comparisonResult: snapshot.comparisonResult,
    inboxRequest: snapshot.inboxRequest,
  };
}

export function deserializeDemoState(raw: unknown): DemoStateSnapshot | null {
  if (!isRecord(raw) || raw.version !== 1) {
    return null;
  }

  const router = raw.router;
  if (!isRecord(router) || !isNumberArray(router.W) || !isNumberArray(router.b)) {
    return null;
  }

  const memoryItemsRaw = raw.memoryItems;
  const memoryItems: MemoryItem[] = Array.isArray(memoryItemsRaw)
    ? memoryItemsRaw
        .filter(
          (entry): entry is SerializedMemoryItem =>
            isRecord(entry) &&
            typeof entry.id === "string" &&
            typeof entry.process_id === "string" &&
            typeof entry.risk_tag === "string" &&
            typeof entry.seen_at === "number" &&
            isNumberArray(entry.embedding),
        )
        .map(deserializeMemoryItem)
    : [];

  const ewcStateRaw = raw.ewcState;
  let ewcState: EwcState | null = null;
  if (
    isRecord(ewcStateRaw) &&
    typeof ewcStateRaw.lambda === "number" &&
    isNumberArray(ewcStateRaw.fisherW) &&
    isNumberArray(ewcStateRaw.fisherB) &&
    isNumberArray(ewcStateRaw.refW) &&
    isNumberArray(ewcStateRaw.refB)
  ) {
    ewcState = {
      lambda: ewcStateRaw.lambda,
      fisherW: toFloat32Array(ewcStateRaw.fisherW),
      fisherB: toFloat32Array(ewcStateRaw.fisherB),
      refW: toFloat32Array(ewcStateRaw.refW),
      refB: toFloat32Array(ewcStateRaw.refB),
    };
  }

  return {
    activeTab: (raw.activeTab as DemoTabId) ?? "inbox",
    controls: {
      memoryStrategyId: (raw.controls as DemoControlsState | undefined)?.memoryStrategyId ?? "reservoir",
      memoryBudget: (raw.controls as DemoControlsState | undefined)?.memoryBudget ?? 32,
      retrievalK: (raw.controls as DemoControlsState | undefined)?.retrievalK ?? 3,
      clMode: (raw.controls as DemoControlsState | undefined)?.clMode ?? "rehearsal",
      driftEnabled: (raw.controls as DemoControlsState | undefined)?.driftEnabled ?? false,
    },
    seenProcesses: Array.isArray(raw.seenProcesses) ? (raw.seenProcesses as ProcessId[]) : [],
    trainStream: Array.isArray(raw.trainStream) ? (raw.trainStream as Example[]) : [],
    memoryItems,
    routerParams: {
      W: toFloat32Array(router.W),
      b: toFloat32Array(router.b),
    },
    ewcState,
    auditLog: Array.isArray(raw.auditLog) ? (raw.auditLog as AuditEntryState[]) : [],
    evalSnapshots: Array.isArray(raw.evalSnapshots) ? (raw.evalSnapshots as EvalSnapshotState[]) : [],
    comparisonResult: (raw.comparisonResult as ContinualComparisonResult | null) ?? null,
    inboxRequest:
      typeof raw.inboxRequest === "string"
        ? raw.inboxRequest
        : "Please escalate INC-9901 for checkout outage and treat as sev1.",
  };
}

export function saveDemoState(snapshot: DemoStateSnapshot): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(serializeDemoState(snapshot)));
  } catch {
    // Ignore storage quota or serialization failures.
  }
}

export function loadDemoState(): DemoStateSnapshot | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return deserializeDemoState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearDemoState(): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
