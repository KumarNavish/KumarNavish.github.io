from __future__ import annotations

import time
from pathlib import Path

from casepath_api.data import ARTIFACTS, CLAIMS
from casepath_api.pipeline import ClaimPipeline
from casepath_api.storage import Storage


def wait(storage: Storage, run_id: str):
    for _ in range(100):
        run=storage.get_run(run_id)
        if run and run['status'] in {'complete','failed'}:
            return run
        time.sleep(.08)
    raise AssertionError('run timeout')


def test_source_artifacts_are_real_files():
    lease=ARTIFACTS['art_lease']
    assert lease['media_type']=='application/pdf'
    assert lease['page_count']==6
    assert lease['path'].read_bytes().startswith(b'%PDF')
    assert ARTIFACTS['art_photo']['path'].read_bytes()[:2]==b'\xff\xd8'
    assert 'From:' in ARTIFACTS['art_notification']['path'].read_text()


def test_reference_pipeline_and_process_document_linkage(tmp_path: Path):
    storage=Storage(str(tmp_path/'casepath.db'))
    pipeline=ClaimPipeline(storage)
    run=wait(storage,pipeline.create('DEF-027-E0-DEMO'))
    assert run['status']=='complete'
    result=run['result']
    assert result['current_blocker']=='What caused the recurring mould?'
    assert result['process']['current_node']=='cause'
    assert len(result['precedents'])==3
    assert len({p['claim_id'] for p in result['precedents']})==3
    supplied={x['title'] for x in result['checklist']['present']}
    requested={x['title'] for x in result['checklist']['required']}
    assert not supplied & requested
    reached={n['node_id'] for n in result['process']['nodes']}
    assert all(x['node_id'] in reached for x in result['checklist']['required'])
    assert all(x['fact'] and x['why'] for x in result['checklist']['required'])
    assert any(f['state']=='conflicting' for f in result['facts'])
    assert any(f['state']=='unknown' for f in result['facts'])


def test_fact_provenance_is_source_linked(tmp_path: Path):
    storage=Storage(str(tmp_path/'casepath.db'))
    run=wait(storage,ClaimPipeline(storage).create('DEF-027-E0-DEMO'))
    facts=run['result']['facts']
    consequential=[f for f in facts if f['fact_id'] in {'fact_notification','fact_cause','fact_ventilation_allegation'}]
    assert consequential
    for f in consequential:
        assert f['source_refs']
        for ref in f['source_refs']:
            assert ref['artifact_id']=='message' or ref['artifact_id'] in ARTIFACTS
            assert ref['page'] >= 1
            assert ref['excerpt']
            assert ref['agent']=='Claim Interpretation Agent'


def test_expert_review_recomputes_checklist_and_creates_memory(tmp_path: Path):
    storage=Storage(str(tmp_path/'casepath.db'))
    pipeline=ClaimPipeline(storage)
    run=wait(storage,pipeline.create('DEF-027-E0-DEMO'))
    saved=pipeline.review(run['run_id'],{
        'decision':'approve_with_edit',
        'building_envelope_mode':'conditional',
        'confidence':.93,
        'justification':'One neutral inspection first.',
    })
    envelope=next(x for x in saved['result']['checklist']['required'] if x['item_id']=='building_envelope')
    assert envelope['status']=='conditional'
    assert saved['candidate']['support_count']==1
    assert saved['candidate']['status']=='quarantined'
    assert saved['candidate']['shared_knowledge_changed'] is False
    memories=storage.memories()
    assert len(memories)==1
    assert memories[0]['claim_id']=='DEF-027-E0-DEMO'


def test_later_claim_uses_reviewed_memory_and_avoids_self_retrieval(tmp_path: Path):
    storage=Storage(str(tmp_path/'casepath.db'))
    pipeline=ClaimPipeline(storage)
    first=wait(storage,pipeline.create('DEF-027-E0-DEMO'))
    pipeline.review(first['run_id'],{
        'decision':'approve_with_edit','building_envelope_mode':'conditional','confidence':.9,'justification':'Sequence evidence.'
    })
    later=wait(storage,pipeline.create('DEMO-MOULD-002'))
    result=later['result']
    assert result['memory_used'] is True
    assert result['precedents'][0]['claim_id']=='DEF-027-E0-DEMO'
    assert all(p['claim_id']!='DEMO-MOULD-002' for p in result['precedents'])
    envelope=next(x for x in result['checklist']['required'] if x['item_id']=='building_envelope')
    assert envelope['status']=='conditional'
    assert any(n['node_id']=='ventilation_dispute' for n in result['process']['nodes'])
    proof=pipeline.learning_proof()
    assert proof['before']['unnecessary_immediate_requests']==1
    assert proof['after']['unnecessary_immediate_requests']==0
    assert proof['after']['new_reviewed_precedent']=='DEF-027-E0-DEMO'


def test_pipeline_events_are_real_and_ordered(tmp_path: Path):
    storage=Storage(str(tmp_path/'casepath.db'))
    run=wait(storage,ClaimPipeline(storage).create('DEF-027-E0-DEMO'))
    stages=[e['stage'] for e in run['events']]
    assert stages==['read','read','understand','understand','research','research','process','process','evidence','evidence','experience','experience','complete']
    completed=[e for e in run['events'] if e['status']=='completed']
    assert all(e.get('agent') for e in completed)
    assert any(e.get('items') for e in completed)
