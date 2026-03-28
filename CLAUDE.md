# Net Worth Dashboard

## Overview
Internal tool for IG Wealth Management financial advisors. Upload a client's net worth statement CSV, get AI-powered analysis with fund research, answer clarifying questions, and generate a polished printable dashboard.

## Tech Stack
- **Frontend:** React 19 + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **AI:** Anthropic Claude API (`claude-sonnet-4-20250514`) via `@anthropic-ai/sdk`
- **CSV Parsing:** PapaParse (client-side) + custom IG WM parser (server-side)
- **PDF:** `window.print()` with landscape print CSS

## Folder Structure
```
├── server/
│   ├── index.js               ← Express server (port 3001)
│   ├── routes/
│   │   ├── analyse.js         ← CSV analysis + Claude + fund research
│   │   └── chat.js            ← Clarifying Q&A synthesis
│   └── lib/
│       ├── csvParser.js       ← IG WM CSV format parser
│       ├── assetClassifier.js ← Asset class mapping + flags
│       └── promptBuilder.js   ← Claude prompt templates
└── client/
    └── src/
        ├── App.jsx            ← Screen routing (Upload → Chat → Dashboard)
        ├── components/        ← All UI components
        └── lib/api.js         ← Frontend API client
```

## Key Commands
- `npm run dev` — starts both server and client (opens browser)
- `npm run build` — builds client for production
- `npm run server` — starts Express server only
- `npm run client` — starts Vite dev server only

## CSV Parsing Notes
- IG WM CSVs may use UTF-16 with BOM (`\xff\xfe`) — handled in frontend file reader
- Non-breaking spaces (`\xa0`) are used for indentation of holdings rows
- Section headers (e.g. "Non-registered accounts") define account types for all rows below
- Indented rows are sub-holdings of the account row above them
- Footer row contains client name, advisor name, and date

## Anthropic API Integration
- All API calls go through the Express server — API key never exposed to browser
- Three call types: analysis, fund research (batched parallel), chat synthesis
- Model: `claude-sonnet-4-20250514`
- API key loaded from `.env` as `ANTHROPIC_API_KEY`

## Brand Colours (IG Wealth Management)
- Dark Blue: `#001E60`
- Mid Blue: `#0072CE`
- Light Blue: `#8DD0EF`
- Pale Blue: `#F0F8FD`
- Amber: `#ED8B00`
- Red: `#D32E1A`
- Green: `#00966C`
- Grey: `#7A99AC`

## Asset Classification Rules
| Section | Account Type | Default Asset Class |
|---|---|---|
| Non-registered accounts | Non-registered | Public equity |
| Registered accounts | Registered | Public equity |
| Corporations | Corporate | Private equity |
| Real estate | Personal | Real estate |
| Insurance | Personal | Insurance |
| Other/Physical assets | Personal | Physical assets |

Override: names containing "Cash", "HISA", "Tax Holding", "Savings" → Cash class.

## Flag Logic
- **Concentration:** >30% = moderate (🟡), >40% = high (🔴)
- **Tax location:** Cash/Fixed income in non-registered accounts = ⚠ flag
- **Single-entity:** Any account >40% of gross assets = 🔴 flag
