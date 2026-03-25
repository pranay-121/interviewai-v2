from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from slowapi import Limiter
from slowapi.util import get_remote_address
from pydantic import BaseModel
from core.security import get_current_user_id
from agents.orchestrator import orchestrator

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

class QuickQuestionRequest(BaseModel):
    agent_type: str
    job_role: str
    company: str = ""
    experience_level: str = "mid"

@router.post("/quick-question")
@limiter.limit("20/minute")
async def get_quick_question(
    request: Request,
    body: QuickQuestionRequest,
    user_id: str = Depends(get_current_user_id)
):
    try:
        result = await orchestrator.start_session(
            agent_type=body.agent_type,
            job_role=body.job_role,
            company=body.company,
            experience_level=body.experience_level
        )
        return {
            "question": result.get("question", ""),
            "context": result.get("context", "")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

@router.post("/resume")
@limiter.limit("10/hour")
async def analyze_resume(
    request: Request,
    file: UploadFile = File(...),
    target_role: str = "Software Engineer",
    target_company: str = "",
    user_id: str = Depends(get_current_user_id)
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files accepted")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")
    try:
        import io
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(content))
        resume_text = "\n".join(page.extract_text() or "" for page in reader.pages)
        if not resume_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF read error: {str(e)}")
    try:
        analysis = await orchestrator.analyze_resume(
            resume_text=resume_text,
            target_role=target_role,
            target_company=target_company or None
        )
        return {"analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis error: {str(e)}")

class ParseResumeRequest(BaseModel):
    text: str

@router.post("/parse-resume")
async def parse_resume_text(
    body: ParseResumeRequest,
    user_id: str = Depends(get_current_user_id)
):
    try:
        prompt = f"""Extract ALL information from this resume text and return ONLY a valid JSON object. No explanation, no markdown, ONLY raw JSON.

JSON structure required:
{{
  "fullName": "",
  "email": "",
  "phone": "",
  "location": "",
  "linkedin": "",
  "github": "",
  "website": "",
  "summary": "",
  "targetRole": "",
  "experience": [{{"company":"","role":"","location":"","startDate":"","endDate":"","current":false,"bullets":[""]}}],
  "education": [{{"institution":"","degree":"","field":"","startDate":"","endDate":"","grade":""}}],
  "skills": [{{"category":"Programming Languages","items":""}},{{"category":"Frameworks","items":""}},{{"category":"Tools","items":""}}],
  "projects": [{{"name":"","description":"","tech":"","link":""}}],
  "certifications": [{{"name":"","issuer":"","date":""}}]
}}

Resume text:
{body.text[:3000]}

Return ONLY the JSON object."""

        from agents.base_agent import BaseInterviewAgent
        agent = BaseInterviewAgent()
        raw = await agent._invoke(prompt)

        # Extract JSON from response
        import re, json
        raw = re.sub(r'```json\s*', '', raw)
        raw = re.sub(r'```\s*', '', raw).strip()
        match = re.search(r'\{[\s\S]*\}', raw)
        if match:
            parsed = json.loads(match.group())
            return {"parsed": parsed, "success": True}
        return {"parsed": None, "success": False, "raw": raw[:200]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parse error: {str(e)}")
