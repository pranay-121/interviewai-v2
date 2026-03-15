from agents.base_agent import BaseInterviewAgent
from core.config import settings

class ResumeAgent(BaseInterviewAgent):
    model_name = settings.RESUME_LLM_MODEL
    QUESTIONS_PER_SESSION = 0
    system_prompt = """You are an expert resume reviewer and career coach with deep expertise in
ATS systems, technical hiring at top companies, and career development."""

    async def analyze(self, resume_text: str, target_role: str, target_company: str = None) -> dict:
        company_line = f"Target company: {target_company}" if target_company else ""
        prompt = (
            f"{self.system_prompt}\n\n"
            f"Target role: {target_role}\n{company_line}\n\n"
            f"Resume:\n{resume_text[:4000]}\n\n"
            "Analyze this resume thoroughly. Respond ONLY with valid JSON:\n"
            "{\n"
            '  "overall_score": <0-100>,\n'
            '  "ats_score": <0-100>,\n'
            '  "summary": "3-4 sentence assessment",\n'
            '  "strengths": ["strength1", "strength2"],\n'
            '  "critical_issues": ["issue1", "issue2"],\n'
            '  "improvements": [{"section": "...", "issue": "...", "suggestion": "..."}],\n'
            '  "missing_keywords": ["keyword1", "keyword2"],\n'
            '  "rewritten_summary": "A stronger professional summary",\n'
            '  "interview_questions": ["question1", "question2"],\n'
            '  "role_fit": "Strong / Good / Moderate / Weak"\n'
            "}"
        )
        raw = await self._invoke(prompt)
        return self._parse_json(raw, fallback_key="summary")
