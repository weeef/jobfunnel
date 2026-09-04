# 🎯 JobFunnel (CareerFunnel)

> **"Because looking for a job is hard enough without having to maintain a depressing spreadsheet."**

A slick, dark-mode Chrome Extension that automatically tracks jobs you apply to, syncs in real-time between your laptop and desktop (zero databases to configure), and turns your job hunt into an interactive visual pipeline—from *"resume thrown into the void"* all the way to *"offer secured & confetti popping"* 🏆.

---

## 💡 Why This Exists (The Origin Story)

A close friend of mine was deep in the job search grind, switching between their laptop on the couch and desktop in the office. They had:
- 40+ open tabs of job descriptions across LinkedIn, Indeed, and Greenhouse.
- A sad Google Sheet that hadn't been updated in three weeks.
- Zero clue which stage each application was in, or where the drop-offs were happening.

They asked: *"Can you please just build me something that automatically tracks what I apply to, syncs between my laptop and PC without me having to log in to another SaaS app, and gives me a visual funnel so I know if my resume is actually converting?"*

**JobFunnel was born.**

---

## ✨ Features That Make Job Hunting Less Painful

- 🕵️ **1-Click / Auto In-Page Detection**:
  - Injects a subtle, non-intrusive floating badge on **LinkedIn**, **Indeed**, **Greenhouse**, **Lever**, **Workday**, **Ashby**, and any careers portal.
  - Automatically scrapes Company Name, Role Title, Location, Salary Range, and Job URL.
  - Listens for "Easy Apply" and "Submit Application" clicks so you don't even have to remember to log it.

- ⚡ **Magic Cross-Device Sync (Laptop ⇄ PC)**:
  - Powered by native `chrome.storage.sync`.
  - **Zero accounts, zero API keys, zero monthly fees.** As long as you're logged into Chrome on both computers, your data syncs automatically in the background.

- 📊 **Recruitment Funnel & Conversion Analytics**:
  - Interactive visual step-down funnel:
    - **Applied** (100% of pipeline)
    - **Recruiter Screen** (% conversion & reach)
    - **Tech & Onsite Rounds** (% conversion)
    - **Offers Secured** 🏆 (With real canvas confetti celebration!)
  - **The Character Development Arc (Rejections Branch) 💅**: Tracks filtered applications and drop-offs at every stage so you can pinpoint where your pipeline leaks.

- 📋 **Drag & Drop Kanban Board**:
  - Smooth card movement between `Wishlist` ➔ `Applied` ➔ `Screening` ➔ `Technical` ➔ `Final Rounds` ➔ `Offer`.
  - Cards show company badges, salary pills, days since applied, and interview date reminders.
  - Relatable empty state jokes to keep your spirits high during the grind.

- 🗂️ **Sidebar Companion (`chrome.sidePanel`)**:
  - Keep your pipeline visible on the side while actively browsing job portals.

- 📦 **Your Data Stays Yours**:
  - 1-click **Export to CSV** (for Excel/Sheets) and **Export to JSON**.
  - 1-click **Backup Import** & **Clear All / Reset**.
  - Built-in **Demo Data** generator to test-drive the funnel before sending out your first application.

---

## 🚀 How to Install & Use (Step-by-Step)

### Step 1: Install the Extension on Chrome
> Do this on **both your laptop and desktop computer**!

1. Clone or download this repository:
   ```bash
   git clone https://github.com/weeef/jobfunnel.git
   ```
2. Open Google Chrome and go to:
   ```
   chrome://extensions
   ```
3. In the top-right corner, turn on **"Developer mode"**.
4. In the top-left corner, click **"Load unpacked"**.
5. Select the `jobfunnel` folder (the folder containing `manifest.json`).
6. 🎉 **Boom! JobFunnel is installed.**
7. Pin it to your Chrome toolbar by clicking the puzzle icon 🧩 in the top-right corner of Chrome and clicking the pin icon 📌 next to **JobFunnel**.

---

### Step 2: Turn on Chrome Sync (For Cross-Device Magic)

To make sure applications you save on your laptop show up immediately on your desktop:
1. In Chrome, go to `chrome://settings/syncSetup`.
2. Ensure you are signed into the same Google account on both computers.
3. Make sure **"Sync everything"** or at least **"Extensions"** is enabled.
4. That's literally it. No databases, no passwords, no servers.

---

### Step 3: How to Use It Daily

#### 1. Tracking Jobs While Browsing
- Head over to any job page on LinkedIn, Indeed, Greenhouse, Lever, or Workday.
- You'll see a sleek **"💼 Track Job"** badge in the bottom-right corner.
- Click it! It automatically fills in the company, role, location, and salary. Click **"Save & Sync"**.
- Already applied? The badge turns into a green **"✓ Tracked"** badge so you never accidentally apply to the same place twice.

#### 2. Visualizing Your Funnel & Pipeline
- Click the **JobFunnel** icon in your Chrome toolbar.
- Click **"Open Funnel Dashboard"** (or keep `dashboard.html` bookmarked).
- You get:
  - Total applied count, active pipelines, recruiter response rate %, and offer conversion %.
  - The visual funnel diagram showing drop-offs vs. passes.
  - The Kanban board where you can drag cards as you advance from initial screening to technical interviews and offers!
  - Drop a card into **"Offers"** to trigger the victory confetti 🎊!

#### 3. Using the Side Panel
- Click the toolbar icon and click **"Open Side Panel"**.
- Now you can view your pipeline on the side of your screen while browsing job listings!

#### 4. Managing Data (Export & Reset)
- Want to test the visualizer? Click **"Demo Data"** in the top bar to load 9 sample applications.
- Want to start completely clean? Click **"Clear All"** right next to it.
- Want a backup? Click **"Export / Backup"** ➔ **"Export to CSV"** or **"Export to JSON"**.

---

## 🛠️ Tech Stack & Architecture

- **Manifest V3**: Compliant with latest Chrome extension security standards.
- **Pure Native Vanilla JS / CSS**: Zero bloated dependencies, instant load times (<10ms).
- **Storage**: Key-partitioned `chrome.storage.sync` with companion `chrome.storage.local` cache for infinite resilience.
- **Glassmorphism Design System**: Modern dark theme with Plus Jakarta Sans and JetBrains Mono fonts.

---

## 🤝 Contributing / Feedback

Got feature ideas, spotted a bug on a niche job board, or want a parser added for your favorite job site? 
PRs and Issues are super welcome!

Made with ❤️ (and plenty of coffee) to make job hunting suck a little bit less.
