# Developing job cache

Instructions for anyone changing this repo: people, and AI coding agents (Claude Code,
Codex, Gemini CLI, Cursor, Aider, ...). `CLAUDE.md` just points here, so this file is the
one source of truth. Keep it current when a rule changes.

## The two rules that override everything

1. **Runs the same on Windows, macOS and Linux.** Every change, every setting, every
   script, every push. No exceptions. If you can't make something portable, don't ship it.
2. **Works with any AI, not just Claude.** The app must never require one particular
   assistant, subscription or API. Claude Code is *one* way to generate materials, not the
   only way. See [docs/2026-11-11-bring-your-own-ai.md](docs/2026-11-11-bring-your-own-ai.md).

Both rules are explained in detail below.

## What this is

A local job-search tool: harvest postings from free public job boards, rank them against
the user's CV, and help them apply with AI-written cover letters and form answers.

```
backend/      FastAPI app + harvester + ranker + learned model (Python, stdlib-first)
  adapters/   one module per job board / ATS
  tests/      unittest suite (no network, no real DB)
frontend/     plain HTML/CSS/JS dashboard, no build step (inlined into "/" at serve time)
queue/        file handshake: app writes tasks, the AI writes results
applications/ generated materials, one folder per company
.claude/      Claude Code slash commands (/apply, /answer, /onboard, /setup)
docs/         design docs, dated YYYY-MM-DD-<topic>.md
```

## Run and test

```bash
./run.sh                                         # install if needed, harvest once, serve :8000
python -m unittest discover -s backend/tests     # from the repo root, inside .venv
```

Use `python`, not `python3`, inside the venv. On Windows the venv lives in
`.venv\Scripts\`, on macOS/Linux in `.venv/bin/`, and that's the only difference.

A `.venv` is tied to the OS that created it. A venv copied from another machine (for
example one with `Scripts/` on Linux) won't work: delete it and run `./install.sh`.

Every change ships with tests, and the full suite passes before you push. Tests never
touch the network or the real `data/jobs.db`: mock `http_util.get_json` / `post_json`
and use a temp DB (see `backend/tests/test_store.py`, `test_import.py`).

## Rule 1: cross-platform, always

### Files and paths
- Build every path with `os.path.join` (or `pathlib`) from `ROOT`. Never concatenate with
  `"/"` or `"\\"`, and never assume the current directory: scripts `cd` to the repo root.
- Open every text file with `encoding="utf-8"` explicitly. The default is the system
  locale (cp1252 on many Windows machines) and corrupts names, accents and emoji.
- When writing a CSV, pass `newline=""` to `open()`, or Windows gets blank rows.
- File names can't contain `< > : " / \ | ? *` on Windows and are case-insensitive on
  Windows and macOS. Anything that becomes a file name (job ids, company slugs) goes
  through `normalize.slugify` or `queue_io.is_safe_id`.
- Don't rely on symlinks, file permissions, or executable bits for behaviour.
- Close files before renaming or deleting them, because Windows locks open files. Use `with`.

### Line endings
- The repo stores **LF** only; `.gitattributes` enforces it. Don't commit CRLF.
- If `git status` shows dozens of files changed but `git diff --ignore-cr-at-eol` is
  empty, it's line-ending noise from an editor or a copy from Windows. Don't commit it.
- Windows editors: set "LF" for this repo (VS Code: `"files.eol": "\n"`).

### Scripts and launching
- Put real logic in **Python**, not shell. Shell (`.sh`) and batch/PowerShell
  (`.bat`/`.ps1`) launchers stay thin wrappers that only find Python and call it, so the
  behaviour is identical everywhere. When a launcher needs to do more, add it to a Python
  entry point.
- Any new launcher needs a Windows twin. Today only `run.sh` and `install.sh` exist, which
  means Windows needs Git Bash or WSL. That's a known gap, so don't add more bash-only scripts.
- Open URLs with Python's `webbrowser` module, not `open`, `xdg-open` or `start`.
- Find Python as `python`, then `python3`, then `py -3` (the Windows launcher). Never hardcode one.
- Call subprocesses with an argument list (`["git", "rev-parse", "HEAD"]`), never a shell
  string, and no `shell=True`. Treat a missing tool (git, a browser) as a soft failure,
  the way `_git()` in `app.py` does.
- Read configuration from environment variables with defaults (`PORT`). Don't use
  bash-only syntax in docs for setting them without showing the Windows form too
  (`$env:PORT=8080` in PowerShell, `set PORT=8080` in cmd).

### Dependencies
- Stdlib first. Every package in `requirements.txt` must ship wheels for Windows, macOS
  (Intel + Apple Silicon) and Linux, and need no compiler.
- Minimum Python is **3.9**. Don't use newer syntax (`match`, `X | Y` type unions at
  runtime, `except*`) unless that minimum is raised on purpose.
- Pin exact versions in `requirements.txt`.

### Network and the browser
- Bind the server for the person on this machine. Exposing it to the local network (for a
  phone) must be an explicit opt-in that requires a token, never the default. `serve.py`
  currently binds `::` (all interfaces), which is a known gap to close.
- Time is UTC in storage (`...+00:00`), local only when displayed. Store dates through
  `normalize.normalize_posted_at`, never raw.
- The frontend must work in current Chrome, Edge, Firefox and Safari, including Safari on
  iOS and Chrome on Android, at phone width. No browser-only APIs without a fallback.

### Before every push
- [ ] Tests pass: `python -m unittest discover -s backend/tests`.
- [ ] No new path built with `/` or `\`, no `open()` without `encoding=`, no `shell=True`.
- [ ] No new bash-only behaviour, or it has a Windows twin.
- [ ] `git diff --ignore-cr-at-eol --stat` matches `git diff --stat` (no line-ending noise).
- [ ] No personal data staged (see below).

## Rule 2: any AI, not just Claude

The AI's jobs here are writing a user's `preferences.md` (onboarding), cover letters and
fit notes (apply), and form answers (answer). Ranking and the learned model are not AI and
need no provider.

- **The task contract is the interface, not the assistant.** The app writes a task (job +
  CV + preferences + instructions); something produces a result in a fixed format; the
  app reads it back. Any engine that honours the contract is supported: an agent CLI
  reading `queue/`, a chat app given a downloaded task file, an API call, an MCP client.
- **Prompts live in one place.** Don't paste instructions into new places. Today they are
  duplicated in `.claude/commands/*.md` and `queue_io.py`; new work moves them into one
  shared source, it doesn't add a third copy.
- **No assistant-specific wording in shared text.** Instructions, UI copy and docs say
  "your AI" or name the engine the user picked, not "Claude". Claude-only features stay
  under `.claude/`.
- **No hardcoded user.** Never write the owner's name, nationality, visa status,
  experience or voice into code, prompts or defaults. Read it from `data/config.json`
  (`owner_name`), `cv/cv.md` and `preferences.md`. Some of this is still hardcoded
  ("Sami" in `queue_io.py`, `.claude/commands/*.md`, `learn.py`, `seniority.py`, `db.py`);
  fix it when you touch those files.
- **Keys are optional and local.** The no-key path (agent CLI or chat app) must always
  work. If a user adds an API key it lives in `data/` (gitignored), is never exported,
  logged or sent anywhere but the provider they chose.
- **Validate everything an AI returns** before writing it to disk: expected fields
  present, safe ids, sane lengths. A malformed result is reported to the user, never
  half-written.

## Personal data

The repo is shared; user data is not. Never commit `cv/cv.md`, `preferences.md`,
`data/`, `applications/*/`, `queue/**` contents, or anything from a real export. These are
gitignored. Fixtures in `backend/tests/fixtures/` use public job postings only. Users move
their data between machines with the app's Export/Import, not git.

## Code conventions

- Match the surrounding style: small modules, docstrings that explain *why*, type hints,
  `from __future__ import annotations`.
- New job source: one module in `backend/adapters/` exposing `fetch(company) -> List[Job]`
  plus a pure `parse(...)` that tests call with a fixture. It must page through the board
  until it has every posting, because single-company boards get their missing postings
  marked closed.
- The frontend has no build step and no framework. Escape all interpolated text with
  `esc()`.
- Commits: imperative subject saying what changed for the user, body saying why. One
  logical change per commit. Branches: `feature/...`, `fix/...`, `perf/...`.
