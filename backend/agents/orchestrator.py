from agents.hr_agent import HRAgent
from agents.technical_agent import TechnicalAgent
from agents.coding_agent import CodingAgent
from agents.system_design_agent import SystemDesignAgent
from agents.resume_agent import ResumeAgent

_AGENT_MAP = {
    "hr": HRAgent,
    "technical": TechnicalAgent,
    "coding": CodingAgent,
    "system_design": SystemDesignAgent,
    "resume": ResumeAgent,
}

class AgentOrchestrator:
    def __init__(self):
        self._agents = {}

    def _get_agent(self, agent_type: str):
        if agent_type not in self._agents:
            cls = _AGENT_MAP.get(agent_type)
            if not cls:
                raise ValueError(f"Unknown agent type: {agent_type}")
            self._agents[agent_type] = cls()
        return self._agents[agent_type]

    async def start_session(self, agent_type: str, job_role: str, company: str, experience_level: str) -> dict:
        agent = self._get_agent(agent_type)
        return await agent.generate_opening(job_role=job_role, company=company, experience_level=experience_level)

    async def evaluate_answer(self, agent_type: str, job_role: str, company: str,
                               experience_level: str, question: str, answer: str,
                               question_number: int, conversation_history: list) -> dict:
        agent = self._get_agent(agent_type)
        return await agent.evaluate_and_continue(
            job_role=job_role, company=company, experience_level=experience_level,
            question=question, answer=answer, question_number=question_number, history=conversation_history
        )

    async def complete_session(self, agent_type: str, job_role: str, scores: list, conversation_history: list) -> dict:
        agent = self._get_agent(agent_type)
        return await agent.generate_summary(job_role=job_role, scores=scores, history=conversation_history)

    async def analyze_resume(self, resume_text: str, target_role: str, target_company: str = None) -> dict:
        agent = self._get_agent("resume")
        return await agent.analyze(resume_text=resume_text, target_role=target_role, target_company=target_company)

orchestrator = AgentOrchestrator()
