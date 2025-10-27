import os, json, re
from datetime import datetime
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

import mysql.connector

# LangChain + OpenAI (or switch to another LC chat model if you prefer)
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from tavily import TavilyClient 

#provides live info like weather
#LangChain + OpenAI → handles natural language + structured output
#FastAPI → builds REST endpoints
#Pydantic → validates JSON input models (Booking, Preferences, etc.)
load_dotenv()

# ---------- ENV ----------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")  #Loads .env variables for keys and DB credentials.
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
MYSQL_URI = os.getenv("MYSQL_URI", "")

# Alternatively support discrete envs:
MYSQL_HOST = os.getenv("MYSQL_HOST")
MYSQL_USER = os.getenv("MYSQL_USER")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD")
MYSQL_DB = os.getenv("MYSQL_DB")

#Returns a connection to the airbnb_lab MySQL DB.
#Supports either direct variables or URI syntax.
# ---------- DB ----------
def get_db_conn():
    if MYSQL_URI:
        # very simple mysql+connector uri parser
        # Format: mysql://user:password@host:port/db
        import urllib.parse as up
        up.uses_netloc.append("mysql")
        parsed = up.urlparse(MYSQL_URI)
        return mysql.connector.connect(
            host=parsed.hostname,
            port=parsed.port or 3306,
            user=parsed.username,
            password=parsed.password,
            database=parsed.path.lstrip("/"),
            autocommit=True,
        )
    else:
        return mysql.connector.connect(
            host=MYSQL_HOST or "127.0.0.1",
            user=MYSQL_USER or "root",
            password=MYSQL_PASSWORD or "",
            database=MYSQL_DB or "airbnb_lab",
            autocommit=True,
        )

#Logs every AI request/response to agent_logs for debugging or analytics.
def log_to_db(nlu_query: Optional[str], booking_json: Dict[str, Any],
              preferences_json: Dict[str, Any], response_json: Dict[str, Any]) -> None:
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO agent_logs (nlu_query, booking_json, preferences_json, response_json) VALUES (%s, %s, %s, %s)",
        (
            nlu_query,
            json.dumps(booking_json, ensure_ascii=False),
            json.dumps(preferences_json, ensure_ascii=False),
            json.dumps(response_json, ensure_ascii=False),
        ),
    )
    cur.close()
    conn.close()
#Each request to /ai/concierge must include these fields, ensuring clean API contracts.
# ---------- MODELS ----------
class Booking(BaseModel):
    start_date: str  # "2025-10-20"
    end_date: str    # "2025-10-23"
    location: str    # "San Francisco, CA"
    party_type: str  # "family with two kids"

class Preferences(BaseModel):
    budget: Optional[str] = "moderate"     # "budget", "moderate", "premium"
    interests: List[str] = []              # ["museums","parks"]
    mobility_needs: Optional[str] = None   # "wheelchair"
    dietary_filters: List[str] = []        # ["vegan","halal","gluten-free"]

class ConciergeRequest(BaseModel):
    booking: Booking
    preferences: Preferences
    nlu_query: Optional[str] = Field(default=None, description="Free-text ask. Booking must be passed in context.")

# ---------- LIVE CONTEXT (Tavily minimal) ----------
def fetch_live_context(location: str, start_date: str, end_date: str) -> Dict[str, Any]:
    """
    Minimal Tavily usage: run 3 quick searches (weather, POIs, events) and return shallow bullets.
    Keep this tiny on purpose. The LLM will stitch these into outputs.
    """
    if not TAVILY_API_KEY:
        # No key: return placeholders so you can still demo end-to-end.
        return {
            "weather": [f"Weather info for {location} ({start_date}→{end_date}) not fetched (no TAVILY_API_KEY)."],
            "pois": ["Top attractions list placeholder."],
            "events": ["Local events placeholder."],
        }

    tv = TavilyClient(api_key=TAVILY_API_KEY)

    def brief(q: str) -> List[str]:
        res = tv.search(q, search_depth="basic", max_results=3)
        bullets = []
        for item in (res.get("results") or [])[:3]:
            # super short—title or a 1-liner
            txt = item.get("title") or item.get("content") or ""
            if txt:
                bullets.append(txt.strip()[:200])
        return bullets or ["No quick results."]
    
    weather_q = f"{location} weather {start_date} to {end_date} forecast"
    poi_q     = f"things to do in {location} attractions"
    events_q  = f"events in {location} {start_date} to {end_date}"

    return {
        "weather": brief(weather_q),
        "pois": brief(poi_q),
        "events": brief(events_q),
    }
#Constructs the conversation prompt for OpenAI.
#System message enforces “JSON only” output.
#Human message embeds booking data, preferences, and live context.
# ---------- LLM PLAN ----------
def build_prompt(req: ConciergeRequest, live: Dict[str, Any]) -> List[Any]:
    """
    System + Human messages. The Human asks for STRICT JSON.
    Output schema is exactly what Lab requires.
    """
    sys = SystemMessage(content=(
        "You are an AI concierge that returns STRICT JSON only. "
        "No commentary. No markdown. If uncertain, make reasonable defaults."
    ))

    # minimal NLU instruction (booking already in context)
    nlu_line = f'User ask: "{req.nlu_query}"' if req.nlu_query else "User ask: (none)"

    human = HumanMessage(content=(
        f"Booking:\n"
        f"- dates: {req.booking.start_date} to {req.booking.end_date}\n"
        f"- location: {req.booking.location}\n"
        f"- party_type: {req.booking.party_type}\n\n"
        f"Preferences:\n"
        f"- budget: {req.preferences.budget}\n"
        f"- interests: {', '.join(req.preferences.interests) if req.preferences.interests else '(none)'}\n"
        f"- mobility_needs: {req.preferences.mobility_needs or '(none)'}\n"
        f"- dietary_filters: {', '.join(req.preferences.dietary_filters) if req.preferences.dietary_filters else '(none)'}\n\n"
        f"Live Context (very short bullets):\n"
        f"- weather: {live.get('weather', [])}\n"
        f"- pois: {live.get('pois', [])}\n"
        f"- events: {live.get('events', [])}\n\n"
        f"{nlu_line}\n\n"
        "Return STRICT JSON with this shape:\n"
        "{\n"
        '  "plan": [\n'
        '    {"day": 1, "date": "YYYY-MM-DD", "morning": "...", "afternoon": "...", "evening": "..."},\n'
        "    ... (one per day)\n"
        "  ],\n"
        '  "activities": [\n'
        '    {"title":"", "address":"","geo":{"lat":0,"lng":0}, "price_tier":"$|$$|$$$", "duration_min":90,\n'
        '     "tags":[""], "wheelchair_friendly":true, "child_friendly":true}\n'
        "  ],\n"
        '  "restaurants": [\n'
        '    {"name":"", "address":"", "cuisine":"", "satisfies_filters":["vegan"], "price_tier":"$|$$|$$$", "notes":""}\n'
        "  ],\n"
        '  "packing_checklist": ["light jacket", "sunscreen", "..."]\n'
        "}\n"
        "Rules:\n"
        "- Respect dietary_filters (e.g., vegan) for restaurants.\n"
        "- Respect mobility_needs (e.g., wheelchair) on activities flags.\n"
        "- Plan must cover each day between start_date and end_date.\n"
        "- Keep texts short, practical, and specific to location.\n"
        "- Output JSON only—no code fences, no extra text."
    ))
    return [sys, human]

def extract_json(text: str) -> Dict[str, Any]:
    """
    Be tolerant: some models may wrap in code fences. Extract the first {...} block.
    """
    m = re.search(r"\{.*\}\s*$", text, flags=re.S)
    blob = m.group(0) if m else text
    return json.loads(blob)


#running model 
#Uses LangChain’s ChatOpenAI wrapper to query the model.
#Extracts the JSON response even if it’s wrapped in code fences
def run_agent(req: ConciergeRequest) -> Dict[str, Any]:
    live = fetch_live_context(req.booking.location, req.booking.start_date, req.booking.end_date)

    llm = ChatOpenAI(
        model="gpt-4o-mini",  # tiny/cheap; change if your lab needs another
        temperature=0.2,
        api_key=OPENAI_API_KEY or None,
    )

    msgs = build_prompt(req, live)
    resp = llm.invoke(msgs)
    data = extract_json(resp.content)
    #Guarantees all expected fields exist, even if model output is partial.
    # minimal safeguard: ensure required keys exist
    for k in ["plan", "activities", "restaurants", "packing_checklist"]:
        data.setdefault(k, [] if k != "packing_checklist" else ["light jacket"])

    return data

# ---------- API ----------
app = FastAPI(title="AI Concierge Agent (Lab 1 Minimal)")
#Enables CORS for all origins → allows your React frontend to call this API directly.
app.add_middleware(
    CORSMiddleware, #As fro
    allow_origins=["*"],  #Allows all domains (like localhost:5173, 127.0.0.1, etc.) to make requests.
    allow_credentials=True,    #Allows cookies or authentication headers to be included.
    allow_methods=["*"],    #Allows all HTTP request types (GET, POST, PUT, DELETE, etc.).
    allow_headers=["*"],
)



@app.post("/ai/concierge")
def concierge(req: ConciergeRequest) -> Dict[str, Any]:
    try:
        result = run_agent(req)
    except Exception as e:
        # surface the real cause instead of 500
        raise HTTPException(status_code=400, detail=f"{e}")
    try:
        log_to_db(req.nlu_query, req.booking.model_dump(), req.preferences.model_dump(), result)
    except Exception as e:
        print("DB log error:", e)
    return result


# Local run:
# uvicorn main:app --reload --port 8001
