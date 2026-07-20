import httpx
import logging
import json
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
# Using the fast instant model requested by the user
GROQ_MODEL = "llama-3.1-8b-instant"


async def _call_groq_api(system_prompt: str, user_prompt: str, max_tokens: int = 250) -> Optional[str]:
    """
    Helper function to call the Groq Chat Completions API.
    Returns the text response, or None if it fails.
    """
    if not settings.GROQ_API_KEY:
        logger.warning("GROQ_API_KEY is not set. Skipping AI generation.")
        return None

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    
    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "max_tokens": max_tokens,
        "temperature": 0.5,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(GROQ_API_URL, headers=headers, json=payload)
        resp.raise_for_status()
        
        data = resp.json()
        if "choices" in data and len(data["choices"]) > 0:
            return data["choices"][0]["message"]["content"].strip()
            
    except Exception as e:
        logger.error(f"Failed to fetch response from Groq API: {e}")
        
    return None


async def generate_score_explanation(score_data: dict) -> str:
    """
    Generates a helpful AI explanation of the business's credit score drivers,
    focusing on what they lack and how they can improve.
    """
    score = score_data.get("score", "Unknown")
    drivers = score_data.get("drivers", [])
    
    system_prompt = (
        "You are an expert financial advisor for small businesses. "
        "The user will provide their current credit score and the key factors (drivers) affecting it. "
        "Your task is to provide a brief, actionable explanation (under 50 words) of why their score is what it is, "
        "specifically focusing on what they lack and how they can improve their score."
    )
    
    user_prompt = f"My credit score is {score}. Here are the drivers impacting it: {json.dumps(drivers)}. How can I improve my score?"
    
    explanation = await _call_groq_api(system_prompt, user_prompt, max_tokens=150)
    
    if not explanation:
        return "Keep processing more transactions through your connected accounts to build a stronger credit history and improve your score."
        
    return explanation


async def generate_dashboard_insights(summary: dict, monthly_kpis: list, trend_insights: dict, budget_guidance: dict) -> str:
    """
    Generates a personalized AI insight for the business dashboard based on their financial metrics.
    """
    system_prompt = (
        "You are an expert financial analyst. Review the business's financial metrics and provide "
        "a concise, 2-sentence summary of their financial health. Focus on actionable insights regarding "
        "their savings rate, spending habits, or how they can improve their cash flow."
    )
    
    payload = {
        "summary": summary,
        "monthly_kpis": monthly_kpis,
        "trend_insights": trend_insights,
        "budget_guidance": budget_guidance,
    }
    
    user_prompt = f"Here is my financial data: {json.dumps(payload)}. What is your analysis?"
    
    insight = await _call_groq_api(system_prompt, user_prompt, max_tokens=100)
    
    if not insight:
        return "Connect more data sources to receive personalized AI insights on your financial health."
        
    return insight
