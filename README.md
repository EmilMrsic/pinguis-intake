# Pinguis Intake (Client)

Modern Next.js App Router intake runner with:
- Tailwind v3 + shadcn/ui
- Firebase Auth (email/password) + Firestore autosave
- OpenAI model hook for dynamic prompts
- Peak/Problem flow, Areas of Concern, debounced autosave
- Accessible UI with keyboard-first chips/pills and ARIA live status

## Quick start

1) Env (.env.local)

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=pinguis-dev.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=pinguis-dev
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=pinguis-dev.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=564479101531
NEXT_PUBLIC_FIREBASE_APP_ID=1:564479101531:web:dd7bc359eda74158a84d7e
```

2) Local admin creds (Firestore writes from API routes)

- Preferred: Application Default Credentials (ADC). Either use a service account file and export the path:
```
export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/service-account.json"
```
- Or use gcloud ADC: `gcloud auth application-default login`

3) OpenAI (optional; can be disabled)

```
export OPENAI_API_KEY=sk-...
```
To disable AI suggestions entirely in the UI, set `NEXT_PUBLIC_DISABLE_AI=1`.

4) Install + dev

```
npm install
npm run dev
```

## Project structure (high-level)

- `app/intake/Flow.tsx` – thin conductor for steps (hooks + atoms)
- `app/intake/steps/*` – step components (Reason, Contact, Areas, TopicRate, DeepDive, stubs)
- `components/intake/*` – UI atoms (Glow, GlowButton, FooterNav, TopicNoteField, StepHeader)
- `lib/intake/*` – core (topics, deep items, guidance, paths, id, helpers, hooks, intakeApi)
- `app/api/model-hook/route.ts` – minimal OpenAI chat endpoint (UI will no-op if disabled)
- `app/api/intake-load/route.ts` – loads the latest (prefer incomplete) intake by email/clientId
- `app/api/intake-save/route.ts` – idempotent intake write endpoint (full payload replace; deletions persist)
- `app/api/upload-profile/route.ts` – uploads profile photo to GCS folder
- `app/api/generate-abstract-avatar/route.ts` – creates and stores a gradient SVG avatar
- `app/api/meds-suggest/route.ts` – meds suggestions (local list + optional OpenAI expand)
- `app/api/supps-suggest/route.ts` – supplement suggestions (local list + optional OpenAI)
- `infra/` – Firestore rules/indexes

## Firestore layout

`/practices/{practice_id}/{clients|intakes|provider_docs|assignments|sessions}`

## Design

- Tailwind scales, muted palette with subtle gradient glow wrappers on cards and buttons (inspired by glowing gradient technique: https://www.braydoncoyer.dev/blog/tailwind-gradients-how-to-make-a-glowing-gradient-background).

## Notes

- Autosave uses a lightweight API route (`/api/intake-save`); full AJV validation is deferred to submit.
- Reason step persists both `story.reason_choice` and `story.flow_variant`.
- Areas step persists `areas.selected`, `areas.severity`, and enqueues `queues.deepDive` for items ≥3.
- Contact step persists `profile.{first_name,last_name,email,phone,birthdate,photo_url}` and generates a stable human-ish `intakeId` if missing (initials + 6 digits).
- Topic notes use a debounced background save (~1s idle), save on blur, and commit on Next. Typing is fully local to preserve focus; latest text is always persisted on Next.
- Deep-dive sliders glide smoothly (0.1 UI step) and persist rounded 0–10 on release. If value > 6, an optional "why" input appears and saves on blur/Enter. Existing text auto-focuses with caret at end.
- Topic notes textarea auto-resizes to fit content; caret moves to end if text exists.
- Contact: overlapping top-right avatar with Upload/Generate; seeds from auth photo; autosaves.
- Daily: meds/supps multi-select chips with dropdown suggestions; saves immediately; Complicating factors store only selected entries (unchecked deletes key). "Continue" jumps to last relevant saved step.

## Recent updates

- Sleep Short: numeric steppers for minutes/counts, derived TST/efficiency (hidden), and SDS gating for ISI.
- ISI: optional for 18+, one-question-per-screen, alternating backgrounds, icon back arrow, auto-advance.
- CEC: icon-only back arrow; removed sub-question counter.
- Metabolic caffeine: simplified to single-select + context; clears old AI fields.
- Friendly footer copy and improved resume behavior.

## Release notes (2025-xx-xx)

- Simplified TopicRate UX: one-line guidance + ≤3 chips, compact textarea (auto-expands), Enter-to-advance.
- Fixed input focus issues by moving note state local and debouncing autosave.
- Implemented DeepDive with smooth sliders and optional per-item "why" notes.
- Added modular structure: hooks, steps, and UI atoms; Flow is now a thin conductor.

## Safety

Secrets are ignored by git via `.gitignore` (e.g., `.env*`, `service-account.json`). Do not commit secrets.

## Git workflow

```
git checkout -b feat/intake-smoothing
git add -A
git commit -m "Intake: smooth typing; background saves; stable intakeId; AI guard"
git push origin feat/intake-smoothing
```

Then open a PR to `main`.
