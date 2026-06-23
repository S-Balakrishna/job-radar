# 🚀 JobRadar — Setup Guide

## What This Does
- Tracks company career pages every 3 hours (via GitHub Actions — FREE)
- Detects early career & data/analyst jobs automatically
- Sends you an email alert for priority roles
- Beautiful dashboard on Vercel to manage everything

---

## Step 1 — Supabase (Database)

1. Go to **https://supabase.com** → Sign up free
2. Create a new project (remember your DB password)
3. Go to **SQL Editor** → paste the contents of `supabase_schema.sql` → Run
4. Go to **Settings → API** → copy:
   - `Project URL` → this is your `SUPABASE_URL`
   - `anon public` key → this is your `SUPABASE_KEY`

---

## Step 2 — Gmail App Password (for email alerts)

1. Go to your Google Account → Security
2. Enable **2-Step Verification** if not already on
3. Search "App passwords" → Create one for "Mail"
4. Copy the 16-character password (no spaces)

---

## Step 3 — GitHub (Scraper + Free Scheduler)

1. Create a new repo at **https://github.com/new** (name: `job-radar`)
2. Push all these files to the repo:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/job-radar.git
   git push -u origin main
   ```
3. Go to your repo → **Settings → Secrets and variables → Actions**
4. Add these secrets one by one:

   | Secret Name       | Value                              |
   |-------------------|------------------------------------|
   | `SUPABASE_URL`    | Your Supabase Project URL          |
   | `SUPABASE_KEY`    | Your Supabase anon public key      |
   | `EMAIL_FROM`      | your.gmail@gmail.com               |
   | `EMAIL_PASS`      | Your 16-char Gmail app password    |
   | `EMAIL_TO`        | email where you want alerts        |

5. Go to **Actions** tab → you should see "Job Tracker Scraper" workflow
6. Click it → **Run workflow** to test it manually right now!

---

## Step 4 — Vercel (Dashboard)

1. Go to **https://vercel.com** → Sign up with GitHub
2. Click **"Add New Project"** → Import your `job-radar` repo
3. Add these **Environment Variables** in Vercel:

   | Variable                        | Value                        |
   |---------------------------------|------------------------------|
   | `REACT_APP_SUPABASE_URL`        | Your Supabase Project URL    |
   | `REACT_APP_SUPABASE_ANON_KEY`   | Your Supabase anon public key|

4. Click **Deploy** → Done! 🎉

Your dashboard will be live at: `https://job-radar-yourname.vercel.app`

---

## How It Works After Setup

```
Every 3 hours (auto):
  GitHub Actions → runs scraper.py
    → scrapes all career pages you added
    → detects new early career jobs
    → saves to Supabase
    → emails you if data/analyst role found ⭐

Anytime you want:
  Open your Vercel dashboard
    → See all new jobs
    → Click "Apply Now"
    → Mark as Applied / Saved / Rejected
```

---

## Adding Companies to Track

1. Open your Vercel dashboard
2. Click **"Track Company"** button
3. Enter company name + career page URL
4. The next scraper run will scan it!

**Good career page URLs to start with:**
- https://www.google.com/about/careers/
- https://careers.microsoft.com
- https://www.amazon.jobs
- https://www.flipkart.com/careers
- https://razorpay.com/jobs/
- https://swiggy.com/careers
- https://careers.zomato.com
- https://www.meesho.io/careers

---

## Running the Scraper Manually

Go to GitHub → Actions → "Job Tracker Scraper" → "Run workflow"

---

## 100% Free Forever ✅
- GitHub Actions: 2000 free minutes/month (you'll use ~30/month)
- Supabase: 500MB free, unlimited API calls
- Vercel: unlimited deploys, free custom domain

---

## Questions?
If you get stuck at any step, just ask!
