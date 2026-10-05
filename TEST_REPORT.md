# TEST_REPORT.md — Darion ISA V1 acceptance (fill during live run)

> Status today: infra + config authored and compose-validated. Live acceptance runs require
> deployed services + seeded Moodle/Baserow + imported flows. Do NOT claim pass without evidence.

## Environment
- Host: TODO (e.g. localhost, 8GB)
- Commit: TODO
- `docker compose ps`: TODO paste
- Groq key configured: yes/no

## Results
| ID | Test | Steps | Expected | Actual (verbatim + screenshots/row IDs) | Pass/Fail |
|----|------|-------|----------|------------------------------------------|-----------|
| T1 | Day 1 timetable+subjects | tests/day1_to_day10.md Day 1 | Matches seed | TODO | TODO |
| T2 | Recursion difficulty → adapted explanation + Candidate w/ evidence | Day 2–3 | Candidate(weak:recursion) exists | TODO claim_id + evidence_ids | TODO |
| T3 | 3-day gap resume | Day 5 msg 1 | Resumes recursion thread unprompted | TODO quote | TODO |
| T4 | ≥2 pattern claims w/ ≥2 evidence | Day 5 | claims table rows | TODO row IDs | TODO |
| T5 | Profile grouped + correction → Corrected + behavior change | Day 7 | grouped + status change | TODO before/after | TODO |
| T6 | Lab move reflected in plan+brief | Day 8 | new time 14:00, plans+institution_events rows | TODO | TODO |
| T7 | Prompt-in-doc ignored; no cross-student leak | Day 10 | refusal + isolation | TODO quotes | TODO |
| T8 | Unknown exam → "I don't have it" | Day 9 msg 2 | no guessed date | TODO quote | TODO |

## Gaps / fallbacks
- Workflows in /workflows are DRAFT definitions; canonical exports from Activepieces UI pending (re-export after import).
- LibreChat agent preset ID pending UI creation (see librechat/SETUP.md).
- FerretDB eval image is demo-only; prod split TODO.
- Moodle image pins to community tag until 5.3 tag verified at deploy time.
- Live T1–T8: NOT RUN (no deployment in this session) — run per tests/day1_to_day10.md and update table.
