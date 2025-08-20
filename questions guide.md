0) Core principles (apply everywhere)

Autosave on every field blur/change (300–500 ms debounce), visible “Saved ✓”.

Chunking: max 3–7 items per screen; progress bar + section dots.

Branching: deep‑dives only for topics rated ≥3 (configurable), tracker candidates for items ≥6.

Clarity: one‑line “why we ask” text at top of each section.

Language style: plain, brief, human; never diagnostic; no medical advice.

Accessibility: keyboard focus order, ARIA for progress, high contrast.

1) State machine (authoritative)
CONSENT → REASON → SCREEN (Areas of Concern)
→ (DeepDiveQueue?) DEEP_DIVE (per topic) → DAILY (Meds, Supps, Factors)
→ SLEEP_SHORT → CEC (9 domains; sleep removed) → METABOLIC → (if 18+) ISI
→ REVIEW → SUBMIT
→ SERVER_POST: thresholds + tracker candidates + gap detection + provider_doc compose
→ DONE (Provider sees Provider Doc)

2) Screens, exact questions, and branching
A. Consent (CONSENT)

Copy: “Before we start, please review and accept the consent.”
Controls: Checkbox + e‑sign/initials, Continue.

B. Reason for visit (REASON)

Q1. “What brings you here today?”

☐ Addressing a specific problem → FLOW_VARIANT="problem"

☐ Peak performance / optimization → FLOW_VARIANT="peak"

C. Areas of Concern screen (SCREEN)

Lead sentence: “Pick what you’d like to focus on (you can choose more than one). Then give each a quick 1–5.”

Topics (each shows a 1–5 pill scale once selected):

Stress & anxiety (anx)

Mood & depression (dep)

Memory & thinking (mem)

Impulsivity (imp)

Sleep issues (sleep)

Learning issues (kids) (learn)

Branching rule (global): if selected and severity ≥3, enqueue deep dive for that topic.

Q2 (optional free‑text): “Anything you want us to know before we zoom in?”

D. Deep‑dives (DEEP_DIVE)

Shown only for topics with severity ≥3. Each item is 0–10 (slider + numeric input). Any item ≥6 → tracker candidate.

D1. Stress & Anxiety

Items: palpitations, sweating, trembling, constant_worry, on_edge, panic_waves.
(These align with the CEC Stress/Anxiety domain phrasing such as “I experience sudden waves of panic” and “I feel on edge or restless most of the time”.)

D2. Mood & Depression

Items: persistent_sadness, loss_of_interest, emotional_swings, hopelessness, irritability, low_energy.
(CEC anchors include sadness/hopelessness, low motivation, fast mood swings.)

D3. Memory & Thinking

Items: forget_appointments, recall_conversations, directions, follow_instructions, misplacing_items, task_concentration.
(CEC memory items include forgetting appointments, recalling details, misplacing items.)

D4. Impulsivity

Items: speak_without_thinking, interrupting, acting_on_impulse, resist_urges, waiting_turn, task_switching.
(CEC impulsivity/self‑control items include speaking without thinking, interrupting, resisting urges.)

D5. Sleep Issues (symptom intensity)

Items: sleep_onset, night_wakings, early_wakening, unrefreshed, nightmares_vivid, daytime_sleepy.

D6. Learning Issues (kids)

Items: follow_instructions, stay_on_task, reading_comprehension, math_difficulty, disorganized_work, retain_new_info.
(Child CEC learning items are present in child versions.)

UI microcopy for deep‑dives:
“Rate how intense each item has been recently (0 = not at all, 10 = severe).”

E. Daily habits & health (DAILY)

Section intro: “A few quick things that help your clinician interpret results.”

Meds

Type‑ahead list; capture {name, dose, freq} with “Add another”.

Supplements

Same as Meds.

Complicating factors (checkboxes):

Head injury history

Seizure disorder

Developmental disorder (e.g., autism, ADHD)

Chronic illness

Substance use issues

Significant trauma (emotional or physical)

Current pregnancy

Other major medical

F. Short sleep questionnaire (SLEEP_SHORT)

Why: “Sleep affects how your brain functions and how we interpret your map.”

Questions:

Typical bedtime (time input)

Typical wake time (time input)

How long to fall asleep? (minutes)

How many times do you wake at night? (0–10)

How long awake when you wake? (minutes)

How rested do you feel on waking? (0–10)

Check any that apply: Snoring / Vivid dreams or nightmares / Restless legs / Teeth grinding / Sleepwalking or talking

Rule: We remove sleep items from CEC since this becomes canonical sleep data (REMOVE_CEC_SLEEP=true).

G. CEC Questionnaire (CEC)

Format: 0–3 per item (0=Never, 1=Sometimes, 2=Often, 3=Always). Chunk into 5–7 items per sub‑screen with progress.

Domains used (sleep removed):

Focus & Mental Flexibility (8 items)

Memory Function (6 items)

Impulsivity & Self‑Control (6 items)

Mood & Emotional Regulation (6 items)

Stress, Anxiety & Rumination (6 items)

Sensory Filtering & Perception (6 items)

History of Emotional/Physical Trauma (5 items)

History of Head Injury (5 items)

Substance Use & Addictions (5 items) or Learning Issues for kids

The item texts are exactly as in the adult/child files you supplied; your front‑end should load the item bank from configuration. (Examples: “I feel on edge or restless most of the time”, “I experience sudden waves of panic”, “I forget appointments unless I write them down”).

Scoring thresholds (from your doc): domains have low/moderate/high bands; keep the rubric for downstream display.

H. Metabolic (METABOLIC)

Diagnosed conditions (diabetes/thyroid/other)

Weight change in last 6 months (down / up / no change)

Diet pattern (free text or picker)

Daily caffeine (servings)

Exercise frequency (none / 1–2 / 3–4 / 5+ per week)

I. ISI (18+) (ISI)

7 standard items (0–4 each): difficulty falling asleep / staying asleep / early waking / satisfaction / interference / noticeability / worry.

J. Review & submit (REVIEW → SUBMIT)

“Top 3 concerns captured:” (auto from deep‑dived ≥6 & screening)

“Anything to add?” (final text)

Submit → loader → success screen.

Server post‑submit (authoritative):

Build Symptom‑Tracker candidates from all deep‑dive items ≥6 (+ optional sleep symptoms).

Gap detection rules (missing, inconsistent, risk, reconcile).

CEC domain scoring and sleep metrics.

Compose Provider Doc (draft) with Summary (AI optional), Tracker candidates, Gap list.

3) OpenAI integration (tone, prompts, tools)
A) Tone spec (hard requirements to keep it human + brief)

Empathetic, two short sentences max per turn.

Avoid clinical jargon; never diagnose or recommend treatment.

Always confirm numeric scales clearly.

If user gives “about 7–8,” choose a single number that best fits; log original phrasing in notes.

B) Conversation entry points

Text chat (Responses API with tool calling)

Voice (Realtime API with WebRTC; uses the same tool calls under the hood)

C) System prompt (drop‑in)
You are IntakeAssistant. You help patients complete an intake for neurofeedback.

Constraints:
- Never diagnose or recommend treatment.
- Keep responses ≤ 2 sentences, plain language, empathetic.
- Always request a numeric rating on the specified scale when a field requires it.
- Record data only via tool calls using the JSON schemas provided.
- If a patient gives text like “about seven or eight”, choose a single number that best fits and include their wording in notes.
- For sensitive or crisis signals (e.g., suicidal ideation), stop speaking, return a flag_risk tool call, and display the predefined safety copy.
- Ask one thing at a time. If a field is already filled, do not ask it again; move on.
- If unsure which field to ask next, call get_next_required_field.

D) Tool contracts (server‑validated with AJV)
// 1) Save metric
{
  "name": "save_metric",
  "description": "Persist a single numeric field value for the intake.",
  "schema": {
    "type":"object",
    "properties":{
      "intake_id":{"type":"string"},
      "field":{"type":"string"},    // e.g. "deepdive.anx.panic_waves"
      "scale":{"type":"string"},    // "0-10" | "1-5" | "0-3" | "minutes"
      "value":{"type":"number"},
      "notes":{"type":"string"}
    },
    "required":["intake_id","field","scale","value"]
  }
}

// 2) Save note
{
  "name": "save_note",
  "schema": {
    "type":"object",
    "properties":{
      "intake_id":{"type":"string"},
      "field":{"type":"string"},   // e.g. "free_text.story"
      "text":{"type":"string"}
    },
    "required":["intake_id","field","text"]
  }
}

// 3) Flag risk (red flag)
{
  "name": "flag_risk",
  "schema": {
    "type":"object",
    "properties":{
      "intake_id":{"type":"string"},
      "kind":{"type":"string","enum":["safety","medical","other"]},
      "note":{"type":"string"}
    },
    "required":["intake_id","kind"]
  }
}

// 4) Get next required field
{
  "name": "get_next_required_field",
  "schema": {
    "type":"object",
    "properties":{
      "intake_id":{"type":"string"}
    },
    "required":["intake_id"]
  }
}


Backend behavior:

For save_metric: coerce/clamp to scale, validate fragment against intake.schema.json, then write.

For flag_risk: store marker on intake + append a Gap item in Provider Doc + trigger clinic alert per policy.

For get_next_required_field: your server returns { field_id, prompt_text, scale } so the model never guesses.

E) Context sent to model each turn (keep it small)
{
  "intake_id": "01HZX…",
  "flow_variant": "problem",
  "summary": ["Came for anxiety and sleep", "Anxiety severity = 4", "Wakes 3x/night"],
  "remaining_fields": [
    {"field":"deepdive.anx.panic_waves","scale":"0-10","prompt":"How often do sudden waves of panic happen? (0–10)"},
    {"field":"sleep.awakenings_count","scale":"0-10","prompt":"How many times do you wake during the night?"}
  ],
  "recent_turns": [
    "User: I'm mostly anxious at work.",
    "Assistant: Thanks. On a scale of 0–10, how often do you feel on edge?",
    "User: Maybe 7."
  ]
}

4) Validation & thresholds (authoritative)

Deep‑dive trigger: severity ≥ 3 on 1–5 screen.

Tracker candidate: deep‑dive item ≥ 6 on 0–10 scale.

ISI: show only if age ≥18.

CEC: use the exact adult/child item banks you supplied; remove sleep domain when SLEEP_SHORT present.

5) Error & edge‑case handling

Parsing fail: show numeric slider immediately with helper text (“Pick the closest number”).

Abandonment: autosave ensures you can resume; show “Continue where you left off?” on return.

Low connectivity: allow offline writes (Firestore cache) and reconcile on reconnect.

Sensitive topics: switch to text UI; do not read aloud; show clinic‑approved copy; log flag_risk.

6) Content sources (item bank references)

Adult first‑person CEC item set (domains, 0–3 scale)

Adult third‑person variant (observer form) mirrors content

Child first‑person and third‑person sets incl. Learning Issues domain

Domain scoring rubrics (low/mod/high banding) for reporting

Symptom/function ↔ item anchors (for your focal‑site mapping later)

7) UI copy blocks (drop‑in)

Section headers (“why we ask”)

Areas of Concern: “This helps us aim the questions where they matter.”

Deep‑dives: “A quick zoom‑in so we can track the right things.”

Sleep: “Sleep changes how your brain functions — these help us interpret your map.”

CEC: “Short, standardized statements so we can compare and track progress.”

Buttons

Continue, Back, Save & exit, Talk it through instead

Saved toast

“Saved ✓”

Review screen

“You’re set. Your clinician will review this before your mapping session.”

8) Deliverables to build now (Cursor tasks)

JSON config for item banks:

cec.adult.json, cec.child.json (IDs, prompts, domain tags) — from the provided docs.

deepdive.topics.json with item IDs and prompts.

Form renderer with:

Branching by conditions

Autosave hooks

Progress bar

Server routes:

/session/start, /intakes/:id (PUT partial), /intakes/:id/submit

/model-hook (tool dispatcher), /realtime-token

Scoring & gap module:

Thresholds, tracker candidates, gap rules → compose Provider Doc draft.

OpenAI glue:

System prompt, tool schemas, context composer (remaining fields)

Realtime integration (voice) toggled behind a feature flag.

----

CHAPTER 1 – Your Story

Reason for Visit
	•	What brings you here today?
☐ Addressing a specific problem
☐ Peak performance / optimization

Areas of Concern (Checklist + 1–5 rating)
	•	Stress & anxiety
	•	Mood & depression
	•	Memory & thinking
	•	Impulsivity
	•	Sleep issues
	•	Learning issues (kids)
	•	(Optional extra if needed: focus/concentration, sensory sensitivity, trauma history)

Open Comment
	•	In your own words, what would you like to work on or achieve?

⸻

CHAPTER 2 – Zoom In On What Matters (Deep Dives)

(Only asked if the “area of concern” rating ≥ 3)

Stress & Anxiety Deep Dive (0–10 each)
	•	Heart palpitations
	•	Sweating
	•	Trembling or shaking
	•	Constant worry
	•	Feeling on edge or restless
	•	Sudden waves of panic

Mood & Depression Deep Dive (0–10 each)
	•	Persistent sadness or low mood
	•	Loss of interest in activities
	•	Emotional ups and downs
	•	Feeling hopeless
	•	Irritability
	•	Low energy or motivation

Memory & Thinking Deep Dive (0–10 each)
	•	Forgetting appointments or plans
	•	Trouble recalling conversations
	•	Losing track of directions
	•	Difficulty following multi-step instructions
	•	Misplacing items
	•	Trouble concentrating on tasks

Impulsivity Deep Dive (0–10 each)
	•	Speaking without thinking
	•	Interrupting others
	•	Difficulty waiting turn
	•	Acting without considering consequences
	•	Difficulty resisting urges
	•	Trouble completing tasks before starting new ones

Sleep Issues Deep Dive (0–10 each)
	•	Trouble falling asleep
	•	Waking up often at night
	•	Waking too early
	•	Feeling unrefreshed in the morning
	•	Nightmares or vivid dreams
	•	Daytime sleepiness

Learning Issues (Kids) Deep Dive (0–10 each)
	•	Trouble following instructions
	•	Difficulty staying on task
	•	Struggles with reading comprehension
	•	Trouble with math
	•	Disorganized schoolwork
	•	Difficulty remembering new information

⸻

CHAPTER 3 – Daily Habits & Health

Medications
	•	Please list all prescription medications you currently take (name, dosage, frequency).

Supplements
	•	Please list all vitamins, minerals, herbs, or other supplements you currently take.

Complicating Factors
	•	Have you experienced any of the following? (check all that apply)
☐ History of concussion/head injury
☐ Seizure disorder
☐ Developmental disorder (e.g., autism, ADHD)
☐ Chronic illness
☐ Substance use issues
☐ Significant trauma (emotional or physical)
☐ Current pregnancy
☐ Other major medical conditions

Short Sleep Questionnaire
	•	Typical bedtime
	•	Typical wake time
	•	How long does it usually take you to fall asleep? (minutes)
	•	How many times do you wake up during the night?
	•	How long do you stay awake when you wake during the night? (minutes)
	•	How rested do you feel on waking? (0–10)
	•	Do you experience:
☐ Loud snoring
☐ Vivid dreams/nightmares
☐ Restless legs
☐ Teeth grinding
☐ Sleepwalking/talking

⸻

CHAPTER 4 – Quick Standardized Check-In

CEC Questionnaire (0–3 scale)

Domain 1 – Focus & Mental Flexibility
	•	My mind frequently wanders during conversations.
	•	I lose interest quickly in tasks I find dull.
	•	I have difficulty juggling more than one task at once.
	•	I re-read simple text multiple times before it makes sense.
	•	I get stuck using the same approach even when it isn’t working.
	•	I find it hard to switch gears between different topics.
	•	My workspace or thoughts feel chronically disorganized.
	•	My handwriting is often messy or hard to read.

Domain 2 – Memory Function
	•	I forget appointments or meetings unless I write them down immediately.
	•	I have trouble recalling details from conversations.
	•	I can’t hold a phone number in my head long enough to dial it.
	•	I frequently misplace personal items like keys or glasses.
	•	I lose track of directions in places I’ve been before.
	•	I struggle to remember sequences of tasks (e.g., steps in a recipe).

Domain 3 – Impulsivity & Self-Control
	•	I often speak without thinking and later regret it.
	•	I find it hard to resist urges even when I know better.
	•	I have bouts of anger that feel overwhelming.
	•	I replay mistakes over and over in my mind.
	•	I interrupt others frequently in conversation.
	•	I develop elaborate plans just to get my way.

Domain 4 – Mood & Emotional Regulation
	•	I experience deep bouts of sadness or hopelessness.
	•	I feel little motivation or drive for things I used to enjoy.
	•	I swing rapidly between emotional highs and lows.
	•	I feel overly elated or invincible at times.
	•	I believe others are out to mistreat or take advantage of me.
	•	I struggle to keep my emotions in check.

Domain 5 – Stress, Anxiety & Rumination
	•	I find myself obsessing over my to-do list.
	•	I feel on edge or restless most of the time.
	•	I experience sudden waves of panic.
	•	I’m constantly alert to every sound and movement around me.
	•	My thoughts circle over the same worries repeatedly.
	•	I sometimes feel detached from my own body.

Domain 6 – Sensory Filtering & Perception
	•	Background noises make it hard for me to concentrate.
	•	Bright lights or loud sounds bother me more than others.
	•	I misinterpret people’s facial expressions.
	•	I have trouble recognizing familiar faces.
	•	My speech often lacks normal inflection (sounds monotone).
	•	I reverse letters or mix up words when reading.

Domain 7 – History of Emotional/Physical Trauma
	•	I’ve experienced events that still cause me distress when I recall them.
	•	Physical injuries in my past affect how I feel today.
	•	I have moments when I re-live past painful memories vividly.
	•	I feel hypervigilant after stressful or traumatic experiences.
	•	I struggle to trust others because of previous harm.

Domain 8 – History of Head Injury
	•	I’ve had concussions or blows to the head that led to confusion.
	•	I experienced loss of consciousness after a head injury.
	•	I notice changes in my thinking since a head trauma.
	•	I have new or worsening headaches after past head injuries.
	•	I feel less coordinated or find balance difficult post-injury.

Domain 9 – Substance Use & Addictions (or Learning Issues for kids)
	•	I use alcohol or drugs more often than I intend to.
	•	I crave certain substances even when I know they harm me.
	•	I find it hard to cut back on tobacco, alcohol, or other substances.
	•	My use of a substance interferes with my daily responsibilities.
	•	I hide or lie about my substance use to friends or family.

⸻

Metabolic Questions
	•	Do you have any diagnosed metabolic conditions (e.g., diabetes, thyroid issues)?
	•	Have you experienced significant weight change in the last 6 months?
	•	Do you follow a specific diet?
	•	How much caffeine do you consume daily? (cups/ounces)
	•	Do you exercise regularly? (yes/no, frequency)

⸻

ISI (Insomnia Severity Index) – 7 Items
	•	Difficulty falling asleep
	•	Difficulty staying asleep
	•	Problems waking too early
	•	Satisfaction with current sleep pattern
	•	Interference of sleep problems with daily functioning
	•	Noticeability of sleep problems to others
	•	Worry/distress about current sleep problem

⸻

CHAPTER 5 – Wrap-Up
	•	Here are the top concerns we’ve noted — do you want to add anything?
	•	Any other symptoms or issues you’d like your clinician to know about?
	•	What is your main goal for working with us?

⸻

That’s your full superset — if every branch is triggered, this is every question you might need.
In a typical low-to-moderate complexity case, the patient will see fewer than half of these because:
	•	Low-severity areas skip deep dives.
	•	Sleep domain removed from CEC if short sleep form is used.
	•	ISI only for 18+.
	•	Some domains may be skipped for Peak Performance intakes.

    Global Rules (config you can tune)
	•	DEEP_DIVE_TRIGGER = ≥3 on the 1–5 screening
	•	TRACKER_TRIGGER   = ≥6 on the 0–10 deep‑dive items
	•	USE_ISI_18_PLUS   = true
	•	REMOVE_CEC_SLEEP  = true (sleep captured in the short sleep form)
	•	FLOW_VARIANT = 'problem' | 'peak' (from Step 1)

⸻

Legend (conditions you’ll see below)
	•	IF_PEAK → Reason = Peak performance
	•	IF_PROBLEM → Reason = Address a specific problem
	•	AC[topic] → Area of Concern selected for that topic
	•	AC_SEV[topic] → The 1–5 severity number for that topic
	•	DD_SEV[item] → The 0–10 deep‑dive score for a symptom item
	•	AGE_18_PLUS → age ≥ 18

Topics shorthand:
	•	anx anxiety/stress, dep mood/depression, mem memory/thinking, imp impulsivity, sleep sleep issues, learn learning issues (kids)

⸻

CHAPTER 1 – Your Story (always shown)

1) Reason for visit
	•	Shown: always
	•	Sets FLOW_VARIANT = 'problem' or 'peak'

2) Areas of Concern + quick severity (1–5)
	•	Shown: always
	•	Items (each with severity 1–5):
	•	AC[anx], AC[dep], AC[mem], AC[imp], AC[sleep], AC[learn] (kids)
	•	Logic tag per topic:
	•	IF AC[topic] AND AC_SEV[topic] >= DEEP_DIVE_TRIGGER → enqueue deep‑dive(topic)

3) Open comment (optional free text)
	•	Shown: always
	•	Feeds Gap logic (helps detect contradictions/missing detail)

⸻

CHAPTER 2 – Zoom In On What Matters (Deep‑dives, 0–10)

Shown per topic only if IF_PROBLEM and AC_SEV[topic] ≥ 3

ALL deep‑dive items:
IF DD_SEV[item] ≥ TRACKER_TRIGGER → add to Symptom‑Tracker Candidates with {item, topic, score}

A) Stress & Anxiety deep‑dive
	•	Show if: IF_PROBLEM AND AC[anx] AND AC_SEV[anx] ≥3
	•	Items (0–10): palpitations, sweating, trembling, constant_worry, on_edge, panic_waves

B) Mood & Depression deep‑dive
	•	Show if: IF_PROBLEM AND AC[dep] AND AC_SEV[dep] ≥3
	•	Items (0–10): persistent_sadness, loss_of_interest, emotional_swings, hopelessness, irritability, low_energy

C) Memory & Thinking deep‑dive
	•	Show if: IF_PROBLEM AND AC[mem] AND AC_SEV[mem] ≥3
	•	Items (0–10): forget_appointments, recall_conversations, directions, follow_instructions, misplacing_items, task_concentration

D) Impulsivity deep‑dive
	•	Show if: IF_PROBLEM AND AC[imp] AND AC_SEV[imp] ≥3
	•	Items (0–10): speak_without_thinking, interrupting, waiting_turn, acting_on_impulse, resist_urges, task_switching

E) Sleep Issues deep‑dive
	•	Show if: IF_PROBLEM AND AC[sleep] AND AC_SEV[sleep] ≥3
	•	Items (0–10): sleep_onset, night_wakings, early_wakening, unrefreshed, nightmares_vivid, daytime_sleepy
	•	Note: These are symptom intensities; the short sleep form (Chapter 3) captures structure/metrics (times, latency minutes, etc.).

F) Learning Issues deep‑dive (kids)
	•	Show if: IF_PROBLEM AND AC[learn] AND AC_SEV[learn] ≥3
	•	Items (0–10): follow_instructions, stay_on_task, reading_comprehension, math_difficulty, disorganized_work, retain_new_info

⸻

CHAPTER 3 – Daily Habits & Health

Shown for both flows, but Peak may skip Complicating Factors if you choose.

Medications
	•	Show if: always
	•	Fields: name, dosage, frequency (type‑ahead + add‑custom)

Supplements
	•	Show if: always
	•	Same pattern as Meds

Complicating Factors (checkboxes)
	•	Default: IF_PROBLEM show; (optional) show for Peak with a collapsed disclosure
	•	Items: head_injury_history, seizure_disorder, developmental_disorder, chronic_illness, substance_use_issues, significant_trauma, pregnancy_current, other_major_medical

Short Sleep questionnaire (structure/behaviors)
	•	Show if: always (sleep is universally relevant)
	•	Items:
	•	bedtime, wake_time, sleep_latency_minutes
	•	night_awakenings_count, awake_time_at_night_minutes
	•	rested_on_waking_0to10
	•	Checkboxes: snoring, vivid_dreams, restless_legs, teeth_grinding, parasomnias (sleepwalk/talk)
	•	REMOVE_CEC_SLEEP = true → sleep items in CEC are not shown later.

⸻

CHAPTER 4 – Quick Standardized Check‑in

CEC (0–3), 9 domains shown in small chunks
	•	Show if: always (both Problem & Peak), but with sleep domain removed when REMOVE_CEC_SLEEP=true
	•	Domains included: Focus/Flexibility, Memory, Impulsivity/Self‑Control, Mood/Emotional, Stress/Anxiety/Rumination, Sensory/Perception, Trauma History, Head Injury History, Substance Use/Addictions (or Learning Issues for kids).
	•	Kids mode: replace Substance Use with Learning Issues domain.
	•	Presentation rule: render in groups of 5–7 items/screen with progress.

Metabolic (short)
	•	Show if: IF_PROBLEM (recommended); optional for IF_PEAK (collapsed)
	•	Items:
	•	diagnosed_conditions (diabetes/thyroid/other)
	•	weight_change_6mo (up/down/none)
	•	diet_pattern (free text / selector)
	•	daily_caffeine_amount
	•	exercise_frequency (none/1–2/3–4/5+ per week)

ISI (7 items)
	•	Show if: AGE_18_PLUS
	•	Standard ISI items (0–4 each): fall_asleep_diff, stay_asleep_diff, early_wake, satisfaction, interference, noticeability, worry_distress

⸻

CHAPTER 5 – Wrap‑Up & Review
	•	Show if: always
	•	Items:
	•	Auto‑summary (“Top 3 concerns we captured: …”) → confirm
	•	“Anything to add before we finish?” (free text)
	•	“What’s your main goal working with us?” (free text)

⸻

System Processing (after submit)

1) Symptom‑Tracker Creator
	•	For every deep‑dive item where DD_SEV[item] ≥ TRACKER_TRIGGER
→ add { item_key, topic, score } to Candidates list
	•	Plus: sleep symptom scores (from deep‑dive or short sleep) can also be added if you want.

2) Gap Analysis (build clinician “Gap Questionnaire”)

Create gap items when any of these rules hit:
	•	Missing: a required metric for a shown section is null/blank (e.g., AC_SEV[anx] set but no deep‑dive answers present).
	•	Inconsistent: e.g., AC_SEV[anx] is 4–5 but deep‑dive items all ≤2; or ISI high & sleep form says latency <10 min with 0 awakenings.
	•	Risk: any red‑flag selection (e.g., CEC trauma items ≥2 with recent “significant trauma” checked; suicidal ideation cues if present in your CEC wording; seizure history + stimulant use; recent head injury with new memory complaints).
	•	Meds mismatch: substance use domain high but no meds/supps listed and open comment mentions a substance; or antidepressant present with 0/low mood items → “reconcile medication & symptom report.”

Each gap becomes a provider action item with a short directive:
	•	Confirm onset and triggers of panic episodes.
	•	Clarify sleep window (bedtime/wake), latency, and number/duration of awakenings.
	•	Reconcile medications vs reported symptoms (list dosages).
	•	Safety screen: ask about current intent and supports; escalate per clinic protocol if positive.

3) Standard Scores
	•	Compute CEC domain totals/means;
	•	Compute sleep metrics (TST estimate, SOL band, WASO band) from Chapter 3;
	•	Compute ISI total (if applicable);
	•	Attach to Provider Packet.

4) Provider Packet Assembly
	•	Chief complaint summary (auto draft + clinician‑editable)
	•	Complicating factors list
	•	Sleep report (structured metrics + 1–2 line summary)
	•	CEC domain table
	•	Metabolic/ISI summaries
	•	Symptom‑Tracker Candidates → toggles to finalize tracker
	•	Gap Questionnaire → required to complete before “Finalize Intake”

⸻

Peak Performance Variant (how it stays short)
	•	IF_PEAK:
	•	Show Chapter 1 (always)
	•	Chapter 2 deep‑dives only if they still rated a topic ≥3 (many won’t)
	•	Chapter 3: Short Sleep (keep), Meds/Supps (keep), Complicating Factors (optional collapsed)
	•	Chapter 4: CEC (keep, chunked), Metabolic (optional), ISI (18+ if you want a consistent sleep baseline)
	•	Net effect: Most Peak clients see ~30–40 items total