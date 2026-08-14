(() => {
  'use strict';

  const MOMENT_COPY = {
    process: {
      eyebrow: 'Deterministic process candidate ready',
      title: 'Handling process',
      detail: 'The main handling path is visible. Select a decision to inspect what it knows and what it still needs.',
    },
    evidence: {
      eyebrow: 'Deterministic evidence candidate ready',
      title: 'Evidence within the process',
      detail: 'Evidence now appears at the decision it can resolve—not as a separate report.',
    },
    experience: {
      eyebrow: 'Reference retrieval complete',
      title: 'Previous experience at the difficult decision',
      detail: 'Returned precedents contribute where the current process is uncertain and remain labelled by provenance.',
    },
    verify: {
      eyebrow: 'Deterministic verification complete',
      title: 'Verified handling process',
      detail: 'Unsupported links were rejected. The remaining process and evidence relationships are ready for review.',
    },
    ready: {
      eyebrow: 'Ready for simulated review',
      title: 'Handling playbook',
      detail: 'Review the process itself. Supporting evidence, law, and experience are attached to its decisions.',
    },
    review: {
      eyebrow: 'Simulated demo review',
      title: 'Correct the decision that changes the downstream process',
      detail: 'The selected evidence order updates the process, evidence requirements, and next action together.',
    },
  };

  const FLAGSHIP_STAGES = [
    { id: 'understand', label: 'Claim understanding' },
    { id: 'research', label: 'Swiss-law research' },
    { id: 'process', label: 'Process discovery' },
    { id: 'evidence', label: 'Evidence requirements' },
    { id: 'experience', label: 'Historical claims' },
    { id: 'verify', label: 'Verification' },
    { id: 'knowledge', label: 'Knowledge' },
  ];

  // These are the six call-bound roles returned by the Nemotron runtime. Keep
  // this map closed: deterministic tools and gates must never inherit an agent
  // signature simply because they are presented during the same product stage.
  const NEMOTRON_AGENT_IDENTITIES = Object.freeze({
    canonical_facts: {
      order: 1, label: 'Guarded Canonical Facts Agent', shortLabel: 'Claim facts', monogram: 'CF', signature: 'facts',
      title: 'Separating supported facts from allegations and unknowns',
      why: 'Only source-bound facts should shape the handling process.', output: 'Canonical claim state',
      target: '.decision-inspector .inspector-fact:first-of-type,.fact-row:last-child,.process-node.current .process-node-button',
    },
    orchestrator_plan: {
      order: 2, label: 'Nemotron Orchestrator', shortLabel: 'Orchestration', monogram: 'OR', signature: 'orchestrator',
      title: 'Setting the bounded focus for every specialist',
      why: 'A shared plan keeps parallel contributions coherent.', output: 'Orchestration focus plan',
      target: '.process-build-focus,.process-spine,.process-synthesis',
    },
    document_source_integrity: {
      order: 3, label: 'Document and Source Integrity Agent', shortLabel: 'Source integrity', monogram: 'DS', signature: 'sources',
      title: 'Checking every source link and document reference',
      why: 'A decision is trustworthy only when its evidence can be reopened.', output: 'Source integrity contribution',
      target: '.decision-inspector .grounding-ref:first-of-type,.official-source-browser,.decision-inspector .law-marker:first-of-type',
    },
    process_decision_mapping: {
      order: 4, label: 'Process Decision Mapping Agent', shortLabel: 'Process mapping', monogram: 'PM', signature: 'process',
      title: 'Mapping facts and law into the decision process',
      why: 'Each node must exist for a grounded, inspectable reason.', output: 'Process mapping contribution',
      target: '.process-node.current .process-node-button,.process-node-button[aria-current="step"],.process-node-button:first-of-type',
    },
    evidence_checklist: {
      order: 5, label: 'Evidence and Checklist Agent', shortLabel: 'Evidence mapping', monogram: 'EC', signature: 'evidence',
      title: 'Attaching evidence to the decision it can resolve',
      why: 'Requirements become useful when their process owner is explicit.', output: 'Evidence checklist contribution',
      target: '.decision-inspector .inspector-row:last-of-type,.v17-checklist-item:last-child,.process-node.current .node-evidence-count',
    },
    final_claim_brief_audit: {
      order: 6, label: 'Final Claim Brief Agent', shortLabel: 'Final audit', monogram: 'FB', signature: 'audit',
      title: 'Auditing the complete claim-handling brief',
      why: 'The final handoff must remain consistent across every contribution.', output: 'Final claim brief contribution',
      target: '.v20-final-handoff,.verification-row:last-child,.process-synthesis',
    },
  });

  const NEMOTRON_AGENT_COUNT = Object.keys(NEMOTRON_AGENT_IDENTITIES).length;

  const FLAGSHIP_FOCUS = {
    opening: { stage: 'understand', title: 'Opening one shared claim context', why: 'Every specialist must work from the same message and original files.', context: 'Customer message + 6 original attachments', authority: 'Application source parser', output: 'Shared claim package' },
    read: { stage: 'understand', title: 'Reading the message and every original attachment', why: 'Nothing should enter the claim state without an exact source.', context: 'Customer message + source package', authority: 'Application source parser', output: 'Grounded source package' },
    understand: { stage: 'understand', title: 'Separating facts, allegations, conflicts and unknowns', why: 'Unsupported allegations must never become accepted facts.', context: '18 bounded claim facts + exact source references', authority: 'Nemotron agent · deterministic fact contract', output: 'Canonical claim state' },
    research: { stage: 'research', title: 'Connecting official Swiss-law passages to handling questions', why: 'Law should frame the questions—not guess the technical cause.', context: 'Versioned official source registry · qualified legal review pending', authority: 'Deterministic source registry', output: 'Legal questions and exact sources' },
    process: { stage: 'process', title: 'Building the complete claim-handling process', why: 'Every downstream action depends on the right decision path.', context: 'Claim state + legal questions + bounded orchestrator focus', authority: 'Nemotron contribution · deterministic process gate', output: 'Handling process graph' },
    evidence: { stage: 'evidence', title: 'Attaching every evidence need to the decision it can resolve', why: 'A decision should advance only when its required proof exists.', context: 'Original artifacts + process decisions + source integrity', authority: 'Nemotron agents · deterministic evidence gate', output: 'Process-linked evidence model' },
    experience: { stage: 'experience', title: 'Ranking the most relevant provenance-labelled reference cases', why: 'Past patterns help only when relevance and provenance stay visible.', context: 'Legal question + difficult process branch + unresolved fact', authority: 'Deterministic reference ranking', output: 'Ranked reference cases' },
    verify: { stage: 'verify', title: 'Checking grounding, consistency and unsupported conclusions', why: 'Unsupported conclusions must fail closed before review.', context: 'Agent contributions + graph + evidence relationships', authority: 'Nemotron audit · deterministic acceptance', output: 'Verified handling playbook' },
    ready: { stage: 'verify', title: 'A source-grounded handling playbook is ready', why: 'The reviewer should see one coherent path with its evidence attached.', context: '6 returned model roles + 3 deterministic safety gates', authority: 'Deterministically verified demo result', output: 'Review-ready playbook' },
    review: { stage: 'verify', title: 'Review the decision that changes the downstream process', why: 'One expert correction should update every dependent artifact together.', context: 'Simulated demo review · not qualified expert approval', authority: 'Human-in-the-loop demonstration', output: 'Proposed process correction' },
    'review-applied': { stage: 'knowledge', title: 'Applying the correction across process and evidence', why: 'The reviewed decision must remain consistent everywhere it appears.', context: 'Reviewed graph + reviewed evidence relationships', authority: 'Deterministic review transform', output: 'Corrected handling process' },
    knowledge: { stage: 'knowledge', title: 'Turning the correction into safely governed knowledge', why: 'One correction must not silently rewrite shared organizational rules.', context: 'Unverified case memory · shared playbook remains unchanged', authority: 'Deterministic knowledge governance', output: 'Quarantined reusable knowledge' },
    'later-work': { stage: 'knowledge', title: 'Testing the learned guidance on a held-out claim', why: 'Reusable knowledge should prove its value on a separate claim.', context: 'Frozen memory receipt + later demo claim', authority: 'Deterministic comparison · no second model run', output: 'Before-and-after comparison' },
    'later-result': { stage: 'knowledge', title: 'Showing exactly how the future claim improved', why: 'The learning effect must be visible, bounded and receipt-backed.', context: 'Receipt-bound guidance · shared playbook unchanged', authority: 'Deterministic comparison · no second model run', output: 'Verified learning effect' },
    failure: { stage: 'understand', title: 'The run stopped safely', why: 'No partial or unsupported result should reach the handler.', context: 'No unsupported result was applied', authority: 'Fail-closed safety boundary', output: 'No artifact produced' },
  };

  const CURSOR_ACTIONS = {
    opening: 'Opening the customer message and original attachments',
    read: 'Reading the customer message and original attachments',
    understand: 'Checking each claim fact against its source',
    research: 'Linking official passages to handling questions',
    process: 'Mapping the unresolved causation branch',
    evidence: 'Attaching evidence to the decisions it can resolve',
    experience: 'Ranking references at the difficult branch',
    verify: 'Testing grounding, graph integrity and evidence links',
    ready: 'Preparing the verified playbook for review',
    review: 'Waiting for the simulated review decision',
    'review-applied': 'Applying the correction across the process',
    knowledge: 'Quarantining unverified learning safely',
    'later-work': 'Comparing the held-out claim with frozen guidance',
    'later-result': 'Verifying the receipt-bound learning effect',
    failure: 'Preserving the last supported state',
  };

  const PLAIN_AUTHORITIES = {
    opening: 'CasePath source parser', read: 'CasePath source parser',
    understand: 'CasePath fact contract', research: 'Versioned source registry · legal review pending',
    process: 'CasePath process checks', evidence: 'CasePath evidence checks',
    experience: 'CasePath reference ranking', verify: 'CasePath safety checks',
    ready: 'CasePath safety checks', review: 'Simulated review',
    'review-applied': 'CasePath review transform', knowledge: 'CasePath governance',
    'later-work': 'Deterministic comparison', 'later-result': 'Deterministic comparison',
    failure: 'Fail-closed safety boundary',
  };

  const PRODUCED_EVENT_STATES = new Set(['accepted', 'cache_hit', 'candidate_prepared', 'completed', 'passed', 'succeeded', 'succeeded_with_guarded_fallback', 'success']);
  const CURSOR_TARGET_MIN_HOLD_MS = 220;

  const OWNED_ARTIFACT_COPY = Object.freeze({
    canonical_facts: {
      title: 'Canonical claim state',
      detail: 'The returned fact contribution keeps supported facts, allegations and unknowns separate.',
      selector: '.fact-row strong',
    },
    orchestrator_plan: {
      title: 'Bounded orchestration focus',
      detail: 'The returned plan sets the shared focus used by the downstream specialist calls.',
      selector: '',
    },
    document_source_integrity: {
      title: 'Claim-source integrity contribution',
      detail: 'This returned contribution checks claim documents and source references. Official-law tabs remain a separate deterministic cached registry view.',
      selector: '.fact-row .grounding-source-title',
    },
    process_decision_mapping: {
      title: 'Process decision contribution',
      detail: 'The returned decision mapping is the model contribution submitted to the deterministic process gate.',
      selector: '.process-node-button strong,.process-branch-node strong',
    },
    evidence_checklist: {
      title: 'Evidence checklist contribution',
      detail: 'The returned checklist contribution binds evidence needs to the decisions they can resolve.',
      selector: '.inspector-row[data-item-id] strong,.v17-checklist-item strong',
    },
    final_claim_brief_audit: {
      title: 'Final claim brief contribution',
      detail: 'The returned audit contribution names the current decision, next action and supporting lineage for the whole-playbook gate.',
      selector: '.v20-final-handoff-route strong',
    },
  });

  let queued = false;
  let lastMoment = '';
  const cursorMotion = {
    activationKey: '', cursor: null, target: null, x: null, y: null,
    clickTimer: 0, targetTimer: 0, holdTimer: 0, activatedAt: 0,
    emittedActivationKeys: new Set(),
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = '') => String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));

  function visible(element) {
    return Boolean(element && !element.hidden && element.getAttribute('aria-hidden') !== 'true');
  }

  function currentMoment() {
    const start = $('#startState');
    const canvas = $('#stageCanvas');
    if (visible(start)) return 'start';
    if (!canvas) return 'opening';
    if (canvas.dataset.casepathMoment) return canvas.dataset.casepathMoment;
    if (canvas.querySelector('#reviewForm')) return 'review';
    if (canvas.querySelector('.knowledge-agent')) return 'knowledge';
    if (canvas.querySelector('.later-run')) {
      return canvas.querySelector('#laterResult .before-after') ? 'later-result' : 'later-work';
    }
    if (canvas.querySelector('.artifact-summary,.v17-derived-checklist') || /Handling playbook ready|reconstructed how this claim should be handled/i.test(canvas.textContent || '')) return 'ready';

    const progress = $('.v18-progress-focus,.v17-progress-focus');
    const active = progress?.dataset.activeStage;
    if (active) return active;
    const text = canvas.textContent || '';
    if (/passed its acceptance checks|checking the complete playbook/i.test(text)) return 'verify';
    if (/Previous cases are helping|organizational memory/i.test(text)) return 'experience';
    if (/Evidence now follows|attaching evidence/i.test(text)) return 'evidence';
    if (/complete handling process is taking shape|building the handling process/i.test(text)) return 'process';
    if (/Swiss law has become handling questions/i.test(text)) return 'research';
    if (/separated what is known/i.test(text)) return 'understand';
    if (/original submission is in the shared claim context|Reading the message/i.test(text)) return 'read';
    return 'opening';
  }

  function updateClaimReadiness() {
    const ready = $$('.attachment-row').length > 0 && Boolean($('#customerEmail .email-body'));
    if (document.body.dataset.claimReady !== String(ready)) document.body.dataset.claimReady = String(ready);
    const button = $('#runCasePath');
    if (button && visible($('#startState'))) {
      const label = button.querySelector('span');
      const starting = /Opening the claim context/i.test(label?.textContent || '');
      if (!starting && button.disabled === ready) button.disabled = !ready;
      if (label && ready && !/Opening|Could not/i.test(label.textContent || '') && label.textContent !== 'Analyse claim') label.textContent = 'Analyse claim';
    }
    const header = $('#headerClaimId');
    if (header && !ready && /Loading claim/i.test(header.textContent || '')) header.textContent = 'Opening claim…';
  }

  function normalizeStart() {
    const start = $('#startState');
    if (!start || start.dataset.v20Ready === 'true') return;
    const label = start.querySelector('.start-copy .quiet-label');
    const title = start.querySelector('.start-copy h2');
    const buttonLabel = start.querySelector('#runCasePath span');
    if (label) label.textContent = 'Ready';
    if (title) title.textContent = 'Build the handling process from this claim.';
    if (buttonLabel) buttonLabel.textContent = 'Analyse claim';
    start.dataset.v20Ready = 'true';
  }

  function normalizeSourceRail(moment) {
    const pane = $('.submission-pane');
    if (!pane) return;
    pane.dataset.v21SourceRail = 'true';
    const label = pane.querySelector('.submission-head .quiet-label');
    if (label && label.textContent !== 'Customer claim') label.textContent = 'Customer claim';
    const toggle = $('#toggleSource', pane);
    if (!toggle) return;
    if (!toggle.classList.contains('v21-source-summary-toggle')) {
      toggle.classList.add('v21-source-summary-toggle');
      toggle.innerHTML = `
        <span class="v21-source-summary-copy"><strong>Customer claim</strong><small>Opening source package…</small></span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;
      toggle.setAttribute('aria-controls', 'submissionContent');
      toggle.setAttribute('aria-label', 'Show or hide the customer claim source package');
    }
    const subject = pane.querySelector('.email-subject')?.textContent?.trim() || 'Customer claim';
    const sourceCount = $('#attachmentCount')?.textContent?.trim() || 'Opening source package…';
    const summaryTitle = toggle.querySelector('.v21-source-summary-copy strong');
    const summaryMeta = toggle.querySelector('.v21-source-summary-copy small');
    if (summaryTitle && summaryTitle.textContent !== subject) summaryTitle.textContent = subject;
    if (summaryMeta && summaryMeta.textContent !== sourceCount) summaryMeta.textContent = sourceCount;

    if (moment === 'start') {
      pane.classList.remove('collapsed');
      toggle.setAttribute('aria-expanded', 'true');
      delete pane.dataset.v21AutoCollapsed;
    } else if (pane.dataset.v21AutoCollapsed !== 'true') {
      pane.classList.add('collapsed');
      toggle.setAttribute('aria-expanded', 'false');
      pane.dataset.v21AutoCollapsed = 'true';
    }
  }

  function ensureFlagshipFocus(canvas, moment) {
    const live = $('#liveWorkspace');
    const focus = FLAGSHIP_FOCUS[moment] || FLAGSHIP_FOCUS.opening;
    if (!live || !canvas || !focus) return;
    let surface = $('#v21AgentFocus');
    if (!surface) {
      surface = document.createElement('section');
      surface.id = 'v21AgentFocus';
      surface.className = 'v21-agent-focus';
      surface.setAttribute('aria-live', 'polite');
      live.insertBefore(surface, canvas);
    }
    const action = CURSOR_ACTIONS[moment] || CURSOR_ACTIONS.opening;
    const plainAuthority = PLAIN_AUTHORITIES[moment] || PLAIN_AUTHORITIES.opening;
    const proof = $('#orchestrationProof');
    const currentEvent = proof ? {
      eventId: proof.dataset.currentEventId || '', stage: proof.dataset.currentStage || '',
      actorType: proof.dataset.currentActorType || '', actorId: proof.dataset.currentActorId || '',
      callId: proof.dataset.currentCallId || '', status: proof.dataset.currentStatus || '',
      outputArtifact: proof.dataset.currentOutputArtifact || '', headline: proof.dataset.currentHeadline || '',
    } : {};
    // Keep the raw proof-event identity even when that event is not the actor
    // for the visible presentation frame. Neutral cursor fallbacks still need
    // a stable semantic key; discarding it collapses separate frames into the
    // same moment/target activation and makes the cursor appear to repeat.
    const rawProofEventId = currentEvent.eventId || '';
    const eventMoment = currentEvent.stage === 'orchestrator' ? 'opening' : currentEvent.stage === 'complete' ? 'ready' : currentEvent.stage;
    const nemotronIdentity = currentEvent.actorType === 'nemotron_agent'
      ? NEMOTRON_AGENT_IDENTITIES[currentEvent.actorId] || null
      : null;
    // Specialist receipts arrive at the agent_orchestration boundary while the
    // currently constructed artifact remains on screen. They are current for
    // that visible artifact; every other event must match the visible moment.
    const eventIsCurrent = Boolean(currentEvent.eventId && (
      eventMoment === moment
      || (currentEvent.stage === 'agent_orchestration' && nemotronIdentity
        && !['review', 'review-applied', 'knowledge', 'later-work', 'later-result'].includes(moment))
    ));
    if (!eventIsCurrent) Object.keys(currentEvent).forEach(key => { currentEvent[key] = ''; });
    const currentIdentity = eventIsCurrent ? nemotronIdentity : null;
    const visibleTitle = currentIdentity?.title || focus.title;
    const visibleWhy = currentIdentity?.why || focus.why;
    const visibleOutput = currentIdentity?.output || focus.output;
    const liveAction = currentEvent.headline || currentIdentity?.title || action;
    const liveAuthority = currentIdentity
      ? currentIdentity.label
      : currentEvent.actorType === 'nemotron_agent'
        ? 'Unrecognized model role'
      : currentEvent.actorType === 'deterministic_gate'
        ? 'CasePath safety check'
        : currentEvent.actorType === 'deterministic_tool'
          ? 'CasePath deterministic tool'
          : plainAuthority;
    const outputProduced = PRODUCED_EVENT_STATES.has(currentEvent.status.toLowerCase())
      || ['ready', 'review-applied', 'later-result', 'failure'].includes(moment)
      || (moment === 'knowledge' && document.body.dataset.casepathLearningReady === 'true');
    const ownedArtifact = currentIdentity && outputProduced
      ? ownedArtifactMarkup(canvas, proof, currentEvent, currentIdentity)
      : '';
    // A returned specialist identity can truthfully remain visible while its
    // contribution is taking shape. It becomes an artifact interaction only
    // once the exact receipt-bound owned-artifact card exists in this focus.
    const cursorPhase = ownedArtifact ? 'artifact' : 'working';
    const signature = `${moment}:${focus.stage}:${action}:${rawProofEventId}:${currentEvent.eventId}:${currentEvent.status}:${currentEvent.actorId}:${cursorPhase}`;
    if (surface.dataset.signature === signature) {
      positionAgentCursor(surface, canvas, moment);
      return;
    }
    const activeIndex = FLAGSHIP_STAGES.findIndex(stage => stage.id === focus.stage);
    const role = FLAGSHIP_STAGES[activeIndex] || FLAGSHIP_STAGES[0];
    const positionLabel = currentIdentity
      ? `Specialist ${currentIdentity.order} of ${NEMOTRON_AGENT_COUNT} · ${currentIdentity.label}`
      : `Stage ${activeIndex + 1} of ${FLAGSHIP_STAGES.length} · ${role.label}`;
    const cursorRole = currentIdentity ? currentIdentity.label : liveAuthority;
    const cursorMonogram = currentIdentity?.monogram || 'CP';
    const cursorStatus = currentIdentity
      ? cursorPhase === 'artifact' ? 'Returned Nemotron specialist' : 'Nemotron specialist working'
      : cursorRole;
    const readyExpanded = document.body.dataset.v21ReadyExpanded === 'true';
    surface.dataset.signature = signature;
    surface.dataset.casepathSpecialist = role.id;
    surface.dataset.nemotronAgentId = currentIdentity ? currentEvent.actorId : '';
    surface.dataset.workAuthority = liveAuthority;
    surface.dataset.casepathAction = liveAction;
    surface.innerHTML = `
      <div class="v21-focus-inner">
        <p class="v21-stage-position"><i aria-hidden="true"></i><span>${esc(positionLabel)}</span></p>
        <div class="v21-focus-copy">
          <span class="v21-focus-task-label">Doing now</span>
          <h2>${esc(visibleTitle)}</h2>
          <p class="v21-focus-why"><span>Why it matters</span><strong>${esc(visibleWhy)}</strong></p>
          <div class="v21-agent-cursor" id="v21AgentCursor" role="status" aria-label="${esc(`${cursorRole}: ${liveAction}`)}" data-action="${esc(liveAction)}" data-casepath-moment="${esc(moment)}" data-casepath-specialist="${esc(role.id)}" data-cursor-phase="${cursorPhase}" data-agent-id="${esc(currentIdentity ? currentEvent.actorId : '')}" data-agent-signature="${esc(currentIdentity?.signature || 'casepath')}" data-work-authority="${esc(liveAuthority)}" data-event-id="${esc(currentEvent.eventId)}" data-proof-event-id="${esc(rawProofEventId)}" data-event-stage="${esc(currentEvent.stage)}" data-actor-type="${esc(currentEvent.actorType)}" data-actor-id="${esc(currentEvent.actorId)}" data-call-id="${esc(currentEvent.callId)}" data-event-status="${esc(currentEvent.status)}" data-output-artifact="${esc(currentEvent.outputArtifact)}">
            <span class="v21-cursor-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 3.8v14.5l3.7-3.3 2.7 5.2 2.5-1.3-2.7-5.1 4.9-.7L5 3.8Z"/></svg><b>${esc(cursorMonogram)}</b></span>
            <span class="v21-cursor-action">${esc(currentIdentity?.shortLabel || liveAction)}</span>
            <small><strong>${esc(cursorStatus)}</strong></small>
          </div>
        </div>
        ${ownedArtifact || (outputProduced ? `<div class="v21-focus-artifact" data-casepath-primary-artifact="true"><strong>${esc(visibleOutput)}</strong></div>` : '')}
        ${moment === 'ready' ? `<button type="button" class="v21-ready-explore" data-v21-ready-explore aria-expanded="${readyExpanded}">${readyExpanded ? 'Hide full path' : 'Explore full path'}</button>` : ''}
      </div>
    `;
    surface.dataset.casepathFocal = 'true';
    const primaryArtifact = surface.querySelector('.v21-owned-artifact');
    if (primaryArtifact) primaryArtifact.dataset.casepathPrimaryArtifact = 'true';
    surface.querySelector('[data-v21-ready-explore]')?.addEventListener('click', event => {
      const expanded = document.body.dataset.v21ReadyExpanded === 'true';
      document.body.dataset.v21ReadyExpanded = String(!expanded);
      event.currentTarget.setAttribute('aria-expanded', String(!expanded));
      event.currentTarget.textContent = expanded ? 'Explore full path' : 'Hide full path';
    });
    positionAgentCursor(surface, canvas, moment);
  }

  function returnedProofValue(card, key) {
    return card?.querySelector(`[data-proof-field="${key}"] code`)?.textContent?.trim() || '';
  }

  function ownedArtifactMarkup(canvas, proof, event, identity) {
    const outputArtifact = event.outputArtifact.trim();
    const callId = event.callId.trim();
    if (!outputArtifact || !callId || event.actorType !== 'nemotron_agent') return '';
    const actorCard = proof?.querySelector(`.orchestration-actor-card[data-actor-type="nemotron_agent"][data-actor-id="${CSS.escape(event.actorId)}"][data-call-id="${CSS.escape(callId)}"]`);
    if (!actorCard) return '';
    const copy = OWNED_ARTIFACT_COPY[event.actorId];
    if (!copy) return '';
    const requestedModel = returnedProofValue(actorCard, 'model');
    const responseModel = returnedProofValue(actorCard, 'response-model');
    const outputHash = returnedProofValue(actorCard, 'artifact-hash');
    const preview = copy.selector
      ? [...canvas.querySelectorAll(copy.selector)].filter(visible).slice(0, 2).map(node => node.textContent?.trim()).filter(Boolean)
      : [];
    const metrics = [...actorCard.querySelectorAll('.orchestration-result-metrics [data-result-metric]')].slice(0, 3).map(node => ({
      value: node.querySelector('strong')?.textContent?.trim() || '',
      label: node.querySelector('small')?.textContent?.trim() || '',
    })).filter(item => item.value && item.label);
    return `<section class="v21-owned-artifact" data-agent-artifact-target="true" data-agent-artifact-owner="${esc(event.actorId)}" data-actor-type="${esc(event.actorType)}" data-call-id="${esc(callId)}" data-output-artifact="${esc(outputArtifact)}" data-event-status="${esc(event.status)}" data-requested-model="${esc(requestedModel)}" data-response-model="${esc(responseModel)}" data-output-hash="${esc(outputHash)}" aria-label="Returned artifact owned by ${esc(identity.label)}">
      <header><span>Returned work · Specialist ${identity.order} of ${NEMOTRON_AGENT_COUNT}</span><strong>${esc(outputArtifact)}</strong><small>${esc(event.status)}</small></header>
      <div class="v21-owned-artifact-copy"><strong>${esc(copy.title)}</strong><p>${esc(copy.detail)}</p>${preview.length ? `<ul>${preview.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}</div>
      ${metrics.length ? `<div class="v21-owned-artifact-metrics">${metrics.map(item => `<span><strong>${esc(item.value)}</strong><small>${esc(item.label)}</small></span>`).join('')}</div>` : ''}
      <footer><span>Returned by <strong>${esc(identity.label)}</strong></span>${requestedModel ? `<span>Model <code>${esc(requestedModel)}</code></span>` : ''}<span>Call <code>${esc(callId)}</code></span>${outputHash ? `<span>Output hash <code>${esc(outputHash)}</code></span>` : ''}</footer>
    </section>`;
  }

  function cursorTarget(canvas, moment, agentId = '', surface = null) {
    const ownedArtifact = agentId
      ? surface?.querySelector(`[data-agent-artifact-target="true"][data-agent-artifact-owner="${CSS.escape(agentId)}"]`)
      : null;
    if (ownedArtifact) return ownedArtifact;
    const graphStepTarget = canvas.querySelector('[data-agent-cursor-target="true"]');
    if (graphStepTarget) return graphStepTarget;
    const identity = NEMOTRON_AGENT_IDENTITIES[agentId];
    if (identity) {
      const specialistTargets = [...canvas.querySelectorAll(identity.target)];
      const specialistTarget = specialistTargets.find(node => {
        const box = node.getBoundingClientRect();
        return box.bottom > 72 && box.top < window.innerHeight - 36;
      }) || specialistTargets[0];
      if (specialistTarget) return specialistTarget;
    }
    const selectors = {
      opening: '.live-question,.event-row:last-child', read: '.event-row:last-child,.attachment-row:last-child',
      understand: '.fact-row:last-child,.event-row:last-child', research: '.official-source-tab[aria-selected="true"],.law-query:last-child,.law-card:last-child',
      process: '.process-node.current .process-node-button,.process-node-button[aria-current="step"],.process-node-button:last-child',
      evidence: '.decision-inspector .inspector-row:last-of-type,.v17-checklist-item:last-child',
      experience: '.precedent-mini:first-of-type,.precedent-inline', verify: '.verification-row:last-child,.gate-receipt:last-child',
      ready: '.v20-final-handoff,.process-node.current', review: '.review-choice:has(input:checked),.review-choice:first-of-type',
      'review-applied': '.review-applied-delta,.review-applied', knowledge: '.v20-learning-summary',
      'later-work': '#laterResult', 'later-result': '.before-after section:last-child,.v18-reuse-proof', failure: '.failure-state',
    };
    const candidates = [...canvas.querySelectorAll(selectors[moment] || selectors.opening)];
    return candidates.find(node => {
      const box = node.getBoundingClientRect();
      return box.bottom > 72 && box.top < window.innerHeight - 36;
    }) || candidates[0] || canvas.querySelector('.stage-shell');
  }

  function cursorTargetKey(target) {
    if (!target) return '';
    const identity = [
      target.id, target.dataset.officialSourceTab, target.dataset.nodeId,
      target.dataset.factId, target.dataset.itemId, target.dataset.lawId,
      target.dataset.agentArtifactOwner && target.dataset.outputArtifact
        ? `${target.dataset.agentArtifactOwner}:${target.dataset.outputArtifact}`
        : '',
      target.dataset.processBuildIndex, target.dataset.memoryCheck,
      target.getAttribute('data-agent-cursor-target') === 'true' ? target.dataset.nodeId || target.dataset.processBuildIndex || 'graph-step' : '',
    ].find(Boolean);
    return `${target.tagName.toLowerCase()}:${identity || [...target.parentElement?.children || []].indexOf(target)}`;
  }

  function settleCursorTarget(target) {
    if (cursorMotion.target && cursorMotion.target !== target && cursorMotion.target.isConnected) {
      cursorMotion.target.classList.remove('v21-agent-target');
    }
    cursorMotion.target = target;
  }

  function positionAgentCursor(surface, canvas, moment) {
    const cursor = $('#v21AgentCursor', surface);
    const target = cursorTarget(canvas, moment, cursor?.dataset.agentId || '', surface);
    if (!cursor || !target) return;
    requestAnimationFrame(() => {
      if (!cursor.isConnected || !target.isConnected) return;
      const semanticEventId = cursor.dataset.eventId || cursor.dataset.proofEventId || moment;
      const cursorPhase = cursor.dataset.cursorPhase || 'working';
      const activationKey = `${semanticEventId}:${cursor.dataset.agentId || 'casepath'}:${cursorPhase}:${cursorTargetKey(target)}`;
      const elapsed = performance.now() - cursorMotion.activatedAt;
      if (cursorMotion.activationKey && cursorMotion.activationKey !== activationKey && elapsed < CURSOR_TARGET_MIN_HOLD_MS) {
        window.clearTimeout(cursorMotion.holdTimer);
        cursorMotion.holdTimer = window.setTimeout(queueEnhance, Math.ceil(CURSOR_TARGET_MIN_HOLD_MS - elapsed));
        return;
      }
      const targetBox = target.getBoundingClientRect();
      const cursorBox = cursor.getBoundingClientRect();
      const cursorWidth = cursorBox.width || 238;
      const cursorHeight = cursorBox.height || 46;
      const targetIsVisible = targetBox.bottom > 72 && targetBox.top < window.innerHeight - 36;
      const anchorX = targetIsVisible ? targetBox.right - Math.min(18, targetBox.width * .1) : window.innerWidth - cursorWidth - 32;
      const anchorY = targetIsVisible ? targetBox.top + Math.min(22, targetBox.height * .32) : window.innerHeight - cursorHeight - 36;
      const x = Math.round(Math.max(18, Math.min(window.innerWidth - cursorWidth - 18, anchorX - 16)) / 2) * 2;
      const y = Math.round(Math.max(80, Math.min(window.innerHeight - cursorHeight - 18, anchorY)) / 2) * 2;
      const cursorChanged = cursorMotion.cursor !== cursor;
      const geometryChanged = cursorMotion.x === null || cursorMotion.y === null
        || Math.abs(cursorMotion.x - x) >= 4 || Math.abs(cursorMotion.y - y) >= 4;
      if (cursorChanged || geometryChanged) {
        cursor.style.setProperty('--cursor-x', `${x}px`);
        cursor.style.setProperty('--cursor-y', `${y}px`);
        cursorMotion.cursor = cursor;
        cursorMotion.x = x;
        cursorMotion.y = y;
      }

      settleCursorTarget(target);
      if (cursorMotion.activationKey === activationKey) return;
      cursorMotion.activationKey = activationKey;
      // A semantic activation may return after an intervening DOM frame. Keep
      // the cursor positioned, but never replay its click or telemetry step.
      if (cursorMotion.emittedActivationKeys.has(activationKey)) return;
      cursorMotion.emittedActivationKeys.add(activationKey);
      cursorMotion.activatedAt = performance.now();
      window.dispatchEvent(new CustomEvent('casepath:cursor-step', { detail: {
        activationKey,
        moment,
        eventId: cursor.dataset.eventId || '',
        proofEventId: cursor.dataset.proofEventId || '',
        actorType: cursor.dataset.actorType || '',
        agentId: cursor.dataset.agentId || '',
        signature: cursor.dataset.agentSignature || 'casepath',
        phase: cursorPhase,
        callId: cursor.dataset.callId || '',
        outputArtifact: cursor.dataset.outputArtifact || '',
        target: cursorTargetKey(target),
        x,
        y,
      } }));
      window.clearTimeout(cursorMotion.clickTimer);
      window.clearTimeout(cursorMotion.targetTimer);
      cursor.classList.add('is-clicking');
      target.classList.add('v21-agent-target');
      cursorMotion.clickTimer = window.setTimeout(() => {
        if (cursor.isConnected) cursor.classList.remove('is-clicking');
      }, 160);
      cursorMotion.targetTimer = window.setTimeout(() => {
        if (target.isConnected) target.classList.remove('v21-agent-target');
      }, 680);
    });
  }

  function directInspectorCopy(canvas) {
    for (const inspector of $$('.decision-inspector', canvas)) {
      const headings = [...inspector.querySelectorAll('.inspector-section h4')];
      for (const heading of headings) {
        const text = heading.textContent?.trim();
        if (text === 'What this decision knows') heading.textContent = 'What we know';
        if (text === 'What this decision requires') heading.textContent = 'Evidence that could resolve this';
        if (text === 'Why this step exists') heading.textContent = 'Relevant law';
      }
      const precedent = inspector.querySelector('.precedent-inline h4');
      if (precedent && precedent.textContent !== 'Previous experience that may help') precedent.textContent = 'Previous experience that may help';
    }
  }

  function ensureArtifactHeader(canvas, moment) {
    const copy = MOMENT_COPY[moment];
    const shell = canvas?.querySelector('.stage-shell');
    if (!copy || !shell) return;
    let header = shell.querySelector(':scope > .v20-artifact-header');
    if (!header) {
      header = document.createElement('header');
      header.className = 'v20-artifact-header';
      shell.prepend(header);
    }
    if (header.dataset.moment !== moment) {
      header.dataset.moment = moment;
      header.innerHTML = `
        <div><small>${esc(copy.eyebrow)}</small><h2>${esc(copy.title)}</h2><p>${esc(copy.detail)}</p></div>
        <div class="v20-artifact-actions"></div>`;
    }
    const actions = header.querySelector('.v20-artifact-actions');
    if (moment === 'ready' && canvas.querySelector('.v17-derived-checklist') && !actions?.querySelector('[data-v20-open-documents]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'v20-quiet-action';
      button.dataset.v20OpenDocuments = 'true';
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-controls', 'v20DocumentSheet');
      button.setAttribute('aria-expanded', 'false');
      button.textContent = 'View document needs';
      actions?.append(button);
    }
  }

  function ensureDocumentSheet(canvas) {
    const checklist = canvas?.querySelector('.v17-derived-checklist');
    const workPane = $('.work-pane');
    if (!checklist || !workPane || workPane.querySelector('.v20-document-sheet')) return;

    const sheet = document.createElement('dialog');
    sheet.id = 'v20DocumentSheet';
    sheet.className = 'v20-document-sheet';
    sheet.setAttribute('aria-labelledby', 'v20DocumentTitle');
    const clone = checklist.cloneNode(true);
    clone.removeAttribute('class');
    clone.className = 'v20-document-checklist';
    for (const item of $$('.v17-checklist-item', clone)) {
      const nodeId = item.dataset.nodeId || '';
      item.dataset.v20NodeId = nodeId;
      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', `${item.querySelector('strong')?.textContent || 'Document need'}; open its process decision`);
    }
    sheet.innerHTML = `
      <header>
        <div><span class="quiet-label">Derived from the process</span><h2 id="v20DocumentTitle">Document needs</h2><p>Every item keeps its item, decision, and fact identifiers and returns to the decision that requires it.</p></div>
        <button class="icon-button" type="button" data-v20-close-documents aria-label="Return to handling process"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
      </header>
      <div class="v20-document-body"></div>`;
    sheet.querySelector('.v20-document-body').append(clone);
    workPane.append(sheet);
  }

  function openDocuments() {
    const sheet = $('.v20-document-sheet');
    if (!sheet) return;
    openDocuments.returnFocus = $('[data-v20-open-documents]');
    $('[data-v20-open-documents]')?.setAttribute('aria-expanded', 'true');
    if (!sheet.open) sheet.showModal();
    sheet.querySelector('[data-v20-close-documents]')?.focus();
  }

  function closeDocuments({ nodeId = '' } = {}) {
    const sheet = $('.v20-document-sheet');
    if (!sheet) return;
    if (sheet.open) sheet.close();
    $('[data-v20-open-documents]')?.setAttribute('aria-expanded', 'false');
    if (nodeId) {
      const target = $(`.process-node-button[data-node-id="${CSS.escape(nodeId)}"],.process-branch-node[data-node-id="${CSS.escape(nodeId)}"]`, $('#stageCanvas'));
      target?.click();
      requestAnimationFrame(() => $(`.process-node-button[data-node-id="${CSS.escape(nodeId)}"],.process-branch-node[data-node-id="${CSS.escape(nodeId)}"]`, $('#stageCanvas'))?.focus());
    } else {
      openDocuments.returnFocus?.focus();
    }
  }

  function focusReview(canvas) {
    const form = canvas?.querySelector('#reviewForm');
    if (!form) return;
    const submit = form.querySelector('button[type="submit"] span');
    if (submit && /Apply demo correction/i.test(submit.textContent || '')) submit.textContent = 'Apply demo correction';
    const label = form.querySelector(':scope > .quiet-label');
    if (label && label.textContent !== 'Simulated reviewer choice') label.textContent = 'Simulated reviewer choice';
    if (!form.querySelector('.v20-review-note')) {
      const note = document.createElement('p');
      note.className = 'v20-review-note';
      note.textContent = 'Simulated demo review only; this is not qualified expert approval. Choose the evidence order and CasePath updates the downstream process and document needs immediately.';
      form.querySelector('h3')?.after(note);
    }
  }

  function focusReviewApplied(canvas) {
    const root = canvas?.querySelector('.review-applied');
    const delta = root?.querySelector('.review-applied-delta');
    const layout = root?.querySelector('.review-applied-layout');
    if (!root || !delta || root.dataset.v21Progressive === 'true') return;
    root.dataset.v21Progressive = 'true';
    const articles = [...delta.querySelectorAll(':scope > article')];
    const processCount = articles.slice(0, 3).reduce((total, article) => {
      const values = article.querySelector('strong')?.textContent?.match(/\d+/g) || [];
      return total + values.reduce((sum, value) => sum + Number(value), 0);
    }, 0);
    const evidenceCount = Number(articles[3]?.querySelector('strong')?.textContent?.match(/\d+/)?.[0] || 0);
    const summary = document.createElement('section');
    summary.className = 'v21-review-change';
    summary.innerHTML = `<small>Unverified demo correction applied · model acceptance not reused</small><strong>${processCount} process change${processCount === 1 ? '' : 's'} · ${evidenceCount} evidence relationship${evidenceCount === 1 ? '' : 's'} updated</strong>`;
    root.querySelector('.review-applied-heading')?.after(summary);
    if (layout) {
      const details = document.createElement('details');
      details.className = 'v21-progressive-details';
      details.innerHTML = '<summary>Explore corrected process</summary><div></div>';
      details.querySelector('div').append(delta, layout);
      root.append(details);
    }
  }

  function focusKnowledge(canvas) {
    const result = canvas?.querySelector('.v20-learning-summary');
    if (result && !result.querySelector('.v21-knowledge-outcome')) {
      const memoryReady = Boolean(result.querySelector('[data-outcome="reviewed-memory"] strong')?.textContent?.match(/saved/i));
      const sharedVersion = result.querySelector('[data-outcome="shared-playbook"] strong')?.textContent?.trim() || 'Shared playbook unchanged';
      const outcome = document.createElement('section');
      outcome.className = 'v21-knowledge-outcome';
      outcome.dataset.casepathPrimaryArtifact = 'true';
      outcome.innerHTML = `<small>Governed knowledge result</small><strong>${memoryReady ? 'Unverified memory saved' : 'No memory promoted'} · candidate quarantined · ${esc(sharedVersion)}</strong>`;
      result.prepend(outcome);
    }
    if (result && document.body.dataset.casepathLearningReady !== 'true') {
      document.body.dataset.casepathLearningReady = 'true';
    }
  }

  function focusLater(canvas) {
    const result = canvas?.querySelector('#laterResult');
    if (!result?.querySelector('.before-after')) return;
    result.dataset.v20LaterReady = 'true';
    if (result.dataset.v21Progressive === 'true') return;
    result.dataset.v21Progressive = 'true';
    const heading = result.querySelector('.v20-later-heading');
    const causal = result.querySelector('.causal-delta');
    if (causal) {
      causal.dataset.casepathPrimaryArtifact = 'true';
      const values = kind => (causal.querySelector(`[data-delta-kind="${kind}"] strong`)?.textContent || '')
        .split(/\s*·\s*|,\s*/).map(value => value.trim()).filter(value => value && value !== 'none');
      const nodes = values('nodes');
      const edges = values('edges');
      const evidence = values('evidence');
      const summary = causal.querySelector('header h3');
      if (summary && causal.dataset.causalNonzero === 'true') {
        const readableNode = (nodes[0] || '').replaceAll('_', ' ');
        const nodeLabel = nodes.length === 1
          ? `${readableNode.charAt(0).toUpperCase()}${readableNode.slice(1)} decision added`
          : `${nodes.length} decisions added`;
        summary.textContent = `${nodeLabel} · ${edges.length} process links · ${evidence.length} evidence needs updated`;
        summary.classList.add('v21-causal-summary');
      }
    }
    const details = document.createElement('details');
    details.className = 'v21-progressive-details v21-proof-details';
    details.innerHTML = '<summary>Inspect proof</summary><div></div>';
    const body = details.querySelector('div');
    const causalProof = causal?.querySelector(':scope > div')?.cloneNode(true);
    if (causalProof) {
      causalProof.classList.add('v21-causal-proof');
      body.append(causalProof);
    }
    [...result.children].filter(child => child !== heading && child !== causal).forEach(child => body.append(child));
    result.append(details);
  }

  function setMoment(moment) {
    if (lastMoment === moment) return;
    lastMoment = moment;
    document.body.dataset.casepathMoment = moment;
    if (moment !== 'knowledge') delete document.body.dataset.casepathLearningReady;
  }

  function markPrimaryArtifact(canvas, moment) {
    document.querySelectorAll('[data-casepath-primary-artifact]').forEach(node => {
      if (!node.closest('#artifactCanvas')) node.removeAttribute('data-casepath-primary-artifact');
    });
    const owned = $('#v21AgentFocus .v21-owned-artifact');
    if (owned) {
      owned.dataset.casepathPrimaryArtifact = 'true';
      return;
    }
    const selectors = {
      read: '.event-list', understand: '.fact-stream', research: '.official-source-browser,.legal-research',
      process: '.process-layout[data-process-story]', evidence: '.process-layout', experience: '.process-layout',
      verify: '.process-layout,.v20-final-handoff', ready: '.v20-final-handoff,.process-layout', review: '#reviewForm',
      'review-applied': '.v21-review-change', knowledge: '.v21-knowledge-outcome',
      'later-result': '.causal-delta', failure: '.failure-state',
    };
    const selector = selectors[moment];
    const target = selector ? canvas?.querySelector(selector) : null;
    if (target) target.dataset.casepathPrimaryArtifact = 'true';
  }

  function markPrimaryAction(canvas, moment) {
    document.querySelectorAll('[data-casepath-primary-action]').forEach(node => {
      if (!node.closest('#artifactCanvas')) node.removeAttribute('data-casepath-primary-action');
    });
    const action = moment === 'review' ? canvas?.querySelector('#reviewForm button[type="submit"]') : $('#journeyNext');
    if (action && !action.hidden) action.dataset.casepathPrimaryAction = 'true';
  }

  function enhance() {
    normalizeStart();
    updateClaimReadiness();
    const canvas = $('#stageCanvas');
    const moment = currentMoment();
    setMoment(moment);
    if (moment !== 'ready') delete document.body.dataset.v21ReadyExpanded;
    normalizeSourceRail(moment);
    if (!canvas) return;
    ensureFlagshipFocus(canvas, moment);
    directInspectorCopy(canvas);
    ensureArtifactHeader(canvas, moment);
    ensureDocumentSheet(canvas);
    focusReview(canvas);
    focusReviewApplied(canvas);
    focusKnowledge(canvas);
    focusLater(canvas);
    markPrimaryArtifact(canvas, moment);
    markPrimaryAction(canvas, moment);
    positionAgentCursor($('#v21AgentFocus'), canvas, moment);
  }

  function queueEnhance() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      enhance();
    });
  }

  function cursorDecorationMutation(mutation) {
    if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') return false;
    const withoutCursorDecoration = value => String(value || '')
      .split(/\s+/)
      .filter(name => name && !['is-clicking', 'v21-agent-target'].includes(name))
      .sort()
      .join(' ');
    return withoutCursorDecoration(mutation.oldValue)
      === withoutCursorDecoration(mutation.target.getAttribute('class'));
  }

  function narrateGraphCursor(event) {
    const cursor = $('#v21AgentCursor');
    const nodeId = event?.detail?.nodeId || '';
    const target = nodeId ? $(`[data-agent-cursor-target="true"][data-node-id="${CSS.escape(nodeId)}"], [data-agent-cursor-target="true"] [data-node-id="${CSS.escape(nodeId)}"]`) : null;
    const title = target?.querySelector?.('strong')?.textContent?.trim()
      || target?.textContent?.trim()
      || nodeId;
    if (!cursor || !title || event?.detail?.kind === 'complete') return;
    const action = event.detail.kind === 'branch' ? `Selecting ${title}` : `Adding ${title}`;
    cursor.dataset.action = action;
    cursor.querySelector('.v21-cursor-action').textContent = action;
    cursor.setAttribute('aria-label', `CasePath process construction: ${action}`);
  }

  function onClick(event) {
    const open = event.target.closest?.('[data-v20-open-documents]');
    if (open) {
      event.preventDefault();
      openDocuments();
      return;
    }
    const close = event.target.closest?.('[data-v20-close-documents]');
    if (close) {
      event.preventDefault();
      closeDocuments();
      return;
    }
    const item = event.target.closest?.('.v20-document-body .v17-checklist-item');
    if (item) {
      event.preventDefault();
      closeDocuments({ nodeId: item.dataset.v20NodeId || '' });
    }
  }

  function onKeydown(event) {
    const item = event.target.closest?.('.v20-document-body .v17-checklist-item');
    if (item && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      closeDocuments({ nodeId: item.dataset.v20NodeId || '' });
    }
    if (event.key === 'Escape' && $('.v20-document-sheet')?.open) closeDocuments();
  }

  function boot() {
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeydown);
    const observer = new MutationObserver(mutations => {
      if (mutations.every(cursorDecorationMutation)) return;
      queueEnhance();
    });
    for (const target of [document.body, $('#stageCanvas'), $('#agentProgress'), $('#submissionContent')]) {
      if (target) observer.observe(target, { childList: true, subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['hidden', 'class', 'aria-selected', 'data-active-stage'] });
    }
    $('#stageCanvas')?.addEventListener('scroll', queueEnhance, { passive: true });
    window.addEventListener('resize', queueEnhance, { passive: true });
    window.addEventListener('casepath:render', queueEnhance);
    window.addEventListener('casepath:graph-step', event => {
      narrateGraphCursor(event);
      queueEnhance();
    });
    queueEnhance();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
