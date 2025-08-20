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

2) Local admin creds (Firestore writes from server actions)

- Preferred: Service account file (not committed) and export the path:
```
export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/service-account.json"
```
- Or use gcloud ADC: `gcloud auth application-default login`

3) OpenAI

```
export OPENAI_API_KEY=sk-...
```

4) Install + dev

```
npm install
npm run dev
```

## Project structure (high-level)

- `app/intake/Flow.tsx` – single-file renderer for steps: Reason → Areas → ...
- `app/api/model-hook/route.ts` – minimal OpenAI chat endpoint
- `infra/` – Firestore rules/indexes

## Firestore layout

`/practices/{practice_id}/{clients|intakes|provider_docs|assignments|sessions}`

## Design

- Tailwind scales, muted palette with subtle gradient glow wrappers on cards and buttons (inspired by glowing gradient technique: https://www.braydoncoyer.dev/blog/tailwind-gradients-how-to-make-a-glowing-gradient-background).

## Notes

- Autosave uses debounced server action; full AJV validation is deferred to submit.
- Reason step persists both `story.reason_choice` and `story.flow_variant`.
- Areas step persists `areas.selected`, `areas.severity`, and enqueues `queues.deepDive` for items ≥3.

## Safety

Secrets are ignored by git via `.gitignore` (e.g., `.env*`, `service-account.json`). Do not commit secrets.
