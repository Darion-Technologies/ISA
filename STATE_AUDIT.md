# Darion ISA V1 — State Audit (STEP 1)

Audit date: 2026-10-05. Evidence: raw command output captured during the run.
Scope: discovery only. **No changes were made to services, data or repos.**

Canonical recommendation: **`/home/darion-dev/Dev/ISA`**. Reasons in §7.
Awaiting user confirmation before any port/archive/delete action.

---

## 1. Repositories

| | `/home/darion-dev/Dev/ISA` | `/home/darion-dev/ISA` |
|---|---|---|
| Git repo | **yes** | **no** (`fatal: not a git repository`) |
| Remote | none | n/a |
| HEAD | `5e0744f` phaseC: baserow isa DB (6 tables, 2 students, 4 views), API token, inner-caddy fix | n/a |
| Tracked files | 25 | 0 |
| `.env` present | yes (gitignored) | yes (**not** under version control at all) |

Commits (oldest → newest):

```
1fa3358 infra: compose+Caddy+env template, licenses register
cbbaf71 data: Moodle seed CSVs, Baserow isa schema
3ad938c agent: workflows drafts+prompts, Darion ISA preset, 10-day test script
7d182ac phaseA: fix pg18 volume mount, moodle image tag+TYPE/PORT/email, caddy auto_https
f4f6d82 phaseB: moodle seeded (6 courses, 3 users, 88 events), REST tokens, curl proof
8e042cf phaseB: ferretdb eval creds per docs, litellm liveliness probe
5e0744f phaseC: baserow isa DB (6 tables, 2 students, 4 views), API token, inner-caddy fix
```

`/home/darion-dev/ISA` contains only: `deploy/`, `seed/`, `LICENSES.md`, `.gitignore`.
It has **no** `baserow/`, `librechat/`, `tests/`, `workflows/`, or `TEST_REPORT.md`.

### 1a. Structural differences

| Artifact | Dev/ISA | ISA |
|---|---|---|
| `deploy/docker-compose.yml` | yes | yes |
| `deploy/Caddyfile` | yes | **no** (URLs inlined in .env instead) |
| `deploy/litellm-config.yaml` | yes | **no** (uses `deploy/litellm/config.yaml`) |
| `deploy/librechat.yaml` | yes | yes |
| `LICENSES.md` | yes | yes |
| `TEST_REPORT.md` | yes | **no** |
| `baserow/SCHEMA.md` | yes | **no** |
| `librechat/DARION_ISA_SYSTEM_PROMPT.md` | yes | **no** |
| `tests/day1_to_day10.md` | yes | **no** |
| `workflows/PROMPTS.md` | yes | **no** |

### 1b. Hostname differences

| Role | Dev/ISA (running) | ISA |
|---|---|---|
| Chat | `chat.localhost` | `chat.localhost` |
| Moodle | `moodle.localhost` | `moodle.localhost` |
| Baserow | `baserow.localhost` | `data.localhost` |
| Workflows | `flows.localhost` | `flow.localhost` |
| LiteLLM | `litellm.localhost` (commented out in Caddyfile) | `llm.localhost` |

### 1c. Image pin differences

| Service | Dev/ISA (running) | ISA |
|---|---|---|
| litellm | `ghcr.io/berriai/litellm:v1.104.0` | `ghcr.io/berriai/litellm:v1.76.1-stable` |
| caddy | `caddy:2.11.4` | `caddy:2.10.2` |
| librechat | `librechat/librechat:v0.8.7` | `librechat/librechat:v0.8.7` (same) |
| activepieces | `activepieces/activepieces:0.92.1` | `ghcr.io/activepieces/activepieces:0.91.0` ×2 |
| baserow | `baserow/baserow:2.4.0` | `baserow/baserow:1.33.4` |
| moodle | `ellakcy/moodle:postgresql_apache_500_php8.3` | `erseco/alpine-moodle:v5.0.2` |
| postgres | `postgres:18.6` ×2 | `postgres:17-alpine` |
| ferretdb | `ghcr.io/ferretdb/ferretdb-eval:2` | `ghcr.io/ferretdb/ferretdb:2.8.0` + `postgres-documentdb` |
| meilisearch | `getmeili/meilisearch:v1.13` | `getmeili/meilisearch:v1.35.1` |
| valkey | `valkey/valkey:8` | `valkey/valkey:8.1.10-alpine` |
| pgvector | — | `pgvector/pgvector:pg17` |
| docling | `quay.io/docling-project/docling-serve:v1.35.0` (profile-gated) | — |

### 1d. Compose service differences

- **Dev/ISA only:** `docling` (profile-gated), `moodle-db` (separate DB container)
- **ISA only:** `ferretdb-pg`, `db-backup`, `activepieces-worker`, `moodledata`, `moodlehtml`

### 1e. Env var differences

- Dev/ISA: `PG_USER`/`PG_PASSWORD`/`PG_DB`, `GROQ_API_KEY`, `DOMAIN_*`, `BASEROW_API_TOKEN`, `MOODLE_*_WS_TOKEN`
- ISA: `POSTGRES_USER`/`POSTGRES_PASSWORD`, `VALKEY_PASSWORD`, `FERRETDB_PG_PASSWORD`, `MEILI_MASTER_KEY`, `LLM_API_KEY`/`LLM_API_BASE`, `CREDS_KEY`/`CREDS_IV`, `*_HOST`
- Names are incompatible; the two `.env` files are not interchangeable.

---

## 2. Running state

Compose project `darion-isa-v1`, started from
**`/home/darion-dev/Dev/ISA/deploy/docker-compose.yml`** — 11 containers.

| Container | Image | Status |
|---|---|---|
| `darion-isa-v1-litellm-1` | `ghcr.io/berriai/litellm:v1.104.0` | Up 32 min (healthy) |
| `darion-isa-v1-librechat-1` | `librechat/librechat:v0.8.7` | **Up 10 min (UNHEALTHY)** |
| `darion-isa-v1-activepieces-1` | `activepieces/activepieces:0.92.1` | Up 4 h (healthy) |
| `darion-isa-v1-baserow-1` | `baserow/baserow:2.4.0` | Up 8 h (healthy) |
| `darion-isa-v1-ferretdb-1` | `ghcr.io/ferretdb/ferretdb-eval:2` | Up 9 h (healthy) |
| `darion-isa-v1-moodle-1` | `ellakcy/moodle:postgresql_apache_500_php8.3` | Up 9 h |
| `darion-isa-v1-caddy-1` | `caddy:2.11.4` | Up 4 h (healthy) |
| `darion-isa-v1-moodle-db-1` | `postgres:18.6` | Up 9 h |
| `darion-isa-v1-postgres-1` | `postgres:18.6` | Up 9 h (healthy) |
| `darion-isa-v1-valkey-1` | `valkey/valkey:8` | Up 9 h |
| `darion-isa-v1-meilisearch-1` | `getmeili/meilisearch:v1.13` | Up 9 h |

No service from `/home/darion-dev/ISA` is running.

### 2a. FAIL — LibreChat healthcheck probes a non-existent endpoint

```
["CMD","node","-e","fetch('http://127.0.0.1:3080/api/health').then(r=>{if(!r.ok)process.exit(1)})"]
```

Endpoint probe from inside the container:

```
/api/health      HTTP 404
/api/healthcheck HTTP 404
/api/config      HTTP 200
/health          HTTP 200
```

`/api/health` does not exist in v0.8.7, so the healthcheck exits 1 forever. Container logs
`Server readiness checks passing.` at the same time. This is a **committed** bug (present in
`HEAD`), not introduced by this session. Fix: probe `/health`.

### 2b. Uncommitted live change not represented in compose

```
net=isa-backend aliases=[moodle.localhost]      <-- ad-hoc, NOT in docker-compose.yml
net=isa-frontend aliases=[darion-isa-v1-caddy-1 caddy]
```

Applied manually via `docker network connect --alias moodle.localhost isa-backend darion-isa-v1-caddy-1`.
Will be lost on the next `up -d`. Compose currently declares only `networks: [frontend]` for caddy.

### 2c. Uncommitted file changes in Dev/ISA

```
 M deploy/docker-compose.yml
 M deploy/librechat.yaml
 M deploy/litellm-config.yaml
```

Attribution:

- **`deploy/docker-compose.yml`** — 4 added lines, of which **only the 2 `GEMINI_*` lines are
  from this session**. The other 2 pre-date it and are the user's:
  `AP_SSRF_ALLOW_LIST`, `AP_NETWORK_MODE: UNRESTRICTED` (verified absent from `HEAD`).
- **`deploy/librechat.yaml`** — all from this session: `mcpSettings.allowedAddresses`,
  `memory.agent.provider`/`model`, gateway model `groq-llama-3.3-70b` → `darion-isa`,
  `mem0` server block commented out.
- **`deploy/litellm-config.yaml`** — all from this session: added `darion-isa` and
  `gemini-3.8-flash`; `groq-llama-3.3-70b` retained.

---

## 3. LLM provider and model actually in effect

LiteLLM `/v1/models` response:

```
['darion-isa', 'gemini-3.8-flash', 'groq-llama-3.3-70b']
```

| Alias | Upstream | Source |
|---|---|---|
| `darion-isa` | `openai/gemini-3.8-flash` → `GEMINI_API_BASE` | Google OpenAI-compat endpoint |
| `gemini-3.8-flash` | same | same |
| `groq-llama-3.3-70b` | `groq/llama-3.3-70b-versatile` | Groq direct |

LibreChat: `OPENAI_BASE_URL=http://litellm:4000/v1`; endpoint "Darion Gateway",
`default: ["darion-isa"]`, `titleModel: darion-isa`.
Env vars present in LiteLLM container: `GEMINI_API_KEY`, `GEMINI_API_BASE`, `GROQ_API_KEY`.
Both provider keys are configured; Gemini is the default route, Groq is retained fallback.

Note: `gemini-2.5-flash` was tried first and returns HTTP 404 for new Google accounts
("no longer available to new users"); `gemini-3.8-flash` verified 200.

---

## 4. Secrets scan

### 4a. Working tree — `/home/darion-dev/Dev/ISA`

| Location | Type | Verdict |
|---|---|---|
| `deploy/docker-compose.yml:132` | `postgres://${PG_USER:?}:${PG_PASSWORD:?}@…` | **false positive** — variable reference |
| `deploy/docker-compose.yml:157` | `postgres://${PG_USER:?}:${PG_PASSWORD:?}@…` | **false positive** — variable reference |

No real credentials in the tracked tree.

### 4b. Working tree — `/home/darion-dev/ISA`

| Location | Type | Verdict |
|---|---|---|
| `deploy/docker-compose.yml:98,160,336` | URI-with-password pattern | **false positive** — variable references |
| `deploy/.env:31` | `sk-…` (67 chars) | **REAL SECRET** — `LITELLM_MASTER_KEY` |
| `deploy/.env:32` | `sk-…` (67 chars) | **REAL SECRET** — `LITELLM_SALT_KEY` |

Repo B is **not under version control**, so these are not committed anywhere. Risk is local
filesystem exposure only. Both were generated by this session; they protect only the local
LiteLLM proxy and are rotatable by re-running the generator.

### 4c. Git history — `/home/darion-dev/Dev/ISA`

All 42 blobs across all commits scanned for Google API keys, Groq keys, `sk-` keys,
GitHub PATs, JWTs and Slack tokens:

```
NO credential-pattern matches in any committed blob
```

**History is clean.** No rewrite or fresh-repo remediation needed.

### 4d. `.env` ignore status

```
$ git check-ignore -v deploy/.env
.gitignore:2:**/.env	deploy/.env
```

Confirmed ignored. Only `deploy/.env.example` is tracked.

### 4e. Secrets exposed outside the filesystem

| Exposure | Detail |
|---|---|
| **Gemini key, session transcript** | Printed into tool output earlier in this session (length confirmed). Present in `Dev/ISA/deploy/.env` as `GEMINI_API_KEY` and `ISA/deploy/.env` as `LLM_API_KEY`. **Requires rotation.** |

This is the only provider key known to have leaked. Groq key has not been printed.

---

## 5. Product state

### 5a. Moodle — seeded, but access is over-privileged

| Metric | Value |
|---|---|
| Courses | 7 (`Mathematics I`, `Programming in C`, `Physics for Engineers`, `Chemistry for Engineers`, `Engineering Graphics`, `English for Communication`, + site) |
| Calendar events | 88 |
| Users (not deleted) | 5 |
| REST tokens | 2: `isa-admin-setup` (webservice 1), `isa-reader` (webservice 1) |
| External services | **1 only**: `Moodle mobile web service` (id 1, enabled, `restrictedusers=0`) |

**FAIL (STEP 4 prerequisite):** both tokens sit on *Moodle mobile web service* with 425
function mappings and no user restriction. No dedicated least-privilege read-only service exists.
Note for STEP 4: Moodle 5.0 uses `mdl_external_services` / `mdl_external_tokens`;
`mdl_web_service` and `mdl_plugins` do not exist in this version.

Live REST proof (read call, no `--insecure`, via Caddy):

```
HTTPS via alias -> HTTP 200
{"sitename":"","username":"isa_reader","firstname":"ISA","lastname":"Reader",
 "userid":5,"siteurl":"https://moodle.localhost","functions":[{"name":"core_badges_get_bad…
```

### 5b. Baserow — schema and students PRESENT (original finding was WRONG)

**Correction.** The first version of this section claimed the six tables were missing. That was
a false negative: Baserow names physical tables `database_table_<id>`, not by display name, so
searching `information_schema` for `students`/`claims`/etc. found nothing. Re-verified properly.

Baserow database id 256, via API (`/api/database/tables/database/256/`):

```
table count: 6
  id= 815  name=students
  id= 816  name=evidence
  id= 817  name=claims
  id= 818  name=concepts
  id= 819  name=plans
  id= 820  name=institution_events
```

Physical tables confirmed present: the `public` schema holds **840** relations matching
`^database_table_[0-9]+$` (all Baserow databases, not just `isa`); the six belonging to database
`isa` are 815–820. *(An earlier revision of this section said "818 tables" — that number is wrong;
it was a miscount. 815–820 all exist and all carry rows.)*

Visible row counts are 2 in each of the six tables, read with the **database token**:

```
rows endpoint with Token auth -> HTTP 200 bytes=762
count: 2
  JNTUK-AIML-1A-001 | Demo Student   | student1@localhost
  JNTUK-AIML-1A-002 | Second Student | student2@localhost
```

**Visible is not the same as stored.** At audit time `database_table_815` held **12** physical rows:
the 2 active students plus **10 trashed duplicates** from repeated seeding runs. The other five
tables held 2 rows each with 0 trashed. Baserow's REST layer excludes trashed rows, so the API
correctly reported 2 — but the physical count and the REST count must not be confounded. **Task D
has since emptied that trash**: `students` is now 2 physical rows, 2 active, 0 trashed.

Views on `claims` (817): **5 active** — `Grid` (3508), `Needs review` (3524),
`My profile (student1)` (3525), `My profile (student2)` (3526), `Correction form` (3527, form) —
which had been accompanied by **12 trashed duplicates** (3512–3523) from repeated runs, also since
removed. Counting active views across the `isa` tables gives 1/1/5/1/1/1 = **10**, not the 4 implied
by the `5e0744f` commit subject. `TEST_REPORT.md:31-36` recorded the tables but never the view
totals, so "matches `TEST_REPORT.md` exactly" was an overstatement. **No rebuild required.**

Evidence: `tests/evidence_stepA/baserow_full_verification.txt`,
`tests/evidence_stepA/baserow_reverify_taskA.txt` (live re-run, REST + Postgres),
`tests/evidence_stepA/baserow_students_via_token.json`,
`tests/evidence_stepA/baserow_views.json`,
`tests/evidence_taskD_trash_empty.txt` (the emptying).

**Qualification on the data.** `students` is genuinely populated, but `evidence`, `claims`,
`concepts`, `plans` and `institution_events` hold only *placeholder rows* — on every one of
those rows the sole non-null fields are the table's own surrogate key and a defaulted
`Active: false` / `processed: false`. So the schema and identity records exist; no learning data
does yet. STEP 5 populates them.

**Trashed debris — RESOLVED.** 10 trashed duplicate student rows and 12 trashed duplicate views
were recorded here and have since been removed via Baserow's own trash API. Both the 2-student and
5-active-view figures were unaffected throughout, before and after. The 5 trashed duplicate `isa`
applications (251–255) remain deliberately — they are workspace-level, not part of this database,
and removing them was out of scope.

#### 5b-i. Database-token auth: works on rows, not on metadata endpoints

`Authorization: Token <BASEROW_API_TOKEN>` returns **200** on the documented database API
(`/api/database/rows/table/{id}/`). It returns **401 "Authentication credentials were not
provided"** on `/api/database/tables/` and `/api/database/views/`. An obviously invalid token
returns the *identical* 401 on those endpoints, proving the header is simply not consulted there.

Cause, verified in-image: `baserow/config/settings/base.py:447` sets
`DEFAULT_AUTHENTICATION_CLASSES` to `JSONWebTokenAuthentication` only. `TokenAuthentication`
exists in the **open-source** tree at `baserow/contrib/database/api/tokens/authentications.py`
(so **no Enterprise licence is required** — `active_licenses` is empty), but it is only wired
into views that opt in explicitly. Metadata endpoints require an admin **JWT**
(`POST /api/user/token-auth/`), which works and returns 200.

**Consequence for the stack:** flows must use the database token for **rows** operations, and a
JWT for schema/view operations. The in-network call also requires the header
`Host: baserow.localhost` — Baserow's inner Caddy answers **HTTP 200 with an empty body** for any
other Host value (`Server: Caddy`, `Content-Length: 0`), which silently looks like success.
This is the trap recorded in `TEST_REPORT.md:36`.

### 5c. Activepieces — no runnable flow

| Metric | Value |
|---|---|
| Flows | 3, all `DISABLED`, none with a published version |
| `table_webhook` rows | 0 |
| `trigger_event` rows | 0 |

`POST /api/v1/webhooks/moodle-read` → HTTP 400. LibreChat logs:
`[MCP][moodle-webhook] ... {"statusCode":400}` → `Initialized with 1 configured server and 0 tools.`

**The agent has zero tools.** Six flow JSONs exist in `workflows/` (drafts only, never imported).

### 5d. LibreChat — empty

| Metric | Value |
|---|---|
| Users | **0** |
| Agents | **0** |
| Conversations | **0** |

The "Darion ISA" agent does **not** exist. `ALLOW_REGISTRATION=false` in compose, so the first
admin user cannot be created through the UI as configured — needs a deliberate one-off change.

### 5e. Mem0 — not deployed

No container, no service definition, no image on disk. `librechat.yaml` `mem0` MCP block is
commented out (this session). The Incubator project
(`/home/darion-dev/Dev/Incubator/Darion ISA`) has services `anythingllm, db, keycloak, qdrant`
— no mem0, so nothing to reuse.

---

## 6. Gaps blocking STEPs 4–7

| Step | Blocker | Needs |
|---|---|---|
| 3.1 | `moodle.localhost` alias is ad-hoc only | compose edit |
| 3.2 | Activepieces cannot verify Caddy's internal CA | CA mount + documented env var |
| 4 | No least-privilege Moodle service; both tokens on mobile service | UI/DB work + re-issue |
| 5 | ~~Six Baserow tables missing~~ **RESOLVED — false alarm**, schema+students present (6 tables 815–820, 2 active students, 5 active views on claims, trashed debris recorded) | populate `evidence`/`claims`, prove row isolation |
| 6 | 3 disabled flows, 0 webhooks, no published version | build/enable/publish in UI, export after run |
| 6 | Student identity cannot come from an authenticated chat user | LibreChat capability check |
| 7 | 0 users, 0 agents; `ALLOW_REGISTRATION=false` | create admin, then agent |
| 7 | Mem0 absent | deploy per current official docs |
| 8 | Depends on all of the above | — |

---

## 7. Canonical-repo recommendation

Recommend **`/home/darion-dev/Dev/ISA`**:

1. It is the only repository under version control (7 commits, clean history, no secrets).
2. It is the compose file the live stack was started from; all fixes land there.
3. It holds every artifact the later steps need: `baserow/SCHEMA.md`,
   `librechat/DARION_ISA_SYSTEM_PROMPT.md`, `tests/day1_to_day10.md`,
   `workflows/PROMPTS.md`, `TEST_REPORT.md`, seed CSVs, committed evidence.
4. `/home/darion-dev/ISA` has no git, no history, no tests, no workflows, and a different
   (older) set of image pins. Its only unique content is `.env` secrets and a `litellm/`
   directory layout.

Deliberate improvements worth porting **from** `/home/darion-dev/ISA` **to** `Dev/ISA`, only
after confirmation:

- `db-backup` service (daily `pg_dump`, 14-day retention) — absent in Dev/ISA.
- `activepieces-worker` — absent in Dev/ISA.
- Caddy TLS/host documentation for `llm.localhost`.

Not worth porting: its hostname scheme, its older image pins, and its env var names.

**Awaiting user decision.** Nothing has been archived or deleted.
---

## STEPS 2–4 outcome (executed after the §5b correction)

### STEP 2 — secrets
Re-scan after the reported Gemini rotation: **no credential-pattern match in the working tree
(only local `sk-` DB passwords / URI refs) and none across all 42 committed blobs.** `deploy/.env`
is ignored (`.gitignore:2`). The rotated key is the one running in LiteLLM (container created
18:29 UTC, after the 18:15 UTC `.env` edit), returns HTTP 200 from Google, and drove a live
`darion-isa` completion. **Caveat:** the pre-rotation key was only ever printed in chat, never
written to a file, so it cannot be tested from here — the old key must be confirmed deleted in
Google AI Studio, since creating a new key does not by itself revoke the old one.

### STEP 3B — compose hardening
- `db-backup` and `activepieces-worker` ported from the other repo and fixed. The other repo's
  version dumped 5 DBs but **no moodledata volume**, so it would have silently failed the
  requirement. Both corrected; 5 artefacts produced on first run.
- `moodle.localhost` is now a declarative Caddy network alias on `backend`, replacing the hand-run
  `docker network connect`. All four `*.localhost` names resolve to Caddy in-network.
- LibreChat healthcheck `/api/health` → `/health`; container was `unhealthy` before, `healthy` after.
- **SSRF finding (the user's question, answered in the opposite direction).** The docs state the
  allow-list only applies when `AP_NETWORK_MODE=STRICT`, and the default is `UNRESTRICTED`. So the
  previous `UNRESTRICTED` + allow-list meant the guard was **off** and the list inert — deleting the
  line alone would have left it off. Changed to `STRICT` with the three real subnets
  (`172.26/16`, `172.27/16`, `172.28/16`; the old `172.16.0.0/12` was needlessly broad).
- Activepieces publishes no general trusted-CA variable (only `AP_POSTGRES_SSL_CA`,
  `AP_REDIS_SSL_CA_FILE`), so Caddy's root CA is mounted and Node's documented
  `NODE_EXTRA_CA_CERTS` is used. All four hosts now return 200 from Activepieces over **verified** TLS.
- 13/13 running images pinned by digest; Docling deliberately left unpinned (profile-gated, not pulled).
- Fixed a pre-existing bug: **LibreChat login was entirely broken** — `JWT_REFRESH_SECRET` was
  absent, so every login returned HTTP 500 at `generateRefreshToken`. Now 200 + tokens issued.

### STEP 3C — first users
`admin@isa.test` (ADMIN) and `student1@isa.test` (USER) created via the image's own
`config/create-user.js`; `ALLOW_REGISTRATION=false` retained (signup route returns 404).
Credentials in gitignored `deploy/.env`. Order matters: the **first** user becomes ADMIN
(`AuthService.js:381`), so the student must be created after the admin.

### STEP 4 — Moodle least privilege
Dedicated service `isar` ("ISA Reader (read-only)") with exactly four functions:
`core_webservice_get_site_info`, `core_enrol_get_users_courses`, `core_calendar_get_calendar_events`,
`mod_assign_get_assignments`. Note `core_course_get_user_dates` and `core_course_get_assignments`
do **not** exist in 5.0; `mod_assign_get_assignments` is the read-only assignment function.
New token issued for `isa_reader`; **both** old overprivileged tokens (including the admin one on
the 425-function mobile service) deleted. `isa_reader` holds only the `student` role, so
`enrol/manual:enrol` is structurally impossible. Writes refused with `webservice_access_exception`;
an enrol attempt left `mdl_enrol` at 18 rows. Evidence: `tests/evidence_step4/`.

#### Deviations from "shipped tooling only" — flagged for review
Two operations could not be done with shipped commands. Both are operational rather than application
code, but they are judgement calls:
1. **Moodle token minting** — there is no CLI for web-service tokens (checked `admin/cli/`), and the
   UI route needs an interactive browser session. Used Moodle's own core API from a one-off `php -r`
   (`external_generate_token`), which is the same call the UI makes. GUI equivalent: Site admin →
   Server → Web services → Tokens → Add token.
2. **LibreChat user deletion** — `config/delete-user.js` asks two questions and its `askQuestion`
   helper creates a fresh readline per prompt, so piped stdin only ever satisfies the first; the
   process then exits silently on EOF. Removed the two stale user documents via `mongosh` and
   recreated them in the correct order. `create-user.js` itself was used normally.

#### Known gaps carried into STEP 5+
- Activepieces has no published flow, so LibreChat's `moodle-webhook` MCP fails with
  `params/flowId Invalid string: must match pattern /^[0-9a-zA-Z]{21}$/` — a real flowId must be
  exactly 21 alphanumeric characters.
- The 7-day Moodle window contains labs and one due date but **no exam events**; exams are not yet
  seeded in Moodle.
- Mem0 is still absent (deliberate, per the licence/complexity review); the memory agent stays off.
