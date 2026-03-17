from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from slowapi import Limiter
from slowapi.util import get_remote_address
from pydantic import BaseModel
from core.database import get_db
from core.security import get_current_user_id
from models.models import InterviewSession, InterviewMessage
from agents.orchestrator import orchestrator

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)
VALID_AGENTS = {"hr", "technical", "coding", "system_design"}

class StartSessionRequest(BaseModel):
    agent_type: str
    job_role: str
    company: str = ""
    experience_level: str = "mid"

class AnswerRequest(BaseModel):
    answer: str
    question: str

async def _get_session(session_id: str, user_id: str, db: AsyncSession):
    r = await db.execute(select(InterviewSession).where(
        InterviewSession.id == session_id, InterviewSession.user_id == user_id))
    s = r.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return s

@router.post("/start")
@limiter.limit("20/minute")
async def start_interview(request: Request, body: StartSessionRequest,
                           db: AsyncSession = Depends(get_db),
                           user_id: str = Depends(get_current_user_id)):
    if body.agent_type not in VALID_AGENTS:
        raise HTTPException(status_code=400, detail=f"agent_type must be one of {VALID_AGENTS}")
    opening = await orchestrator.start_session(
        agent_type=body.agent_type, job_role=body.job_role,
        company=body.company, experience_level=body.experience_level)
    session = InterviewSession(
        user_id=user_id, agent_type=body.agent_type,
        job_role=body.job_role, company=body.company or None,
        experience_level=body.experience_level,
        total_questions=opening.get("total_questions", 10),
        metadata_json={"scores": []},
    )
    db.add(session)
    await db.flush()
    db.add(InterviewMessage(session_id=session.id, role="assistant",
                             content=opening.get("question", ""), question_number=1))
    await db.commit()
    return {"session_id": session.id, "greeting": opening.get("greeting", ""),
            "question": opening.get("question", ""), "question_number": 1,
            "total_questions": opening.get("total_questions", 10),
            "context": opening.get("context", "")}

@router.post("/{session_id}/answer")
@limiter.limit("30/minute")
async def submit_answer(request: Request, session_id: str, body: AnswerRequest,
                         db: AsyncSession = Depends(get_db),
                         user_id: str = Depends(get_current_user_id)):
    session = await _get_session(session_id, user_id, db)
    if session.status != "in_progress":
        raise HTTPException(status_code=400, detail="Session not active")
    msgs_r = await db.execute(select(InterviewMessage)
        .where(InterviewMessage.session_id == session_id)
        .order_by(InterviewMessage.created_at))
    messages = msgs_r.scalars().all()
    history = [{"question": m.content, "answer": ""} for m in messages if m.role == "assistant" and m.question_number]
    question_number = session.answered_questions + 1
    result = await orchestrator.evaluate_answer(
        agent_type=session.agent_type, job_role=session.job_role,
        company=session.company or "", experience_level=session.experience_level,
        question=body.question, answer=body.answer,
        question_number=question_number, conversation_history=history)
    score = float(result.get("score", 5.0))
    db.add(InterviewMessage(session_id=session_id, role="user", content=body.answer,
                             question_number=question_number, score=score,
                             feedback=result.get("feedback"),
                             suggested_answer=result.get("suggested_answer")))
    session.answered_questions += 1
    scores = session.metadata_json.get("scores", [])
    scores.append(score)
    session.metadata_json = {**session.metadata_json, "scores": scores}
    is_complete = result.get("is_complete", False)
    if is_complete:
        summary = await orchestrator.complete_session(
            agent_type=session.agent_type, job_role=session.job_role,
            scores=scores, conversation_history=history)
        session.status = "completed"
        session.completed_at = datetime.now(timezone.utc)
        session.overall_score = float(summary.get("overall_score", sum(scores) / len(scores)))
        await db.commit()
        return {"session_complete": True, "score": score, "feedback": result.get("feedback"),
                "suggested_answer": result.get("suggested_answer"),
                "strong_points": result.get("strong_points", []),
                "improvement_areas": result.get("improvement_areas", []),
                "summary": summary}
    next_q = result.get("next_question", "")
    if next_q:
        db.add(InterviewMessage(session_id=session_id, role="assistant",
                                 content=next_q, question_number=question_number + 1))
    await db.commit()
    return {"session_complete": False, "score": score, "feedback": result.get("feedback"),
            "suggested_answer": result.get("suggested_answer"),
            "strong_points": result.get("strong_points", []),
            "improvement_areas": result.get("improvement_areas", []),
            "next_question": next_q, "question_number": question_number + 1,
            "questions_remaining": session.total_questions - question_number}

@router.get("/history")
async def get_history(db: AsyncSession = Depends(get_db),
                       user_id: str = Depends(get_current_user_id),
                       limit: int = 20, offset: int = 0):
    r = await db.execute(select(InterviewSession)
        .where(InterviewSession.user_id == user_id)
        .order_by(desc(InterviewSession.started_at)).limit(limit).offset(offset))
    sessions = r.scalars().all()
    return [{"id": s.id, "agent_type": s.agent_type, "job_role": s.job_role,
             "company": s.company, "status": s.status, "overall_score": s.overall_score,
             "total_questions": s.total_questions, "answered_questions": s.answered_questions,
             "started_at": s.started_at.isoformat(),
             "completed_at": s.completed_at.isoformat() if s.completed_at else None}
            for s in sessions]

@router.get("/{session_id}")
async def get_session(session_id: str, db: AsyncSession = Depends(get_db),
                       user_id: str = Depends(get_current_user_id)):
    session = await _get_session(session_id, user_id, db)
    msgs_r = await db.execute(select(InterviewMessage)
        .where(InterviewMessage.session_id == session_id)
        .order_by(InterviewMessage.created_at))
    messages = msgs_r.scalars().all()
    return {"id": session.id, "agent_type": session.agent_type, "job_role": session.job_role,
            "company": session.company, "status": session.status,
            "overall_score": session.overall_score, "total_questions": session.total_questions,
            "answered_questions": session.answered_questions,
            "started_at": session.started_at.isoformat(),
            "completed_at": session.completed_at.isoformat() if session.completed_at else None,
            "messages": [{"id": m.id, "role": m.role, "content": m.content,
                          "question_number": m.question_number, "score": m.score,
                          "feedback": m.feedback, "suggested_answer": m.suggested_answer,
                          "created_at": m.created_at.isoformat()} for m in messages],
            "scores": session.metadata_json.get("scores", [])}

@router.delete("/{session_id}/abandon")
async def abandon_session(session_id: str, db: AsyncSession = Depends(get_db),
                           user_id: str = Depends(get_current_user_id)):
    session = await _get_session(session_id, user_id, db)
    if session.status == "in_progress":
        session.status = "abandoned"
        await db.commit()
    return {"detail": "Abandoned"}

@router.get("/active")
async def get_active_session(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Get the most recent in-progress session if any."""
    r = await db.execute(
        select(InterviewSession)
        .where(
            InterviewSession.user_id == user_id,
            InterviewSession.status == "in_progress",
        )
        .order_by(desc(InterviewSession.started_at))
        .limit(1)
    )
    session = r.scalar_one_or_none()
    if not session:
        return {"session": None}

    # Get last question asked
    msgs_r = await db.execute(
        select(InterviewMessage)
        .where(InterviewMessage.session_id == session.id)
        .order_by(desc(InterviewMessage.created_at))
        .limit(1)
    )
    last_msg = msgs_r.scalar_one_or_none()

    return {
        "session": {
            "id": session.id,
            "agent_type": session.agent_type,
            "job_role": session.job_role,
            "company": session.company,
            "experience_level": session.experience_level,
            "answered_questions": session.answered_questions,
            "total_questions": session.total_questions,
            "last_question": last_msg.content if last_msg and last_msg.role == "assistant" else "",
            "started_at": session.started_at.isoformat(),
        }
    }

@router.get("/active")
async def get_active_session(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Get the most recent in-progress session if any."""
    r = await db.execute(
        select(InterviewSession)
        .where(
            InterviewSession.user_id == user_id,
            InterviewSession.status == "in_progress",
        )
        .order_by(desc(InterviewSession.started_at))
        .limit(1)
    )
    session = r.scalar_one_or_none()
    if not session:
        return {"session": None}

    # Get last question asked
    msgs_r = await db.execute(
        select(InterviewMessage)
        .where(InterviewMessage.session_id == session.id)
        .order_by(desc(InterviewMessage.created_at))
        .limit(1)
    )
    last_msg = msgs_r.scalar_one_or_none()

    return {
        "session": {
            "id": session.id,
            "agent_type": session.agent_type,
            "job_role": session.job_role,
            "company": session.company,
            "experience_level": session.experience_level,
            "answered_questions": session.answered_questions,
            "total_questions": session.total_questions,
            "last_question": last_msg.content if last_msg and last_msg.role == "assistant" else "",
            "started_at": session.started_at.isoformat(),
        }
    }
