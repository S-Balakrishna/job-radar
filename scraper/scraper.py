import os
import re
import smtplib
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime

# ── ENV VARS (set in GitHub Secrets) ─────────────────────────────────────────
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
EMAIL_FROM   = os.environ["EMAIL_FROM"]
EMAIL_PASS   = os.environ["EMAIL_PASS"]
EMAIL_TO     = os.environ["EMAIL_TO"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── KEYWORD FILTERS ───────────────────────────────────────────────────────────
PRIORITY_1_KEYWORDS = [
    "data engineer", "data analyst", "product analyst", "business analyst",
    "analytics engineer", "bi developer", "business intelligence",
    "reporting analyst", "sql developer", "data science", "ml engineer",
    "machine learning", "data operations", "analytics", "analyst", "data"
]

EARLY_CAREER_KEYWORDS = [
    "entry level", "entry-level", "fresher", "fresh graduate", "junior",
    "associate", "trainee", "intern", "graduate", "new grad",
    "0-1", "0-2", "0-3", "1-2", "1-3", "0 to 1", "0 to 2", "0 to 3",
    "1 to 2", "1 to 3", "1-5", "0 year", "1 year", "2 year"
]

SENIOR_EXCLUDE_KEYWORDS = [
    "senior", "sr.", "lead", "principal", "staff", "director",
    "manager", "head of", "vp ", "vice president", "architect",
    "5+ year", "6+ year", "7+ year", "8+ year", "10+ year",
    "5 to", "6 to", "7 to", "8 to", "10 to"
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

# ── HELPERS ───────────────────────────────────────────────────────────────────
def normalize(text: str) -> str:
    return text.lower().strip()

def is_senior(title: str, description: str = "") -> bool:
    combined = normalize(f"{title} {description}")
    return any(kw in combined for kw in SENIOR_EXCLUDE_KEYWORDS)

def get_priority(title: str, description: str = "") -> int | None:
    """Returns 1 (data/analyst), 2 (other early career), or None (skip)."""
    combined = normalize(f"{title} {description}")

    # Hard exclude seniors
    if is_senior(title, description):
        return None

    # Check if early career
    is_early = any(kw in combined for kw in EARLY_CAREER_KEYWORDS)

    # Check if data/analyst role
    is_data = any(kw in combined for kw in PRIORITY_1_KEYWORDS)

    if is_data:
        return 1  # Always show data roles (even if exp not mentioned)
    if is_early:
        return 2  # Other early career roles

    return None  # Skip

def extract_experience(text: str) -> str:
    pattern = r'(\d+\s*[-–to]+\s*\d+\s*(?:years?|yrs?)|[\d]+\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience)?)'
    matches = re.findall(pattern, text.lower())
    return ", ".join(matches[:3]) if matches else ""

# ── SCRAPER ───────────────────────────────────────────────────────────────────
def scrape_career_page(url: str) -> list[dict]:
    """Scrapes a career page and returns list of job dicts."""
    jobs = []
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        # Remove nav/footer noise
        for tag in soup(["nav", "footer", "script", "style", "header"]):
            tag.decompose()

        # Find job-like elements: links with job-sounding text
        job_links = []
        for a in soup.find_all("a", href=True):
            text = a.get_text(strip=True)
            if len(text) > 5 and len(text) < 150:
                job_links.append((text, a["href"]))

        # Also grab list items / divs that look like job titles
        for el in soup.find_all(["li", "div", "h2", "h3", "h4", "span"]):
            text = el.get_text(strip=True)
            if 5 < len(text) < 150:
                job_links.append((text, url))

        seen_titles = set()
        for title, href in job_links:
            if title in seen_titles:
                continue

            # Build absolute URL
            if href.startswith("http"):
                job_url = href
            elif href.startswith("/"):
                from urllib.parse import urlparse
                base = urlparse(url)
                job_url = f"{base.scheme}://{base.netloc}{href}"
            else:
                job_url = url

            priority = get_priority(title)
            if priority is None:
                continue

            exp = extract_experience(title)
            seen_titles.add(title)
            jobs.append({
                "title": title,
                "url": job_url,
                "priority": priority,
                "experience_mentioned": exp,
                "location": "",
                "description": ""
            })

    except Exception as e:
        print(f"  ⚠️  Error scraping {url}: {e}")

    return jobs

# ── EMAIL ─────────────────────────────────────────────────────────────────────
def send_email_alert(new_jobs: list[dict], company_name: str, career_url: str):
    if not new_jobs:
        return

    priority1 = [j for j in new_jobs if j["priority"] == 1]
    priority2 = [j for j in new_jobs if j["priority"] == 2]

    html = f"""
    <html><body style="font-family:Arial,sans-serif;background:#0a0a0f;color:#e0e0e0;padding:24px;">
    <div style="max-width:600px;margin:auto;background:#13131a;border-radius:12px;padding:24px;border:1px solid #2a2a3a;">
      <h1 style="color:#7c3aed;margin-bottom:4px;">🚀 New Jobs at {company_name}</h1>
      <p style="color:#888;margin-top:0;">{career_url}</p>
      <p style="color:#a0a0b0;">Found <strong style="color:#7c3aed">{len(new_jobs)}</strong> new early-career jobs!</p>
    """

    if priority1:
        html += """<h2 style="color:#f59e0b;border-bottom:1px solid #2a2a3a;padding-bottom:8px;">
        ⭐ Priority: Data & Analyst Roles</h2><ul style="padding-left:20px;">"""
        for j in priority1:
            exp = f" ({j['experience_mentioned']})" if j["experience_mentioned"] else ""
            html += f"""<li style="margin-bottom:12px;">
              <a href="{j['url']}" style="color:#7c3aed;font-weight:bold;text-decoration:none;">
                {j['title']}</a>{exp}
            </li>"""
        html += "</ul>"

    if priority2:
        html += """<h2 style="color:#10b981;border-bottom:1px solid #2a2a3a;padding-bottom:8px;">
        🟢 Other Early Career Roles</h2><ul style="padding-left:20px;">"""
        for j in priority2:
            exp = f" ({j['experience_mentioned']})" if j["experience_mentioned"] else ""
            html += f"""<li style="margin-bottom:12px;">
              <a href="{j['url']}" style="color:#10b981;text-decoration:none;">
                {j['title']}</a>{exp}
            </li>"""
        html += "</ul>"

    html += f"""
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #2a2a3a;text-align:center;">
        <a href="https://your-vercel-url.vercel.app" 
           style="background:#7c3aed;color:white;padding:12px 24px;border-radius:8px;
                  text-decoration:none;font-weight:bold;">
          Open Dashboard →
        </a>
      </div>
    </div></body></html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"🚀 {len(new_jobs)} new jobs at {company_name} — Apply Now!"
    msg["From"] = EMAIL_FROM
    msg["To"] = EMAIL_TO
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(EMAIL_FROM, EMAIL_PASS)
            server.sendmail(EMAIL_FROM, EMAIL_TO, msg.as_string())
        print(f"  ✉️  Email sent for {company_name}!")
    except Exception as e:
        print(f"  ⚠️  Email failed: {e}")

# ── MAIN ──────────────────────────────────────────────────────────────────────
def main():
    print(f"\n{'='*50}")
    print(f"🔍 Job Tracker Scraper — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"{'='*50}")

    # Fetch all active companies
    result = supabase.table("companies").select("*").eq("status", "active").execute()
    companies = result.data

    if not companies:
        print("No companies to track yet. Add some via the dashboard!")
        return

    for company in companies:
        print(f"\n📡 Scanning: {company['name']} — {company['career_url']}")

        # Get jobs already stored for this company (to detect NEW ones)
        existing = supabase.table("jobs")\
            .select("title")\
            .eq("company_id", company["id"])\
            .execute()
        existing_titles = {j["title"].lower() for j in existing.data}

        # Scrape
        found_jobs = scrape_career_page(company["career_url"])
        print(f"  Found {len(found_jobs)} matching jobs")

        # Filter only NEW jobs
        new_jobs = [j for j in found_jobs if j["title"].lower() not in existing_titles]
        print(f"  {len(new_jobs)} are NEW")

        if new_jobs:
            # Insert into Supabase
            rows = [{**j, "company_id": company["id"], "is_notified": False} for j in new_jobs]
            supabase.table("jobs").insert(rows).execute()

            # Send email for priority 1 jobs
            p1_jobs = [j for j in new_jobs if j["priority"] == 1]
            if p1_jobs:
                send_email_alert(new_jobs, company["name"], company["career_url"])
                # Mark as notified
                titles = [j["title"] for j in p1_jobs]
                supabase.table("jobs")\
                    .update({"is_notified": True})\
                    .eq("company_id", company["id"])\
                    .in_("title", titles)\
                    .execute()

        # Update last_scraped
        supabase.table("companies")\
            .update({"last_scraped": datetime.utcnow().isoformat()})\
            .eq("id", company["id"])\
            .execute()

    print(f"\n✅ Scrape complete!")

if __name__ == "__main__":
    main()
