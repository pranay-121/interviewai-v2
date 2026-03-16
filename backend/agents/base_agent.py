import json
import re
from core.config import settings


class BaseInterviewAgent:
    model_name: str = settings.DEFAULT_LLM_MODEL
    QUESTIONS_PER_SESSION: int = 10
    system_prompt: str = "You are a professional interviewer."

    def __init__(self):
        self._provider = settings.AI_PROVIDER

    async def _invoke(self, prompt: str) -> str:
        if self._provider == "groq":
            return await self._invoke_groq(prompt)
        elif self._provider == "claude":
            return await self._invoke_claude(prompt)
        return await self._invoke_ollama(prompt)

    async def _invoke_groq(self, prompt: str) -> str:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2048,
            temperature=0.7,
        )
        return response.choices[0].message.content

    async def _invoke_claude(self, prompt: str) -> str:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        message = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}]
        )
        return message.content[0].text

    async def _invoke_ollama(self, prompt: str) -> str:
        from langchain_ollama import OllamaLLM
        llm = OllamaLLM(
            model=self.model_name,
            base_url=settings.OLLAMA_BASE_URL,
            temperature=0.7,
            timeout=120,
        )
        return await llm.ainvoke(prompt)

    def _build_context_header(self, job_role: str, company: str, experience_level: str) -> str:
        company_line = f"Target company: {company}" if company else "No specific company"
        exp_map = {
            "fresher": "0 years (fresher/entry-level)",
            "junior": "1-3 years",
            "mid": "3-5 years",
            "senior": "5+ years (senior level)",
        }
        return (
            f"Job role: {job_role}\n"
            f"{company_line}\n"
            f"Candidate level: {exp_map.get(experience_level, experience_level)}\n"
        )

    async def generate_opening(self, job_role: str, company: str, experience_level: str) -> dict:
        ctx = self._build_context_header(job_role, company, experience_level)
        prompt = (
            f"{self.system_prompt}\n\n{ctx}\n"
            "Start the interview. Greet the candidate warmly (2 sentences), "
            "then ask the first question. Respond ONLY with valid JSON:\n"
            "{\n"
            '  "greeting": "...",\n'
            '  "question": "...",\n'
            '  "context": "brief hint about what this tests",\n'
            f'  "total_questions": {self.QUESTIONS_PER_SESSION}\n'
            "}"
        )
        raw = await self._invoke(prompt)
        return self._parse_json(raw, fallback_key="question")

    async def evaluate_and_continue(
        self, job_role: str, company: str, experience_level: str,
        question: str, answer: str, question_number: int, history: list
    ) -> dict:
        ctx = self._build_context_header(job_role, company, experience_level)
        is_last = question_number >= self.QUESTIONS_PER_SESSION
        next_q = "" if is_last else '  "next_question": "...",\n'

        prompt = (
            f"{self.system_prompt}\n\n{ctx}\n"
            f"Question asked: {question}\n"
            f"Candidate answer: {answer}\n\n"
            f"Evaluate this answer. "
            f"{'This is the FINAL question, do NOT include next_question.' if is_last else f'Generate question #{question_number + 1} of {self.QUESTIONS_PER_SESSION}.'}\n"
            "Respond ONLY with valid JSON:\n"
            "{\n"
            '  "score": <number 0-10>,\n'
            '  "feedback": "2-3 sentences of specific constructive feedback",\n'
            '  "suggested_answer": "A model answer showing the ideal response",\n'
            '  "strong_points": ["point1", "point2"],\n'
            '  "improvement_areas": ["area1", "area2"],\n'
            + next_q +
            "}"
        )
        raw = await self._invoke(prompt)
        result = self._parse_json(raw, fallback_key="feedback")
        result["is_complete"] = is_last
        return result

    async def generate_summary(self, job_role: str, scores: list, history: list) -> dict:
        avg = sum(scores) / len(scores) if scores else 0
        prompt = (
            f"{self.system_prompt}\n\n"
            f"Job role: {job_role}\n"
            f"Average score: {avg:.1f}/10\n"
            f"Questions answered: {len(history)}\n\n"
            "Generate a final performance review. Respond ONLY with valid JSON:\n"
            "{\n"
            '  "overall_score": <number 0-10>,\n'
            '  "performance_summary": "3-4 paragraph narrative assessment",\n'
            '  "top_strengths": ["strength1", "strength2", "strength3"],\n'
            '  "areas_to_improve": ["area1", "area2", "area3"],\n'
            '  "recommended_resources": ["resource1", "resource2"],\n'
            '  "hiring_likelihood": "Strong Yes / Yes / Maybe / No",\n'
            '  "next_steps": "Specific actionable advice"\n'
            "}"
        )
        raw = await self._invoke(prompt)
        return self._parse_json(raw, fallback_key="performance_summary")

    def _parse_json(self, raw: str, fallback_key: str = "content") -> dict:
        text = re.sub(r"```json\s*", "", raw)
        text = re.sub(r"```\s*", "", text).strip()
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        return {fallback_key: raw.strip(), "score": 5.0}
