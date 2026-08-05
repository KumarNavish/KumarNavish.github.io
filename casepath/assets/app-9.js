function handleClick(e){
  const target=e.target.closest('[data-action],[data-view],[data-mode],[data-claim],[data-node],[data-document],[data-trace],[data-attachment],[data-fact],[data-inspect-node],[data-review-action],[data-knowledge-tab],[data-query],[data-knowledge-claim],[data-knowledge-node],[data-knowledge-document],[data-profile-card],[data-module],[data-review-decision],[data-edit-field],[data-edit-doc]');if(!target)return;
  if(target.dataset.view){setView(target.dataset.view);return;}
  if(target.dataset.mode){state.mode=target.dataset.mode;safeLocal.set('casepath_mode',state.mode);render();showToast(`${pretty(state.mode)} mode enabled`,state.mode==='expert'?'Edits remain local and quarantined.':'Mode controls the visible workspace only.','success');return;}
  if(target.dataset.claim){state.claimId=target.dataset.claim;state.selectedNodeId=null;state.selectedDocType=null;state.claimLibraryOpen=false;safeLocal.set('casepath_claim',state.claimId);render();return;}
  if(target.dataset.node){state.selectedNodeId=target.dataset.node;state.selectedDocType=null;render();return;}
  if(target.dataset.document){state.selectedDocType=target.dataset.document;const doc=currentClaim().checklist.find(x=>x.documentType===state.selectedDocType);state.selectedNodeId=doc?.processNodeIds.find(n=>currentClaim().process.selectedPathNodeIds.includes(n))||state.selectedNodeId;inspectDocument(target.dataset.document);return;}
  if(target.dataset.trace){inspectTrace(target.dataset.trace);return;}
  if(target.dataset.attachment){inspectAttachment(target.dataset.attachment);return;}
  if(target.dataset.fact){inspectFact(target.dataset.fact);return;}
  if(target.dataset.inspectNode){inspectNode(target.dataset.inspectNode);return;}
  if(target.dataset.reviewAction){state.mode='expert';state.view='review';state.reviewDecision=target.dataset.reviewAction==='approve'?'approve':'approve_with_edits';render();return;}
  if(target.dataset.knowledgeTab){state.knowledgeTab=target.dataset.knowledgeTab;render();return;}
  if(target.dataset.query){state.knowledgeQuery=target.dataset.query;render();return;}
  if(target.dataset.knowledgeClaim){state.claimId=target.dataset.knowledgeClaim;state.view='journey';render();return;}
  if(target.dataset.knowledgeNode){const n=state.data.knowledge.processNodes.find(x=>x.id===target.dataset.knowledgeNode);openDrawer(n.title,n.question,`<div class="drawer-section"><h3>Canonical node</h3><dl class="kv"><dt>Node ID</dt><dd>${esc(n.id)}</dd><dt>Released episodes</dt><dd>${n.releasedBenchmarkCount}</dd><dt>Triggering facts</dt><dd>${esc(n.triggeringFacts.map(x=>FACT_LABELS[x]||pretty(x)).join(', ')||'None')}</dd><dt>Legal-source IDs</dt><dd>${esc(n.legalAuthorityIds.join(', '))}</dd></dl></div><div class="drawer-section"><h3>Public linked claims</h3>${n.linkedPublicClaims.map(id=>`<button class="result-card" data-knowledge-claim="${id}"><h3>${esc(id)}</h3></button>`).join('')||'<div class="notice">No public claim reaches this node.</div>'}</div>`);return;}
  if(target.dataset.knowledgeDocument){const d=state.data.knowledge.documents.find(x=>x.id===target.dataset.knowledgeDocument);openDrawer(d.title,`${d.missingCount} missing · ${d.presentCount} present in released generated episodes`,`<div class="drawer-section"><h3>Canonical mapping</h3><dl class="kv"><dt>Document ID</dt><dd>${esc(d.id)}</dd><dt>Customer requestable</dt><dd>${d.customerRequestable?'Yes':'No'}</dd><dt>Facts established</dt><dd>${esc(d.factKeys.map(x=>FACT_LABELS[x]||pretty(x)).join(', '))}</dd><dt>Process nodes</dt><dd>${esc(d.processNodeIds.map(x=>NODE_LABELS[x]||pretty(x)).join(', '))}</dd><dt>Legal-source IDs</dt><dd>${esc(d.legalAuthorityIds.join(', '))}</dd><dt>Validation</dt><dd>${esc(d.validationStatus)}</dd></dl></div><div class="drawer-section"><h3>Reason</h3><p>${esc(d.reasons.join(' '))}</p></div>`);return;}
  if(target.dataset.profileCard){state.profileId=target.dataset.profileCard;safeLocal.set('casepath_profile',state.profileId);render();return;}
  if(target.dataset.module){openModuleModal(target.dataset.module);return;}
  if(target.dataset.reviewDecision){state.reviewDecision=target.dataset.reviewDecision;render();return;}
  if(target.dataset.editField){openEditField(target.dataset.editField);return;}
  if(target.dataset.editDoc){openEditDocument(target.dataset.editDoc);return;}
  const action=target.dataset.action;
  if(action==='toggle-sidebar'){state.sidebarOpen=!state.sidebarOpen;render();}
  else if(action==='close-sidebar'){state.sidebarOpen=false;render();}
  else if(action==='toggle-claim-library'){state.claimLibraryOpen=!state.claimLibraryOpen;render();}
  else if(action==='run-analysis')runAnalysis();
  else if(action==='inspect-all')inspectAll();
  else if(action==='inspect-checklist')inspectChecklist();
  else if(action==='all-attachments')openAllAttachments();
  else if(action==='close-drawer'){state.drawer=null;render();}
  else if(action==='close-modal'){state.modal=null;render();}
  else if(action==='modal-backdrop'&&e.target===target){state.modal=null;render();}
  else if(action==='generate-claim')openGenerateClaimModal();
  else if(action==='create-generated-claim')createGeneratedClaim();
  else if(action==='download-run')downloadJson(`casepath-run-${currentClaim().id}-${state.profileId}.json`,runBundle());
  else if(action==='download-review'){const r=getReview(currentClaim().id);if(r)downloadJson(`casepath-review-${currentClaim().id}.json`,r);}
  else if(action==='download-comparison')downloadJson(`casepath-comparison-${currentClaim().id}.json`,{claimId:currentClaim().id,createdAt:nowIso(),profileA:state.compare.a,profileB:state.compare.b,outputA:outputForProfile(currentClaim(),state.compare.a),outputB:outputForProfile(currentClaim(),state.compare.b),evidenceBoundary:state.data.metrics.evidenceBoundary});
  else if(action==='open-openrouter')openOpenRouterModal();
  else if(action==='connect-openrouter')connectOpenRouter();
  else if(action==='disconnect-openrouter')disconnectOpenRouter();
  else if(action==='conformance-test')runConformance();
  else if(action==='knowledge-api')openModal('Agent retrieval contract','Humans and agents query the same static canonical index.',`<pre class="json-view">${esc(JSON.stringify({method:'GET',url:new URL('data/knowledge.json',location.href).href,contract:'casepath.public-knowledge-index/1.0.0',query_examples:['documents.filter(d => d.processNodeIds.includes("technical_assessment_required"))','claims.filter(c => c.subcategory === "mould_recurrence")']},null,2))}</pre>`,`<button class="button" data-action="close-modal">Close</button><a class="button primary" href="data/knowledge.json" target="_blank">Open JSON</a>`);
  else if(action==='run-knowledge-search'){render();}
  else if(action==='run-comparison'){if((state.compare.a==='nemotron'||state.compare.b==='nemotron')&&!state.liveRuns[`${currentClaim().id}:nemotron`]){state.profileId='nemotron';runAnalysis();}else showToast('Comparison ready','Both outputs use the same claim and canonical comparison contract.','success');}
  else if(action==='save-field-edit')saveFieldEdit(target);
  else if(action==='save-doc-edit')saveDocEdit(target);
  else if(action==='submit-review')submitReview();
  else if(action==='clear-review'){safeLocal.remove(localReviewKey(currentClaim().id));state.reviewEdits=[];state.reviewComment='';render();showToast('Local review cleared','The released reference remains unchanged.','success');}
}
function handleChange(e){const t=e.target;if(t.dataset.change==='profile'){state.profileId=t.value;safeLocal.set('casepath_profile',state.profileId);render();}else if(t.dataset.change==='compare-a'){state.compare.a=t.value;render();}else if(t.dataset.change==='compare-b'){state.compare.b=t.value;render();}else if(t.dataset.filter){state.filters[t.dataset.filter]=t.value;render();}}
function handleInput(e){const t=e.target;if(t.dataset.input==='claim-search'){state.filters.q=t.value;const pos=t.selectionStart;render();const n=document.querySelector('[data-input="claim-search"]');if(n){n.focus();n.setSelectionRange(pos,pos);}}else if(t.dataset.input==='knowledge-query'){state.knowledgeQuery=t.value;}else if(t.dataset.input==='review-comment'){state.reviewComment=t.value;}}
function handleKey(e){if(e.key==='Escape'){if(state.modal||state.drawer){state.modal=null;state.drawer=null;render();}else if(state.sidebarOpen){state.sidebarOpen=false;render();}}}
document.addEventListener('click',handleClick);
document.addEventListener('change',handleChange);
document.addEventListener('input',handleInput);
document.addEventListener('keydown',handleKey);
loadData().then(render).catch(err=>{console.error(err);document.getElementById('app').innerHTML=`<div class="boot-screen"><div class="brand-mark">!</div><div><strong>CasePath could not load</strong><p>${esc(err.message)}. Serve the product over HTTP rather than opening the file directly.</p></div></div>`;});
