# Bring your own AI

Status: proposal, 2026-11-11. Nothing here is built yet.

## Goal

Anyone can use job cache with the AI they already have: Claude, ChatGPT/Codex, Gemini,
a local model, or whatever comes next. That includes someone on a phone with only a chat
app, not just someone in a terminal with Claude Code. The easiest path should need no API
key and no setup beyond what they already pay for.

## What the AI actually does here

Only three jobs need an AI. Everything else (harvesting, ranking, the learned "For you"
model, the tracker) is plain code and already works without one.

| Job | Today's command | Input | Output |
|---|---|---|---|
| **Onboard** | `/onboard` | CV + onboarding form + `preferences.example.md` | `preferences.md` (voice rules + reference letter) |
| **Apply** | `/apply` | queued jobs + CV + preferences | per company: `cover-letter.md`, optional `cv.md`; per job: `<job_id>.md` (fit summary, short "why apply", match analysis, apply link) |
| **Answer** | `/answer` | form question + CV + preferences + @-referenced jobs | one answer |

"Does my CV fit this job?" is the **fit summary** and **match analysis** sections of the
Apply output.

## How it works today, and what ties it to Claude

The app and the AI already talk through files, which is the right foundation:
the app writes `queue/pending/<id>.json` (job + CV + preferences + instructions), the AI
writes `applications/<slug>/*.md`, and the app picks those up. The coupling is in the
details:

1. **The workflow lives in `.claude/commands/*.md`**, which only Claude Code reads. A short
   copy also sits in `queue_io.py` (`INSTRUCTIONS`, `QUESTION_INSTRUCTIONS`). The two copies
   already drift apart.
2. **The prompts hardcode one user**: "Sami's voice", "Sami is Tunisian, needs
   sponsorship". Another user's cover letters would be written as Sami.
3. **The output is loosely structured Markdown**, parsed by heading text
   (`queue_io._split_sections`). An agent with file access can follow that. A chat app
   can't write files into the repo at all.
4. **The UI says "Claude" everywhere**: "Queue for Claude", "run `/apply` in Claude Code",
   about 20 places in `frontend/app.js`.
5. **Everything assumes a terminal on the same laptop.** There's no path for a phone.

## Subscriptions vs API keys

These are different things, and the design has to serve both:

- **A subscription** (Claude Pro/Max, ChatGPT Plus/Pro, Gemini, ...) usually gives you an
  app, a website and often a coding agent CLI, **but not an API key**. These users need
  routes through a chat app or an agent.
- **An API key** (or a local model server like Ollama or LM Studio) lets the app call the
  model itself, with one click and no copy-paste.

## The core idea: one task contract, many engines

Separate **what** the AI is asked to do from **how** it gets asked.

```
                ┌──────────────── engines (pick any) ────────────────┐
  app builds    │ 1. agent CLI reads queue/  (Claude Code, Codex,    │   app validates
  a TASK   ───► │    Gemini CLI, Cursor, Aider, ...)                 │ ─► a RESULT and
  (JSON)        │ 2. chat app: download/copy task, paste result back │   writes the
                │ 3. API key / local model: app calls it directly    │   materials
                │ 4. MCP: chat or agent app pulls tasks as tools      │
                └─────────────────────────────────────────────────────┘
```

Every engine sees the same task and must return the same result. The app doesn't care
which one ran.

### The task (app → AI)

One self-describing JSON file. It carries everything, so it works pasted into any chat
with no other context:

```json
{
  "job_cache_task": 1,
  "kind": "apply",
  "task_id": "t_8f3a2c",
  "created_at": "2026-11-11T10:00:00+00:00",
  "owner_name": "Alex Doe",
  "instructions": "…the full Apply prompt, rendered for this user…",
  "reply_format": "Reply with ONE ```json code block matching result_schema, nothing else.",
  "result_schema": { "…": "JSON Schema for the result below" },
  "cv_markdown": "…",
  "preferences_markdown": "…",
  "jobs": [
    { "job_id": "0004f5b09e910089", "company": "Wise", "company_slug": "wise",
      "title": "ML Engineer", "city": "london", "apply_url": "https://…",
      "description": "…", "sponsorship": "silent" }
  ]
}
```

A task can hold several jobs. Grouping by company keeps today's behaviour of writing one
cover letter per company and reusing it across that company's roles.

### The result (AI → app)

Structured JSON instead of Markdown headings, because chat apps can reliably produce one
code block and the app can validate it:

```json
{
  "job_cache_result": 1,
  "kind": "apply",
  "task_id": "t_8f3a2c",
  "companies": [
    {
      "company_slug": "wise",
      "cover_letter": "…",
      "cv_variant": null,
      "jobs": [
        { "job_id": "0004f5b09e910089",
          "fit_summary": "…", "short_form": "…",
          "match_analysis": { "strengths": ["…"], "gaps": ["…"], "cv_note": "Using base CV" } }
      ]
    }
  ]
}
```

- `kind: "answer"` returns `{ "question_id", "answer" }`.
- `kind: "onboard"` returns `{ "preferences_markdown" }`.

A new `POST /api/results` endpoint validates the result, checks every `job_id` against
the task and `queue_io.is_safe_id`, and then writes the **same** `applications/<slug>/`
files as today. Everything downstream (dashboard, Apply workspace, copy buttons, Q&A)
keeps working unchanged.

To be forgiving with what chat apps return, the importer accepts a pasted reply with text
around the code block, a raw `.json` file, or (as a fallback) Markdown in today's heading
format.

### One source for the prompts

Move the three workflows into `prompts/apply.md`, `prompts/answer.md` and
`prompts/onboard.md`, with placeholders like `{{owner_name}}`. Everything renders from
them: the task file, API calls, the MCP tools, `AGENTS.md`'s queue instructions, and the
Claude slash commands, which shrink to "follow `prompts/apply.md`". Then fixing a prompt
fixes it everywhere. The hardcoded personal facts go away: nationality, visa and
experience come from the user's CV and `preferences.md`, never from the prompt.

## The four engines

### 1. Agent CLIs: Claude Code, Codex, Gemini CLI, Cursor, Aider, ...

**For:** people with a subscription and a laptop. **Key:** none. **Effort:** low.

This is today's flow, opened up to every agent. Add a "Processing the queue" section to
`AGENTS.md` that points at `prompts/*.md` and the `queue/` folders. Codex and most other
agents read `AGENTS.md`; Claude Code reads it through `CLAUDE.md`; Gemini CLI can be told to
read it in its settings. Keep the Claude slash commands as shortcuts. The dashboard shows
the right one-liner for the engine the user picked ("run `/apply`" vs "ask Codex: *process
the job cache queue*").

### 2. Chat round-trip: any chat app, desktop or phone

**For:** everyone, including people on a phone with only the Claude, ChatGPT or Gemini
app. **Key:** none. **Effort:** medium. This is the most universal option.

On a queued job (or a selection), the Queue page offers:

1. **Copy prompt**: the whole task as one block of text. Pasting is the most reliable
   thing on a phone.
2. **Download task file**: the same thing as `job-cache-task-wise.json`, to attach in a
   chat app.
3. The user sends it to their AI and gets back one JSON block.
4. **Paste result** (a text box) or **Upload result** (a `.json` file). The app validates
   it, shows what it understood ("Wise: cover letter + 2 job notes"), and saves it.

The same works for form questions in the Q&A panel and for onboarding.

**The phone needs to reach the app.** Today it only runs on the laptop, and `serve.py`
listens on every network interface with no login. That's an open door on public Wi-Fi,
and not a deliberate phone feature. Proposal:

- Default: listen on this machine only (`127.0.0.1` / `::1`).
- An opt-in **Phone access** switch in settings listens on the local network and shows a
  QR code with a one-time pairing link (`http://192.168.x.x:8000/?pair=…`). The phone gets
  a token cookie, and every request without it is refused.
- Works while the laptop is on and both devices share a network. Reaching it from
  anywhere would need hosting or a tunnel, which is a separate decision.

### 3. API key or local model

**For:** people with an API key, or a model running locally. **Key:** theirs, stored
locally. **Effort:** medium.

A **Generate** button runs the task in the backend and saves the result directly, with no
copy-paste. Two adapters cover nearly everything:

- **OpenAI-compatible chat completions** (`base_url` + `model` + key). Presets: OpenAI,
  Google Gemini (OpenAI-compatible endpoint), OpenRouter, Groq, Mistral, and local
  servers: Ollama (`http://localhost:11434/v1`), LM Studio (`http://localhost:1234/v1`),
  llama.cpp, vLLM.
- **Anthropic Messages API** for Claude keys.

Both use `urllib` from the standard library, with no vendor SDKs to install, which keeps
it working on every OS. Settings live in `data/ai.json` (gitignored). The key is never
included in Export, never logged, never sent anywhere but the chosen provider. Small
local models are worse at strict JSON, so the adapter retries once with the validation
error shown to the model.

### 4. MCP server

**For:** people whose chat or agent app supports MCP (Claude Desktop, Claude Code, Cursor
and others; support varies by app). **Key:** none. **Effort:** medium to high.

A small stdio MCP server (`backend/mcp_server.py`) exposes the queue as tools:

- `list_tasks()`: queued jobs and questions waiting for an AI.
- `get_task(task_id)`: the full task (same JSON as above).
- `submit_result(result)`: the same validation and save as `POST /api/results`.
- Optionally `search_jobs(query)`, so a chat can browse ranked jobs too.

The user then says "write my cover letters" in their desktop chat app, with no terminal
and no files. A local MCP server doesn't help on a phone. Phone apps that support MCP need
a remote server reachable over HTTPS, which comes back to the hosting question.

## Which engine for whom

| User has | Easiest path |
|---|---|
| A phone and any chat app | 2. Chat round-trip (+ Phone access) |
| A subscription and a laptop | 1. Agent CLI, or 2 |
| An MCP-capable desktop app | 4. MCP |
| An API key | 3. Generate button |
| A local model (Ollama, LM Studio) | 3. Generate button |

## Plan

1. **Foundation.** `prompts/` as the one source; remove every hardcoded "Sami"; define
   the task and result schemas with a validator; `POST /api/results`; an **AI engine**
   picker in settings; rename "Queue for Claude" to "Queue" and make every instruction in
   the UI follow the chosen engine. On its own this already makes Codex, Gemini CLI and
   other agents work (engine 1).
2. **Chat round-trip.** Copy prompt / Download task / Paste or upload result, for Apply,
   Answer and Onboard. Then **Phone access** (local-only by default, opt-in network mode
   with QR pairing).
3. **API keys and local models.** OpenAI-compatible and Anthropic adapters, Generate
   button, key handling.
4. **MCP server.**

Each step ships on its own and keeps the Claude Code flow working throughout.

## Open decisions

- **Phone access.** Is "same Wi-Fi, laptop on, QR pairing" enough, or do you want the app
  reachable from anywhere (hosting or a tunnel)? That changes security and cost a lot.
- **Task size.** One task per company (matches the shared cover letter) or one per
  selection of jobs (fewer round trips, but a longer paste)?
- **Markdown fallback.** Keep accepting today's Markdown note format from agents, or move
  everything to the JSON result?
- **README promise.** "No API keys, no paid services" stays true for the default path. API
  keys become an optional extra; the docs need to say so clearly.
