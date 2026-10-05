# LICENSES.md — Darion ISA V1 component register
Verified 2026-10-05 against official repos/docs. All used as unmodified separate services over APIs.
Rule: AGPL/SSPL → STOP and ask. GPL → allowed only as unmodified separate service. Fair-code/source-available/commercial-only/enterprise folders → DO NOT USE.

| # | Component | Version (pinned) | License | LICENSE file link | How used | Notes |
|---|-----------|------------------|---------|-------------------|----------|-------|
| 1 | Caddy (reverse proxy + TLS) | 2.11.4 (`caddy:2.11.4`) | Apache-2.0 | https://github.com/caddyserver/caddy/blob/master/LICENSE | Separate service, unmodified. Terminates TLS, reverse-proxies chat/moodle/baserow/flows. | No AGPL/SSPL. `tls internal` for localhost. |
| 2 | LibreChat (student chat, auth, agent) | v0.8.7 (`librechat/librechat:v0.8.7`; v0.8.8 is pre-release, not used) | MIT | https://github.com/LibreChat-AI/LibreChat/blob/main/LICENSE | Separate service, unmodified. Built-in auth (no anon). Agent "Darion ISA" preset + MCP tools. | Built-in memory is KV-only, no semantic recall → Mem0 required. Needs Mongo-protocol DB (see FerretDB). |
| 3 | LiteLLM proxy core | v1.104.0 (`ghcr.io/berriai/litellm:v1.104.0`) | MIT (core); `enterprise/` dir under separate commercial license — NEVER mounted/used | Core: https://github.com/BerriAI/litellm/blob/main/LICENSE | Separate service, unmodified. All LLM calls route here; Groq backend via `GROQ_API_KEY`. | Requires `LITELLM_MASTER_KEY` + `DATABASE_URL`. Telemetry off. |
| 4 | Mem0 self-hosted server (long-term memory, MCP) | server `main` @2026-10-05 (no versioned image; deploy via `server/docker-compose`, `make bootstrap`) | Apache-2.0 | https://github.com/mem0ai/mem0/blob/main/LICENSE | Separate service from official repo, unmodified, connected to LibreChat via MCP `streamable-http`. | Legacy `openmemory-mcp` is sunsetting — do not use. New `mem0ai/openmemory` repo is a different session-porter tool, not used. |
| 5 | Moodle (institutional truth: timetable, exams, assignments, attendance) | **5.0.7+ (Build 20260519) ACTUAL** via `ellakcy/moodle:postgresql_apache_500_php8.3` (verified live via version.php; tag `4.5.3` does not exist on Docker Hub) | GPL-3.0 | https://github.com/moodle/moodle/blob/main/COPYING.txt | Separate service, unmodified, accessed over HTTP + REST web services (`core_calendar_*`, `core_enrol_get_users_courses`). Requires `MOODLE_DB_TYPE=pgsql` + `MOODLE_DB_PORT=5432` + `MOODLE_SSL=true` (TLS terminated at Caddy; image template honors `MOODLE_SSL` env). | GPL allowed only as separate unmodified service — complied. No official prod image (moodlehq image is dev-only, bitnami now commercial). mod_attendance NOT YET INSTALLED (Phase B gap — UI install only). TODO: bump to 5.3 tag when ellakcy publishes it. |
| 6 | Baserow (claim ledger + learning profile DB) | 2.4.0 (`baserow/baserow:2.4.0`) | MIT (core/OSE). `premium/` + `enterprise/` under separate licenses — DO NOT enable | Core: https://github.com/baserow/baserow/blob/develop/LICENSE | Separate service, unmodified OSE only. DB `isa` with 6 tables + per-student views + correction form. | Not AGPL/SSPL. |
| 7 | Activepieces (workflow automation) | 0.92.1 (`activepieces/activepieces:0.92.1`) | MIT (Community Edition). `packages/ee/` commercial — DO NOT enable | Core: https://github.com/activepieces/activepieces/blob/main/LICENSE | Separate service CE unmodified. 5 workflows (nightly_reflection, morning_brief, institution_change, exam_countdown, correction_handler). HTTP + OpenAI + SMTP + Baserow pieces (all MIT). | Telemetry off. Needs Postgres + Valkey. |
| 8 | Docling Serve (document parsing, optional) | v1.35.0 (`quay.io/docling-project/docling-serve:v1.35.0`; tags use `v` prefix, no `-cpu` variant — default image is CPU) | MIT | https://github.com/docling-project/docling-serve/blob/main/LICENSE | Separate service, unmodified, CPU profile. Optional today. | Tag corrected 2026-10-05 after `1.35.0-cpu` failed to resolve. |
| 9 | PostgreSQL (databases) | 18.6 (`postgres:18.6`) | PostgreSQL License (permissive, BSD-like) | https://www.postgresql.org/about/licence/ | Separate services (shared `postgres` + dedicated `moodle-db`), unmodified. Backs Baserow/Activepieces/LiteLLM/Moodle. | No public port. |
| 10 | FerretDB (MongoDB-protocol replacement) | v2.7.0 eval (`ghcr.io/ferretdb/ferretdb-eval:2` for V1 demo) | Apache-2.0 | https://github.com/FerretDB/FerretDB/blob/main/LICENSE | Separate service, unmodified. `MONGO_URI=mongodb://ferretdb:27017/LibreChat` per FerretDB+LibreChat docs. | MongoDB Community 8.0.32 is SSPL (https://github.com/mongodb/mongo/blob/master/LICENSE-Community.txt) → REJECTED per mission §2. FerretDB eval is demo-only; prod split (PG+DocumentDB+FerretDB) is TODO. |
| 11 | MeiliSearch (LibreChat search, bundled dep) | v1.13 (`getmeili/meilisearch:v1.13`) | MIT | https://github.com/meilisearch/meilisearch/blob/main/LICENSE | Separate service, unmodified, LibreChat dependency. Analytics off. |  |
| 12 | Valkey (Activepieces queue, Redis alternative) | 8 (`valkey/valkey:8`) | BSD-3-Clause | https://github.com/valkey-io/valkey/blob/unstable/LICENSE | Separate service, unmodified. Used because Redis itself carries RSAL/SSPL risk. |  |
| 13 | db-backup (daily dumps, 14-day retention) | `postgres:18.6-alpine@sha256:77f585114c32…` | PostgreSQL License (permissive) | https://www.postgresql.org/about/licence/ | Same image as #9, unmodified. Shell loop: `pg_dump` for baserow/activepieces/litellm/moodle + `tar` of the `moodle_moodledata` volume. | No licence delta from #9. Config-only (compose `command:`), no scripts. |

## Image digest pinning (verified 2026-10-05)
All 13 running services are pinned as `tag@sha256:<digest>` in `deploy/docker-compose.yml`.
Digests were read from `docker image inspect … .RepoDigests` of the images actually running, so
they pin *what was verified*, not a re-resolved tag. Full list: `tests/evidence_step3/images_pinned.txt`.

Exception — **Docling Serve (#8)** is deliberately NOT pinned: it sits behind the optional `docling`
compose profile and is not pulled locally, so no verifiable digest exists. Pin it on first real use.

Two digests are shared, which is expected and correct: `postgres:18.6` backs both `postgres` and
`moodle-db`; `activepieces:0.92.1` backs both `activepieces` and `activepieces-worker`.

## Custom components (the only non-vendored code in this stack)

Exactly **one** component in this repository is code we wrote. It is recorded here so the
"no custom code" mission rule has a single, auditable exception rather than an open-ended drift.

### 1. `deploy/mcp-shim/server.mjs` — read-only Moodle MCP shim

| Field | Value |
|---|---|
| Path | `deploy/mcp-shim/server.mjs` (full source in repo, ~258 lines) |
| Purpose | Exposes the Moodle timetable to LibreChat as exactly one MCP tool, `moodle_timetable`, and enforces per-student authorisation. |
| Why it exists | LibreChat's MCP client requires a real MCP server and a webhooks cannot speak MCP. Activepieces' native `/mcp` is a control plane (it exposes `ap_delete_flow` / `ap_create_table`) with no flow-invocation tool, so it cannot serve students. |
| Language / runtime | Node.js ESM, no dependencies, no build step. Runs on the already-digest-pinned `librechat/librechat` image purely for its Node runtime — no new image, no new digest. |
| Licence | Same licence as this repository (see `LICENSE`). Written from scratch; contains no third-party source. |
| Moodle credential | Receives `MOODLE_ISA_READER_TOKEN` only — the restricted `isar` service, limited to `core_webservice_get_site_info`, `core_enrol_get_users_courses`, `core_calendar_get_calendar_events`. It is never given admin Moodle access. |
| Exposed surface | Exactly one tool. There is no generic "call any `wsfunction`" passthrough, by construction. |
| Network exposure | **No published host port** (`docker port` is empty) and **no Caddy route** (`deploy/Caddyfile` contains no reference to it). Attached only to the internal `backend` Docker network, reachable only by LibreChat, which is the only service that sets the identity header. |
| Defence in depth | Calls arriving without `X-Student-Email` are refused, so even the network-level reachability from other `backend` peers (e.g. Caddy) yields no data. |

**No feature growth rule.** This file exists to make Moodle readable by the agent. It is
frozen. Specifically: no new tools, no new Moodle functions, no write operations, no
generic passthrough, no admin credentials, and no new network exposure. Anything beyond
read-only timetable/deadline access belongs in a separate, separately-approved component.

#### Alternatives evaluated before accepting this exception (2026-10-05)

No permissively-licensed off-the-shelf project satisfied **both** hard requirements:
restricting to an explicit function allowlist, **and** deriving the caller's identity from a
custom HTTP header. Verified at source level, not from badges:

| Project | Licence | Why rejected |
|---|---|---|
| `onbirdev/moodle-webservice_mcp` (Moodle plugin) | **no LICENSE file** (GitHub `license: null`); Moodle plugins are GPL by policy | Best functional match (function allowlist enforced by Moodle), but no licence file and no header identity. |
| `ali205412/moodle-mcp` (fork, adds Streamable HTTP + OAuth) | **no LICENSE file**; GPL expected | Same as above. Would be dramatically better if GPL were acceptable. |
| `haolamnm/moodle-mcp-srv` | Apache-2.0 (verified) | Hardcoded 23 tools including writes (`submit_assignment`, `create_calendar_event`); single static token; no header identity. |
| `peancor/moodle-mcp-server` | MIT (verified) | stdio only; 3 of 8 tools are writes. |
| `harsha-iiiv/openapi-mcp-generator` | MIT (verified) | Best generic gateway (per-request header capture via `AsyncLocalStorage`), but it only *forwards* headers upstream — Moodle authenticates solely by `wstoken` and ignores `X-Student-Email`. No mechanism binds a header value into a request parameter. |
| `dx-corp/mcp-openapi` | MIT (verified) | Reads exactly two inbound headers in all of `src/` (`origin`, `authorization`); policy webhook receives no headers. |
| `alibaba/higress` + `openapi-to-mcpserver` | Apache-2.0 (verified) | Request-template context has no inbound-header binding; upstream issue #2082 answer is "write Go". Also drags in an AI gateway + Redis. |
| `gaarutyunov/mcp-anything` | Apache-2.0 (verified) | Auth middleware treats the header as an opaque token only; no header→parameter binding. |
| `modelcontextprotocol/python-sdk` (FastMCP) | MIT (verified) | The only substrate where allowlist + `get_http_request()` header identity + streamable HTTP all work natively — but it is a library, not a product, so the server still has to be written. Not adopted to avoid adding a Python runtime for one tool. |
| `csmediapro/moodle-mcp-server` | AGPL-3.0 | Copyleft. |
| `theredbluepill/moodle-mcp-server` | Apache-2.0 (verified) | Dead (~16 months), stdio only, write-capable. |
| Activepieces MCP / n8n / Dify / Postman / Zapier | EE licence / Sustainable Use / Dify-OSL / proprietary | Not permissive, or Enterprise-gated. |
| Moodle core 4.5–5.3 | GPL | Ships an AI *provider* subsystem (`core_ai`), not an MCP server. |

Two design notes recorded from that review, both constraining future work:

- `mod_assign_get_assignments` takes no `userid` and is hard-wired to the token owner. A single
  shared read-only token therefore **cannot** serve per-student assignments — it would return the
  token owner's data to everyone. The shim deliberately does not call it.
- Resolving an email to a Moodle user id needs `core_user_get_users_by_field`, which is not on
  the `isar` allowlist. The shim therefore uses an explicit admin-maintained email→userid map
  (`MCP_STUDENTS_JSON`) rather than a runtime lookup, which keeps the Moodle token minimal.

## Rejected / avoided
- `mongodb/mongodb-community-server:8.0` — SSPL v1.0, source-available, not OSI open-source → NOT USED (mission §1.3 STOP condition avoided via FerretDB fallback, which mission explicitly permits).
- LiteLLM `enterprise/` folder, Baserow `enterprise/`+`premium/`, Activepieces `packages/ee/` — commercial/proprietary → NOT MOUNTED, NOT ENABLED.
- Skipped today per mission: Langfuse, Keycloak.
