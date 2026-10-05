# Baserow `isa` database — schema (create via UI or API, no code)

Create database `isa` in Baserow UI, then create 6 tables with these fields.
Baserow types in brackets. Link fields use `link_row` to target table.

## 1. students
| field | type | notes |
|---|---|---|
| student_id | single_line_text, primary, unique | e.g. JNTUK-AIML-1A-001 |
| name | single_line_text | |
| program | single_line_text | B.Tech |
| branch | single_line_text | AIML |
| year | number | 1 |
| regulation | single_line_text | R23 |
| semester | number | 1 |
| section | single_line_text | A |
| goal | long_text | |
| email | email | login mapping |

## 2. evidence
| field | type |
|---|---|
| evidence_id | autonumber primary |
| student_id | link_row -> students.student_id |
| type | single_select: chat, quiz, attendance, assignment, notice, student_stated |
| summary | long_text |
| source_ref | single_line_text (chat msg id / Moodle event id / form id) |
| timestamp | date (include time, UTC) |

## 3. claims
| field | type |
|---|---|
| claim_id | autonumber primary |
| student_id | link_row -> students |
| category | single_select: strength, developing, weak, learning_pattern, risk, goal, preference |
| statement | long_text |
| confidence | decimal (0-1) |
| status | single_select: Observed, Candidate, Confirmed, Corrected, Expired |
| evidence_ids | link_row -> evidence (multiple) |
| created | date (time) |
| last_verified | date (time) |
| expires | date (formula or manual: created+14d for Candidate) |

## 4. concepts
| field | type |
|---|---|
| concept_id | autonumber primary |
| subject | single_line_text |
| topic | single_line_text (e.g. recursion, probability, SQL joins, eigenvalues) |
| student_id | link_row -> students |
| mastery | decimal (0-1) |
| last_practiced | date (time) |
| next_review | date |

## 5. plans
| field | type |
|---|---|
| plan_id | autonumber primary |
| student_id | link_row -> students |
| date | date |
| items | long_text (JSON list of {time, task, reason}) |
| reason | long_text |
| outcome | single_select: pending, done, partial, skipped |

## 6. institution_events
| field | type |
|---|---|
| event_id | single_line_text primary (Moodle event uuid) |
| type | single_select: created, updated, cancelled |
| subject | single_line_text |
| old_value | long_text (JSON) |
| new_value | long_text (JSON) |
| affected_group | single_line_text (e.g. AIML-1-A) |
| source | single_line_text (moodle) |
| timestamp | date (time) |
| processed | boolean |

## Views (per mission §5)
- `My profile` (table claims): filter `student_id = <current student>` (per-student filtered view / shared view filtered by form user). Read-only for student role + Correction form.
- `Needs review` (table claims): filter `status = Candidate`. Sorted by `created` desc. For nightly_reflection + tutor review.
- Correction form (Baserow form view on claims): fields `claim_id` (hidden), `corrected_statement` (maps to statement), sets `status=Corrected` via Activepieces `correction_handler` webhook (form webhook → flow). Native Baserow form cannot rewrite status alone, so webhook flow applies it — config only.

## Promotion rule (implemented in Activepieces nightly_reflection, config only)
- Candidate → Confirmed iff (count distinct-date evidence_ids >= 3) OR (student confirms via correction form with approve=true).
- Candidate → Expired if age > 14 days and not confirmed.
- Never invent student facts: AI-written rows always start as Candidate.

## Minimal API bootstrap (short shell commands, allowed — config only)
```bash
# 1. create token in Baserow UI (Settings > API tokens), export:
export BASEROW_URL=https://baserow.localhost BASEROW_TOKEN=xxx
# 2. create database + tables in UI (recommended), or via API:
curl -H "Authorization: Token $BASEROW_TOKEN" $BASEROW_URL/api/databases/
# 3. import seed students:
#    Table students > Import > upload ../../seed/students.csv (map columns)
# 4. create views + form in UI per above; paste form URL into correction_handler flow.
```
