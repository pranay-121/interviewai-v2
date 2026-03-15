from fastapi import APIRouter, Depends
from core.security import get_current_user_id

router = APIRouter()

COMPANIES = ["Google","Amazon","Microsoft","Meta","Apple","Netflix","Uber",
             "Airbnb","Stripe","Salesforce","Goldman Sachs","JPMorgan",
             "Infosys","TCS","Wipro","Accenture","Adobe","Twitter","LinkedIn","Spotify"]

GUIDES = {
    "Google": {"difficulty_rating": 9.2,
               "interview_rounds": [
                   {"name": "Phone Screen", "description": "45-min coding (Medium/Hard)"},
                   {"name": "Onsite x4", "description": "Algorithms, System Design, Behavioral, Googleyness"}],
               "common_topics": ["Arrays","DP","Graphs","System Design at scale","Leadership principles"],
               "tips": ["Master Big O deeply","Practice distributed systems","Prepare 5 STAR stories","Ask clarifying questions before coding"]},
    "Amazon": {"difficulty_rating": 8.8,
                "interview_rounds": [
                    {"name": "Online Assessment", "description": "2 LC problems in 90 min"},
                    {"name": "Loop x5", "description": "Bar raiser + Leadership Principles + Design"}],
                "common_topics": ["All 16 Leadership Principles","OOP design","Distributed systems","STAR stories"],
                "tips": ["Memorize all 16 Leadership Principles","Every answer needs a STAR story","Study AWS architecture"]},
    "Microsoft": {"difficulty_rating": 8.5,
                   "interview_rounds": [
                       {"name": "Phone Screen", "description": "LC medium coding"},
                       {"name": "Onsite x4", "description": "Coding + Design + Culture"}],
                   "common_topics": ["OOP","System design","Behavioral","Azure knowledge"],
                   "tips": ["Growth mindset is key","Explain thought process clearly","Be collaborative"]},
}

DEFAULT_GUIDE = {
    "interview_rounds": [
        {"name": "HR Screening", "description": "30-min phone screen"},
        {"name": "Technical Round 1", "description": "Data structures and algorithms"},
        {"name": "Technical Round 2", "description": "System design"},
        {"name": "Behavioral", "description": "Leadership and culture fit"},
    ],
    "common_topics": ["Arrays","Trees","System design","OOP","STAR method"],
    "tips": ["Research the company's products","Practice on whiteboard",
             "Prepare 5 STAR stories","Ask thoughtful questions"],
    "difficulty_rating": 7.5,
}

@router.get("/")
async def list_companies(user_id: str = Depends(get_current_user_id)):
    return {"companies": COMPANIES}

@router.get("/{company_name}/prep")
async def get_company_prep(company_name: str, user_id: str = Depends(get_current_user_id)):
    guide = GUIDES.get(company_name, DEFAULT_GUIDE)
    return {"company_name": company_name, **guide}
