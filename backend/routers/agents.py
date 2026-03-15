from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from slowapi import Limiter
from slowapi.util import get_remote_address
from pydantic import BaseModel
from core.security import get_current_user_id
from agents.orchestrator import orchestrator
from services.storage_service import StorageService

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

class QuickQuestionRequest(BaseModel):
    agent_type: str
    job_role: str
    company: str = ""
    experience_level: str = "mid"

@router.post("/quick-question")
@limiter.limit("10/minute")
async def get_quick_question(request: Request, body: QuickQuestionRequest,
                               user_id: str = Depends(get_current_user_id)):
    result = await orchestrator.start_session(
        agent_type=body.agent_type, job_role=body.job_role,
        company=body.company, experience_level=body.experience_level)
    return {"question": result.get("question"), "context": result.get("context")}

@router.post("/resume")
@limiter.limit("5/hour")
async def analyze_resume(request: Request, file: UploadFile = File(...),
                           target_role: str = "", target_company: str = "",
                           user_id: str = Depends(get_current_user_id)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files accepted")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")
    resume_text = await StorageService.extract_pdf_text(content)
    resume_key = await StorageService.upload_resume(user_id, content, file.filename)
    analysis = await orchestrator.analyze_resume(
        resume_text=resume_text, target_role=target_role,
        target_company=target_company or None)
    return {"resume_key": resume_key, "analysis": analysis}
