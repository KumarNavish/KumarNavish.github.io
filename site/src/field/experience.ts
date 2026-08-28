export type FieldChapter = 'entry' | 'trajectory' | 'proof' | 'replay' | 'contact'

export interface FieldState {
  chapter: FieldChapter
  focusedEntityId: string | null
  evidenceLens: boolean
  reducedMotion: boolean
}

export type FieldAction =
  | { type: 'ENTER_CHAPTER'; chapter: FieldChapter }
  | { type: 'FOCUS_ENTITY'; entityId: string | null }
  | { type: 'SET_EVIDENCE_LENS'; enabled: boolean }
  | { type: 'SET_REDUCED_MOTION'; enabled: boolean }

export function createInitialFieldState(options: {
  evidenceLens: boolean
  reducedMotion: boolean
}): FieldState {
  return {
    chapter: 'entry',
    focusedEntityId: null,
    evidenceLens: options.evidenceLens,
    reducedMotion: options.reducedMotion,
  }
}

export function fieldReducer(state: FieldState, action: FieldAction): FieldState {
  switch (action.type) {
    case 'ENTER_CHAPTER':
      return action.chapter === state.chapter ? state : { ...state, chapter: action.chapter }
    case 'FOCUS_ENTITY':
      return action.entityId === state.focusedEntityId
        ? state
        : { ...state, focusedEntityId: action.entityId }
    case 'SET_EVIDENCE_LENS':
      return action.enabled === state.evidenceLens
        ? state
        : { ...state, evidenceLens: action.enabled }
    case 'SET_REDUCED_MOTION':
      return action.enabled === state.reducedMotion
        ? state
        : { ...state, reducedMotion: action.enabled }
    default:
      return state
  }
}
