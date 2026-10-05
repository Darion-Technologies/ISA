# Baserow `isa` database — schema (created 2026-10-05 via Baserow REST API, app id 256)
Live ids (workspace 155): students=815, evidence=816, claims=817, concepts=818, plans=819, institution_events=820.
Student rows: 11 (JNTUK-AIML-1A-001), 12 (JNTUK-AIML-1A-002).
Views on claims: 3524 "Needs review" (single_select_equal Candidate), 3525/3526 per-student "My profile" (link_row_has student row), 3527 "Correction form" (form).
API token `isa-workflows` in deploy/.env as BASEROW_API_TOKEN (created via POST /api/database/tokens/ + workspace id).

API corrections learned (docs/behavior win over memory):
- Create app: POST /api/applications/workspace/{workspace_id}/ (workspace required; user signup creates none — POST /api/workspaces/ first).
- Signup: POST /api/user/ {name, email, password, ...}; auth: POST /api/user/token-auth/ (singular `user`, NOT `users`).
- Create table: POST /api/database/tables/database/{db}/. No `decimal` type — use `number` + number_decimal_places. Date: `date` + date_include_time (no date_time_format needed).
- Autonumber CANNOT be primary: primary stays a text key field (`ref`, or natural key like student_id); autonumber id fields are extra.
- Tables get default `Notes` + `Active` fields plus reverse link_row backlinks — harmless, leave them.
- Primary text field must be written via `field_<id>`, not by name.
- View filters are separate objects: POST /api/database/views/{id}/filters/ (inline `filters` on create/update are ignored). single_select uses `single_select_equal`; link_row uses `link_row_has` with related row id.
- Inner-Caddy note: BASEROW_CADDY_ADDRESSES=http://baserow.localhost (host must match forwarded Host; http scheme so inner Caddy doesn't redirect — outer Caddy terminates TLS). See deploy/docker-compose.yml.

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
