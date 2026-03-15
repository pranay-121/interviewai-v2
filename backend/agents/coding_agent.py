from agents.base_agent import BaseInterviewAgent
from core.config import settings

class CodingAgent(BaseInterviewAgent):
    model_name = settings.CODING_LLM_MODEL
    QUESTIONS_PER_SESSION = 5
    system_prompt = """You are a coding interview specialist at a top-tier tech company.
Present coding problems appropriate to experience: Fresher=Easy, Junior=Medium, Mid/Senior=Hard.
When presenting a problem: give clear problem statement, examples, constraints, and edge cases.
Evaluate: algorithm correctness, time/space complexity (Big O), code quality, edge case handling.
Always provide a clean optimized solution with complexity analysis."""

    async def generate_opening(self, job_role: str, company: str, experience_level: str) -> dict:
        ctx = self._build_context_header(job_role, company, experience_level)
        company_hint = f" commonly asked at {company}" if company else ""
        prompt = (
            f"{self.system_prompt}\n\n{ctx}\n"
            f"Start a coding interview{company_hint}. Greet the candidate briefly, "
            "explain the format (describe approach first, then code), then present Problem #1. "
            "Respond ONLY with valid JSON:\n"
            "{\n"
            '  "greeting": "...",\n'
            '  "question": "Full problem with examples and constraints",\n'
            '  "context": "What concept this tests",\n'
            f'  "total_questions": {self.QUESTIONS_PER_SESSION}\n'
            "}"
        )
        raw = await self._invoke(prompt)
        return self._parse_json(raw, fallback_key="question")
