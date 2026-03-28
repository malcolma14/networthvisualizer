# Net Worth Dashboard

A tool for IG Wealth Management financial advisors to quickly analyze a client's net worth. Upload the client's net worth statement CSV from IG Online, and the app will research all investment holdings, flag concentration risks and tax-location issues, ask a few clarifying questions, and produce a clean, printable one-page dashboard — all in about a minute.

---

## One-time setup

Follow these four steps the first time you use the app. You only need to do this once.

### Step 1: Install Node.js

If you don't already have Node.js installed:

1. Go to https://nodejs.org
2. Download the **LTS** version (the green button)
3. Run the installer and follow the prompts

To check if it's already installed, open Terminal (Mac) or Command Prompt (Windows) and type:
```
node --version
```
If you see a version number (e.g. `v20.11.0`), you're good.

### Step 2: Install the app

Open Terminal, navigate to this project folder, and run:
```
npm run install:all
```
This installs everything the app needs. It may take a minute.

### Step 3: Set up your API key

1. In the project folder, find the file called `.env.example`
2. Make a copy of it and rename the copy to `.env`
3. Open `.env` in any text editor
4. Replace `your_api_key_here` with your Anthropic API key
5. Save the file

Your `.env` file should look like this:
```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
PORT=3001
```

> **Your API key stays on your computer.** It is never sent anywhere except directly to Anthropic's API from your local machine.

### Step 4: You're done!

Proceed to "How to run it" below.

---

## How to run it

1. Open Terminal and navigate to this project folder
2. Run:
   ```
   npm run dev
   ```
3. Your browser will open automatically to the app

To stop the app, press `Ctrl + C` in the Terminal window.

---

## How to use it

1. **Upload** — Drag and drop (or click to browse) a client's net worth statement CSV exported from IG Online
2. **Answer questions** — The app will ask 2–5 quick clarifying questions about the client's finances. Answer what you can, skip what you don't know
3. **View dashboard** — A polished one-page dashboard appears with:
   - Asset breakdown by class
   - Concentration risk flags
   - Tax-location alerts
   - Fund research summaries
   - Donut chart and net worth summary
4. **Print** — Click "Print / PDF" to save or print the dashboard. It's formatted for landscape Letter paper

---

## Privacy & security

- The app runs entirely on your computer
- Your API key is stored only in the `.env` file on your machine
- Client data is processed locally and sent only to Anthropic's API for analysis
- No data is stored permanently — everything resets when you close the app
