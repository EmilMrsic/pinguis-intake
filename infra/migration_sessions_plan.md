Multi-session Migration Plan

Steps

1) For each practice pid:
   - Enumerate clients in practices/{pid}/clients
   - For each patientId:
     - Create sessions/{sid} with sessionNumber=1 (or last+1), startedAt/updatedAt now, authorId script uid, status inferred
     - Move artifacts:
       - From practices/{pid}/intakes where client_id==patientId → write to .../sessions/{sid}/intake/{intakeId}
       - Gap: mirror to gapReports/{gapId}; or extract and populate
       - Map: mirror metadata to maps/current (status, files)
     - Update patient doc lastSessionId and lastUpdatedAt
2) Backfill indexes (sessions updatedAt desc; gapReports createdAt desc)
3) Update rules to enforce practice_id claim and read-only completed/archived sessions
4) Verify counts and completeness pre/post

Verification Queries

- Count sessions per patient matches expected
- Latest session status fields reflect artifacts
- Old routes redirect to /provider/patients/:pid/sessions/:sid/*

Rollback

- Keep original collections intact for N days; mirror-only until cutover complete


