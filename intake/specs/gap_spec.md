# Gap Report Specification (Provider-Led, Patient-Centric Questions)

- Audience: licensed clinicians.
- Question style: provider speaking to the patient — warm, clear, and concise.
  - Examples: “How often do you notice…?”, “Let’s talk about…”, “Can you walk me through…?”
- Rationale style: provider-only side note labeled “Why this matters:” with concrete context.
- Scope: produce follow-up questions, brief rationales, and omission alerts.

## Sections to consider
- Sleep: latency > 30m, awakenings ≥ 2, low rested (≤5/10).
- Mood/anxiety: deep-dive scores ≥ 6.
- Daily: meds/supps interactions; substance use; head injury history.
- CEC: clusters of Often/Always (≥2) in any domain.

## Output JSON shape
{
  "gapReport": {
    "patientId": "string",
    "intakeId": "string",
    "generatedAt": "string",
    "sections": [
      {
        "title": "string", // e.g., "Sleep Assessment", "Mood & Anxiety Evaluation"
        "questions": [
          // If a numeric rating is desired, set type to "rating_0_10" so the UI renders a 0–10 slider.
          { "id": "string", "text": "string", "rationale": "string", "visibility": "provider_only", "type": "short_text" }
        ]
      }
    ],
    "omissionAlerts": [
      { "expected": "string", "question": { "id": "string", "text": "string", "rationale": "string" } }
    ]
  }
}

## Markdown rules
- Use clear section headings that match JSON titles.
- For each question, show the question first (provider speaking to patient), then a separate line:
  - “Why this matters: …” with specific clinical context.
- Keep tone professional, warm, and succinct.
