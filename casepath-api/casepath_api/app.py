from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field

from . import __version__
from .data import ARTIFACTS, CLAIMS, DEMO_CLAIM, LATER_CLAIM, public_artifact, public_claim
from .pipeline import ClaimPipeline
from .storage import Storage

storage=Storage()
pipeline=ClaimPipeline(storage)

app=FastAPI(title="CasePath useful demo API",version=__version__,description="Generated-data research demonstration only.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://casepath-swiss-claim-lab.onrender.com",
        "https://casepath-guided-v13-preview.onrender.com",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_methods=["GET","POST","OPTIONS"],
    allow_headers=["Content-Type"],
    allow_credentials=False,
)

class RunRequest(BaseModel):
    model_config=ConfigDict(extra="forbid")
    claim_id:str

class ReviewRequest(BaseModel):
    model_config=ConfigDict(extra="forbid")
    decision:str="approve_with_edit"
    building_envelope_mode:str="conditional"
    confidence:float=Field(default=.9,ge=0,le=1)
    justification:str=Field(default="",max_length=1500)

@app.get("/healthz")
def healthz():
    return {"status":"ok","release":__version__,"product":"CasePath vertical demo","generated_data_only":True,"real_claims_approved":False}

@app.get("/readyz")
def readyz():
    return {"status":"ready","database":"sqlite-demo","claims":len(CLAIMS),"artifacts":len(ARTIFACTS)}

@app.get("/api/demo")
def demo():
    return {"release":__version__,"demo_claim_id":DEMO_CLAIM["claim_id"],"later_claim_id":LATER_CLAIM["claim_id"],"claim":public_claim(DEMO_CLAIM),"knowledge":pipeline.knowledge()}

@app.get("/api/claims")
def claims():
    return {"items":[public_claim(DEMO_CLAIM),public_claim(LATER_CLAIM)]}

@app.get("/api/claims/{claim_id}")
def claim(claim_id:str):
    if claim_id not in CLAIMS: raise HTTPException(404,"claim not found")
    return public_claim(CLAIMS[claim_id])

@app.get("/api/artifacts/{artifact_id}")
def raw_artifact(artifact_id:str):
    if artifact_id not in ARTIFACTS: raise HTTPException(404,"artifact not found")
    a=ARTIFACTS[artifact_id]
    return Response(a["path"].read_bytes(),media_type=a["media_type"],headers={"Content-Disposition":f'inline; filename="{a["filename"]}"',"Cache-Control":"public, max-age=3600"})

@app.get("/api/artifacts/{artifact_id}/pages/{page_number}")
def artifact_page(artifact_id:str,page_number:int):
    if artifact_id not in ARTIFACTS: raise HTTPException(404,"artifact not found")
    a=ARTIFACTS[artifact_id]
    if a["media_type"]!="application/pdf": raise HTTPException(409,"artifact is not a PDF")
    if page_number < 1 or page_number > a["page_count"]: raise HTTPException(404,"page not found")
    page_path=a["path"].parent / "pages" / artifact_id / f"page-{page_number}.png"
    if not page_path.exists(): raise HTTPException(404,"rendered page not found")
    return Response(page_path.read_bytes(),media_type="image/png",headers={"Cache-Control":"public, max-age=3600"})

@app.get("/api/artifacts/{artifact_id}/extraction")
def artifact_extraction(artifact_id:str):
    if artifact_id not in ARTIFACTS: raise HTTPException(404,"artifact not found")
    a=ARTIFACTS[artifact_id]
    payload={**public_artifact(a),"facts":a["fact_ids"]}
    if a["media_type"]=="application/pdf": payload["pages"]=a["pages"]
    elif a["media_type"]=="message/rfc822": payload["email"]=a["email"]
    else: payload["image_note"]="The source image is shown directly. No model-generated description is substituted for it."
    return payload

@app.post("/api/runs",status_code=202)
def create_run(req:RunRequest):
    try: rid=pipeline.create(req.claim_id)
    except KeyError: raise HTTPException(404,"claim not found")
    return {"run_id":rid,"status":"queued"}

@app.get("/api/runs/{run_id}")
def get_run(run_id:str):
    run=storage.get_run(run_id)
    if not run: raise HTTPException(404,"run not found")
    return run

@app.post("/api/runs/{run_id}/review")
def review(run_id:str,req:ReviewRequest):
    try: return pipeline.review(run_id,req.model_dump())
    except ValueError as exc: raise HTTPException(409,str(exc))

@app.get("/api/knowledge")
def knowledge():
    return pipeline.knowledge()

@app.get("/api/learning-proof")
def learning_proof():
    return pipeline.learning_proof()

@app.post("/api/demo/reset")
def reset_demo():
    storage.reset(); return {"status":"reset"}
