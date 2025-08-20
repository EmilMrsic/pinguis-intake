1. Patient-facing (Web/Mobile Intake)

These are for clients filling out the intake, either with form or conversation.

Welcome / Start Intake

Confirm demographics (minimal PHI).

Consent/terms modal.

“Start Intake” button.

Written Intake Runner

Adaptive form (React Hook Form, autosave).

Branching questions (see Chapter map).

Progress bar + “Save ✓” micro-toasts.

Auto-summary step before submit.

Conversational Panel

Toggle: “Talk it through instead.”

Text chat stream (OpenAI Responses API tool-calling).

Voice chat stream (OpenAI Realtime WebRTC).

Live mirroring (sliders update when patient speaks numbers).

Red-flag items handled with safe fallback copy.

Intake Complete

Thank-you confirmation.

Reassurance about data being sent securely.

Optional: “You’ll discuss these results with your provider.”

2. Provider/Admin Dashboard

These are for clinicians/admins managing clients and intakes.

Client List / Search

List of clients with status labels (draft, interviewing, ready_for_map, post_map_draft, final).

Filters by status, date.

Client Detail

Snapshot of demographics.

Links to intakes, provider docs, assignments, sessions.

Intake Review

Read-only view of submitted intake JSON.

Flags: incomplete, red-flags, inconsistent answers.

Provider Doc Editor

Editable “living document.”

Tabs or collapsibles for:

Summary (AI draft + clinician notes).

Symptom Tracker (candidates → promote to selected).

Gap Questions (CRUD; answer/dismiss).

Post-Map findings (later stage).

Status controls (draft → interviewing → ready_for_map → final).

Gap Interview Screen

Real-time checklist of gap questions.

Inline answer capture.

Tracker promotion buttons.

Advance workflow → “Ready for Mapping.”

Assignment Builder

Form for creating mapping protocol (assignment.schema.json).

Validate before save.

Create assignment record.

Bundle Export

Generate signed bundle.

Show QR code + “Download JSON.”

Confirm signature verification step.

Post-Map Review

Link to synced session.summary.json.

Findings textarea + linked sessions list.

Advance to “post_map_draft.”

Finalize & PDF

Finalize Provider Doc → write immutable version.

Export PDF button (only enabled when status:"final").

3. System/Support Screens

Login & Auth

Provider login (tenant-scoped).

Patient intake auth (ephemeral link/token).

Red-flag Alerts (Provider view)

Notifications/log of flagged risk items.

Integration point for clinic protocols.

Audit Log (Admin only)

Stream of tool calls / edits with timestamps.

Trace changes for compliance.

✅ With these screens, the workflow is clear for all actors:

Patients: Welcome → Intake (form/voice) → Confirmation.

Providers/Admins: Dashboard → Provider Doc Editor → Gap Interview → Assignment/Bundle → Post-Map → Finalize/PDF.

System: Red-flag handling + audit trails.

-----

0) Green‑Light Checklist (all ✅ = start coding)

✅ Contracts installed/validated: @pinguis/contracts, ajv, ajv-formats (CI guardrail passes on fixtures).

✅ ID/time discipline: ULIDs (26, lowercase), UTC ...Z everywhere.

✅ Band/signal policy invariants: locked bands, sigpol_id, norms_version required on assignments.

✅ PHI stance: only minimal demographics in Firestore; sensitive data local or field‑level encrypted.

✅ Workflow statuses are labels only (do not block actions programmatically—use for UX).

✅ Milestone acceptance criteria (below) pinned in the repo README.

If any are false, fix first. Everything below assumes this baseline.

1) Architecture Snapshot

Backend

Node (Next.js API routes or Express).

Firestore (Native mode).

AJV for schema validation (@pinguis/contracts).

Ed25519 signing with keypair in Secret Manager (kid + private key).

AI layer: OpenAI Responses API (tool calling) + Realtime API (WebRTC voice).

Frontend

Admin web app: Intake Runner + Provider Doc editor + Assignment/Bundle screens.

Conversational panel (text + voice) that writes to the same intake/provider doc as the form.

Autosave, optimistic updates; schema error surfacing.

Desktop (External)

Separate mapping app imports signed Assignment Bundle via QR/file and later syncs session.summary.json.

2) Data Model (top‑level collections)

Use the shared schemas from @pinguis/contracts except Provider Doc, which is app‑internal.

/clients/{client_id}                        # client.schema.json (minimal PHI)
/intakes/{intake_id}                        # intake.schema.json
/provider_docs/{doc_id}                     # internal JSON (schema draft below)
/assignments/{assignment_id}                # assignment.schema.json
/bundles/{bundle_id}                        # bundle.assignment_v1.schema.json (signed)
/sessions_summaries/{session_id}            # session.summary.schema.json (ingested later)
/provider_docs/versions/{doc_version_id}    # frozen, write-once snapshots


Join keys

client_id on everything; intake_id in provider_doc; assignment_id in bundle; session_id in summaries.

3) Provider Doc (internal JSON) — schema draft

Editable “living record” for clinicians. Keep strict in UI; no need to publish as a formal JSON Schema.

type ProviderDoc = {
  doc_id: string;               // ulid
  client_id: string;            // ulid
  intake_id: string;            // ulid
  status: "draft" | "interviewing" | "ready_for_map" | "post_map_draft" | "final";
  created_at: string;           // UTC
  updated_at: string;           // UTC
  sections: {
    summary: {
      ai_draft?: string;        // generated text
      clinician_notes?: string; // free text (consider field-level encryption)
    };
    symptom_tracker: {
      candidates: Array<{ key: string; topic: string; score: number }>;
      selected: Array<{ key: string; topic: string; baseline?: number }>;
    };
    gap_questions: Array<{
      id: string;               // ulid
      type: "confirm" | "clarify" | "risk" | "reconcile";
      prompt: string;
      status: "open" | "answered" | "dismissed";
      answer?: string;
      created_at: string;       // UTC
      updated_at?: string;      // UTC
    }>;
    post_map?: {
      notes?: string;
      session_links?: Array<{ session_id: string; title?: string }>;
      findings?: string;        // clinician summary after mapping
    };
  };
  metadata?: {
    authored_by?: string;       // provider_id
    last_edited_by?: string;    // provider_id
    version?: number;
  };
};

4) API Surface (minimal, concrete)

All writes validate against @pinguis/contracts prior to persistence.

POST   /api/clients                         -> { client }                    # validate client.schema.json
POST   /api/intakes/start                   -> { client_id }                 # returns { intake_id }
PUT    /api/intakes/{intake_id}             -> { intake }                    # validate intake.schema.json

POST   /api/provider-docs/from-intake       -> { intake_id }                 # creates ProviderDoc draft
PATCH  /api/provider-docs/{doc_id}          -> partial update (clinician edits)

POST   /api/gap-interview/{doc_id}/start    -> marks status:"interviewing"
POST   /api/gap-interview/{doc_id}/answer   -> write answers + promote tracker items

POST   /api/provider-docs/{doc_id}/ready    -> marks status:"ready_for_map"

POST   /api/assignments                     -> { assignment }                # validate assignment.schema.json
POST   /api/bundles                         -> { assignment_id }             # build & sign bundle; validate bundle schema
GET    /api/bundles/{bundle_id}/qr          -> PNG/SVG QR

POST   /api/provider-docs/{doc_id}/post-map -> link session.summary + notes; status:"post_map_draft"
POST   /api/provider-docs/{doc_id}/finalize -> snapshot to /versions; status:"final"

GET    /api/provider-docs/{doc_id}/pdf      -> only enabled when status:"final"

5) Signing & Validation (Assignment Bundle)

Keys: Ed25519 keypair in Secret Manager. Maintain kid and rotate; store kid in bundle metadata.

Canonicalization: Deterministic JSON (e.g., JCS) prior to signing.

Signature: Ed25519.sign(canonical_json_bytes) → base64 (padded; ~88 chars).

Order of ops: Build bundle → validate via bundle.assignment_v1.schema.json → canonicalize → sign → attach { kid, sig }.

Desktop: Verify signature; validate schema; fast‑fail either.

6) Security & Rules (quick pass)

Tenancy: Providers read/write only within their tenant.

Clients: No cross‑client reads.

Bundles: Download via signed URLs (short expiry) or authenticated API returning QR/file.

PHI: Minimal demographics in /clients; do not mirror sensitive free‑text elsewhere.

Field‑level encryption: Consider encrypting sections.summary.clinician_notes.

Statuses are labels: UI affordances only; backend doesn’t gate except finalization/PDF.

7) UI Slices (by milestone)
Milestone 0 — Intake flow → Draft Provider Doc

Intake Runner: adaptive, autosave, branching → emits intake.json (schema‑valid).

Doc Composer (server): builds ProviderDoc with:

sections.summary.ai_draft (optional),

sections.symptom_tracker.candidates (from deep‑dives),

sections.gap_questions (from gap rules).

Admin Dashboard: list clients; open draft ProviderDoc:

Inline editable Summary, Gap list (CRUD), Tracker (promote candidate → selected).

DoD

Valid client.json + intake.json persisted.

New editable ProviderDoc appears in Admin.

No PDF yet.

Milestone 1 — Gap Interview workflow

Start Interview: status "interviewing".

Live editing: answer gap items (open/answered/dismissed).

Tracker: promote candidates → selected.

Advance: "Ready for Mapping" → status "ready_for_map".

DoD

Clinician conducts the interview, persists edits, advances status.

Milestone 2 — Assignment + Signed Bundle

Assignment Builder: enforce ULIDs, protocol, sigpol_id, norms_version, status:"assigned", UTC timestamps.

Bundle Creator: consolidate minimal client + assignment + policy refs; validate; sign (Ed25519).

Export: QR + .json download.

DoD

Assignment validates; Bundle validates & verifies; Desktop imports via QR/file.

Milestone 3 — Post‑Map + Final PDF

On sync: Valid session.summary.json → Review Post‑Map callout.

Clinician: add findings/links → status "post_map_draft".

Finalize: snapshot /provider_docs/versions/{doc_version_id} (immutable) → status "final".

PDF: enabled only for finalized version.

DoD

Frozen, versioned Provider Doc renders to PDF only when final.

8) Intake Content & Branching (canonical)

Superset question bank + rules to drive Intake Runner and Composer.

Chapter Map

CH1 – Your Story: Reason (Problem vs Peak), Areas of Concern (1–5), Open comment.

CH2 – Deep Dives (0–10): show per topic when AC severity ≥3 and Reason = Problem.

CH3 – Daily Habits & Health: Meds/Supps, Complicating factors, Short Sleep.

CH4 – Standardized Check‑in: CEC (0–3), Metabolic (short), ISI (18+).

CH5 – Wrap‑Up: auto summary confirm; free‑text adds; main goal.

Global Rules (configurable)

DEEP_DIVE_TRIGGER = ≥3 (1–5).

TRACKER_TRIGGER = ≥6 (0–10).

USE_ISI_18_PLUS = true.

REMOVE_CEC_SLEEP = true.

FLOW_VARIANT ∈ {'problem','peak'}.

Tracker & Gap Creation

Tracker candidates: deep‑dive items with score ≥ TRACKER_TRIGGER.

Gap items for Missing, Inconsistent, Risk, Meds mismatch (action‑phrased prompts).

Peak Variant

Concise: deep‑dives only when AC severity ≥3; Complicating Factors optional/collapsed; retains CEC; ISI optional.

9) Validation & Errors
import Ajv from "ajv";
import addFormats from "ajv-formats";
import {
  intakeSchema, clientSchema, assignmentSchema, bundleSchema, sessionSummarySchema
} from "@pinguis/contracts";

const ajv = addFormats(new Ajv({ allErrors: true, strict: true }));
export function assertValid(schema: object, data: unknown) {
  if (!ajv.validate(schema, data)) throw new Error(JSON.stringify(ajv.errors ?? []));
}


Pre‑write: validate → then write.

ULID helper: enforce lowercase 26‑char ULIDs.

UTC helper: only toISOString(); reject local offsets.

Error UX: map AJV path → form field; concise messages; link to offending field.

10) AI Layer — Goals & High‑Level Architecture

Goals

One brain, two faces: Same assistant powers chat and voice.

Single source of truth: Both experiences write to the same draft Intake and Provider Doc in Firestore.

Hard metrics first: Freeform talk is parsed/clamped into fixed fields, validated with AJV pre‑save.

Safe + compliant: No diagnosis or treatment recs; clear red‑flag behavior; ephemeral tokens; PHI remains your side.

High‑level

Client (web/mobile)
 ├─ Written Intake (React Hook Form + autosave)
 └─ Conversational Panel
     ├─ Text chat → Backend → OpenAI Responses API (tool-calls)
     └─ Voice chat → Backend → OpenAI Realtime API (WebRTC)

Backend (Cloud Run/Functions)
 ├─ /api/session/start         (bootstrap)
 ├─ /api/realtime-token        (mint short-lived token)
 ├─ /api/model-hook            (tool dispatcher → validate → Firestore)
 ├─ /api/intakes/{id}/submit   (scoring, gap gen, provider doc compose)
 └─ Red-flag handler           (alerts + UX policy)

Firestore
 ├─ clients, intakes, provider_docs
 └─ live subscriptions for UI


Two entry points (same state)

Text mode — Responses API with tool calling

Model returns structured tool calls like save_metric, save_note, save_gap_item.

Backend validates (AJV + contracts) and writes to Firestore.

Form + chat subscribe to changes; real‑time mirroring.

Voice mode — Realtime API (WebRTC)

Low‑latency speech‑in/out with VAD and barge‑in.

On join, send compact context: current section, remaining fields, tiny summary.

When saving, session triggers the same tools → /api/model-hook processes them identically.

Tool schemas (examples)

// save_metric
{
  "type":"object",
  "properties":{
    "field":{"type":"string"},   // e.g. "sleep.latency_minutes"
    "scale":{"type":"string"},   // "0-10" | "1-5" | "minutes"
    "value":{"type":"number"},
    "notes":{"type":"string"}
  },
  "required":["field","value","scale"]
}

// save_gap_item
{
  "type":"object",
  "properties":{
    "doc_id":{"type":"string"},
    "prompt":{"type":"string"},
    "type":{"type":"string","enum":["confirm","clarify","risk","reconcile"]}
  },
  "required":["doc_id","prompt","type"]
}


Backend flow

Model emits tool_call with JSON args → /api/model-hook.

Server parses → clamps → AJV validates against the relevant schema/fragment → writes small patches to Firestore.

UI updates live via subscriptions.

Session steps (voice)

Client fetches /api/realtime-token (short‑lived).

Open WebRTC to Realtime; server streams a compact system context + tool specs.

User speaks (“about 45 minutes”); assistant rounds/clamps → save_metric.

Save → toast “Saved ✓” → assistant continues.

11) Developer Notes & Guardrails (AI behavior)

Core behavior

Never diagnose or recommend treatment.

Ask briefly; require numeric ratings on specified scales.

Only record data via tool calls (schemas above).

If user says “seven or eight,” pick the nearest single number, then save_metric.

If user declines, emit ask_clarifier (short nudge) and pause until UI shows a slider.

Turn discipline

Keep turns ≤ 2 sentences. Be plain and empathetic.

For sensitive topics, switch from voice to text with predefined copy.

Context payload (keep lean)

summary_bullets (1–3 per section)

remaining_required_fields (IDs + scale)

last_3_turns (for cohesion)

Never send the entire intake each turn.

Red‑flag policy

Certain items are never read aloud; use text mode.

Call flag_risk tool → backend logs, adds Provider Doc gap item, triggers clinic notifications.

12) UX Patterns (to feel “normal”)

One toggle: “Talk it through instead” opens voice/chat panel.

Live mirroring: Talking updates the corresponding slider/field; micro‑toast confirms save.

Interruption: Barge‑in supported; assistant yields gracefully.

Mode handoff: Voice can hand back to form for sensitive bits.

Unified progress: Conversational panel shows same section progress as form.

13) Validation & Persistence (contracts‑compliant)

Before save: Tool payload → parse/coerce → clamp numerics → AJV validate (schema fragment) → write.

After submit: Run thresholds, build tracker candidates, generate gap items, compose Provider Doc.

Race safety: Patch per‑field; use Firestore transactions for multi‑field invariants (e.g., promoting trackers).

API endpoints (AI‑related)

POST /api/session/start           -> { intake_id, client_id, doc_id }
POST /api/realtime-token          -> { token, iceServers?, rtcUrl? }
POST /api/model-hook              -> tool dispatcher: {"tool":"save_metric","args":{...}}
POST /api/intakes/{id}/submit     -> scoring + provider_doc compose


Example voice turn → save

{ "tool":"save_metric",
  "args": {
    "field":"sleep.latency_minutes",
    "scale":"minutes",
    "value":45,
    "notes":"self-reported"
  }
}

14) Security & Privacy (AI layer)

Ephemeral tokens: Realtime tokens 60–120s; minted server‑side per session.

PHI boundary: Intake state lives in Firestore; AI context is minimal, field‑ID based, sanitized.

Audio: No raw audio storage unless explicitly opted in; transients only.

RBAC: Patients access only their intake_id; providers access their tenant’s Provider Docs.

Audit trail: Log tool calls (redacted), who/when, for traceability.

15) Developer Notes — Work Orders (ready for Cursor)

Use these to generate code/tests. They replace “LLM prompts” terminology.

Card A — Contracts Guardrail Module

Build lib/contracts.ts exporting assertValid, ULID/UTC helpers; unit tests against fixtures.

Card B — Firestore Repo Layer

repos/{clients,intakes,providerDocs,assignments,bundles,summaries}.ts with getById, create, update, listByClient, snapshotVersion.

Enforce validation pre‑write.

Card C — ProviderDoc Composer

composeProviderDoc({ client, intake }) → ProviderDoc.

Includes tracker candidates, gap questions (Missing/Inconsistent/Risk/Meds).

Card D — Intake Runner

React + RHF; autosave; branching per Section 8; progress; AJV‑valid payload.

Card E — Gap Interview UI

Inline gap CRUD; statuses; answer capture; promote tracker candidates; PATCH ProviderDoc.

Card F — Assignment Builder

Form → assignment.schema.json; enforce sigpol_id/norms_version.

Card G — Bundle Creator + QR

Build → validate → canonicalize → sign (Ed25519) → store/serve QR & JSON; include {kid,sig,created_at,expires_at}.

Card H — Post‑Map Review

Render linked session.summary; capture findings; set "post_map_draft".

Card I — Finalize + Version + PDF

Finalize to immutable /provider_docs/versions/*; enable PDF endpoint only for status:"final".

Card J — AI Tool Dispatcher

/api/model-hook: schema for save_metric, save_note, save_gap_item, flag_risk; coercion/clamping; Firestore writes; SSE/broadcast.

Card K — Realtime Token & Client Plumb

/api/realtime-token (short‑lived JWT or server‑generated token); WebRTC wiring; small context composer.

Card L — Developer Guardrails (AI)

System behavior config (turn length, scales, red‑flag list, forbidden content); few “good/bad” examples to unit‑test tool emissions.

16) PDF Export Rules

Allowed only when ProviderDoc.status === "final".

Source: versioned snapshot in /provider_docs/versions/*.

Contents: Summary, Gap Q/A, Tracker (selected), Post‑Map findings, minimal client header, date, logo.

Exclude sensitive raw intake free‑text unless explicitly whitelisted.

17) Firestore & Access Patterns

Indexes:

provider_docs by client_id, status.

assignments by client_id, created_at.

sessions_summaries by client_id, created_at.

Write‑once: /provider_docs/versions/*—rules: allow create if not exists; deny update/delete.

Bundles: small metadata doc; blob in storage behind signed URLs (or stream via API).

18) Directory Layout (suggested)
/apps/admin
  /src
    /components
    /pages
      /api/...                  # if Next.js
    /lib
      contracts.ts
      canonicalize.ts
      crypto.ts
      repos/
      composer/
      pdf/
      qr/
      ai/
        modelHook.ts
        realtimeToken.ts
        toolSchemas.ts
    /styles
    /tests
/packages/contracts             # external: @pinguis/contracts (already published)
/infra
  secret-manager.md
  firestore.rules
  firestore.indexes.json

19) Crypto & Canonicalization Notes

Deterministic JSON (e.g., JCS) or a stable key‑sorted stringifier.

Store/verifiable public keys by kid; publish read‑only index for Desktop.

Sign canonical bytes; encode signature base64 (padded).

Desktop verification order: signature → schema (or vice‑versa)—document chosen order and keep it consistent.

20) Acceptance Criteria (project)

Intake produces valid Client + Intake.

Admin shows an editable Provider Doc (no PDF yet).

Gap Interview updates same doc & advances status to ready_for_map.

Admin creates valid Assignment + signed Bundle (QR/file imports).

Post‑Map: clinician finalizes; a versioned Provider Doc exports to PDF.

All objects validate against @pinguis/contracts.

No PHI creep; UTC timestamps; ULIDs everywhere.

AI layer: text + voice write to the same Firestore draft; tool calls are validated pre‑save; red‑flags follow policy.

21) Appendix — Chapter Question Bank (authoritative, superset)

CH1 – Your Story: Reason (Problem/Peak); Areas of Concern (1–5): stress/anxiety, mood/depression, memory/thinking, impulsivity, sleep, learning (kids); Open comment.
CH2 – Deep Dives (0–10): per topic when AC severity ≥3 & Reason=Problem.
CH3 – Daily Habits & Health: Meds; Supps; Complicating factors; Short Sleep (bed/wake, latency, awakenings count & duration, rested 0–10; snoring, vivid dreams, restless legs, bruxism, parasomnias).
CH4 – Check‑in: CEC domains (0–3), Metabolic (short), ISI (7 items, 18+).
CH5 – Wrap‑Up: auto top concerns confirm; “Anything to add?”; “Main goal?”.

22) Rollout Plan (safe increments)

Text tool‑calling pilot (no voice).

Add Realtime voice for CH1–CH2.

Add red‑flag policies + ISI.

Add Provider Doc compose + coaching (gap generation).

Extend voice across flow; polish mirroring & handoffs.

Start with Milestone 0 and Cards A–E. Then wire Cards J–K to bring the AI layer online with the same Firestore draft as the form.