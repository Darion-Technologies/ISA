# TEST_REPORT.md — Darion ISA V1 acceptance (fill during live run)

> Status today: infra + config authored and compose-validated. Live acceptance runs require
> deployed services + seeded Moodle/Baserow + imported flows. Do NOT claim pass without evidence.

## Environment
- Host: Linux sandbox, Docker 29.7.2 + Compose 5.5.1
- Commit: see git log (phaseB commit)
- `docker compose ps` (2026-10-05, Phase B): postgres healthy, caddy healthy, baserow healthy, moodle up, moodle-db/valkey/meilisearch up. litellm/librechat/activepieces/ferretdb images still downloading (retry after transient registry EOF).
- Groq key configured: NO (PLACEHOLDER; blocks Phase E LLM calls, not Phase B)

## Phase B evidence (Moodle) — all raw outputs saved
- `tests/evidence_phaseB/a_reader_courses.json` — (a) reader token → `core_enrol_get_users_courses&userid=5` → HTTP 200, 6 courses: CHEM106 CS103 EG104 ENG105 MATH101 PHY102 (raw JSON in file).
- `tests/evidence_phaseB/b_reader_week_events.json` — (b) reader token → `core_calendar_get_calendar_events` for courseids 2-7, window 2026-10-05..2026-10-12 IST → HTTP 200, 14 events, all matching seed/timetable.csv (Mon 09:00 Math/R101/Rao … Fri 11:15 C Lab/Lab1/Khan). Verbatim list in phase summary.
- DB spot checks: `mdl_event` count = 88 (84 class instances + 4 singles); dues/exam/lab epochs exact (C Lab due 2026-10-12 23:59, Math T3 due 2026-10-14 23:59, Chem lab 2026-10-16 11:15, Internal 1 2026-10-20 10:00 IST).
- Users: student1/student2/isa_reader created + each enrolled as student in all 6 courses (uploaduser: "Users created: 3, Errors: 0"). Bootstrap passwords rotated to MOODLE_DEMO_PASSWORD (.env only).
- Tokens: mdl_external_tokens rows `isa-admin-setup` (admin) + `isa-reader` (isa_reader), mobile service, validated by live REST calls above.

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
- Moodle actual version is 5.0.7+ (not 5.3 LTS); bump when ellakcy publishes a 5.3 tag.
- Courses live in default category 1 (Miscellaneous): `core_course_create_categories` is not in the mobile service and custom external services need UI creation. Follow-up: admin creates "JNTUK / Sem1-A" category in UI and moves the 6 courses.
- No custom Moodle role created (roles are UI-only in core): `isa_reader` is scoped by enrolment as student in the 6 courses (read caps only). Follow-up: admin defines a read-only role in UI if stricter scoping is wanted.
- Real mod_assign activities NOT created: `core_courseformat_new_module`/`create_module` are ajax-only (not callable via REST token) — STOP applied, no custom code written. No-code alternative used: the 2 assignments exist as course calendar due events (same API the agent reads). Follow-up: create 2 mod_assign activities in UI.
- mod_attendance NOT installed (UI-only install from plugin directory) — follow-up in Phase C/D window.
- Moodle repeat quirk (evidence-backed): `repeats=N` means N total occurrences AND instances after 2026-10-25 get a +1h DST shift. Avoided by posting 88 explicit instances. Documented in deploy/README.md.
- `student@localhost` emails flagged "Invalid email address" by Moodle (single-label domain) — users work for login/REST; email delivery to them won't. Consider @example.com on next seed.
- Live T1–T8: NOT RUN — run per tests/day1_to_day10.md and update table.
