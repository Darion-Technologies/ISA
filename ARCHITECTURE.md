# ARCHITECTURE.md — Darion ISA V1

How the pieces fit together, and where the boundaries are enforced.

## Services

| Service | Role | Reachable from |
|---|---|---|
| `caddy` | TLS termination, four vhosts | host :80/:443 |
| `librechat` | Chat + agent UI, LLM calls via LiteLLM | `https://chat.localhost` |
| `moodle` | Course data, calendar, assignments | `https://moodle.localhost` |
| `baserow` | Student/claim/evidence records | `https://baserow.localhost` |
| `activepieces` (+`worker`) | Flow automation | `https://flows.localhost` |
| `litellm` | LLM gateway; all prompts go here | internal only |
| `moodle-mcp` | **Custom.** Read-only Moodle MCP shim | internal `backend` only |
| `moodle-db`, `postgres`, `ferretdb`, `meilisearch`, `valkey` | Data stores | internal only |

## The identity chain

This is the most important path in the system, so it is worth stating end to end.

```
browser session (LibreChat user, e.g. student1@isa.test)
   -> LibreChat substitutes {{LIBRECHAT_USER_EMAIL}} per tool call
   -> X-Student-Email: student1@isa.test
   -> moodle-mcp allowlist (MCP_STUDENTS_JSON): email -> Moodle userid
   -> Moodle REST with the restricted `isar` token (userid as a parameter)
   -> result returned to that same user
```

Properties that follow from this design:

- **The model cannot choose whose data is read.** The identity is a transport header, not a tool
  argument. Asking for another student is a protocol-level refusal, not a prompt instruction.
- **A missing header is a refusal, not a fallback.** Any caller that does not present a known
  `X-Student-Email` gets `Access denied` and no data.
- **Moodle never sees the student's identity.** It sees a service token plus a `userid` the shim
  looked up from its own allowlist. The `isar` service cannot enumerate or look up users.

## Why `moodle-mcp` exists rather than an Activepieces flow

LibreChat's MCP client requires a real MCP server over streamable HTTP. An Activepieces webhook
is plain HTTP POST and cannot speak MCP, so `type: streamable-http` pointed at a webhook URL
would fail protocol negotiation.

Activepieces *does* expose a native MCP endpoint at `/mcp`, but it is a control plane: its tool
list contains `ap_build_flow`, `ap_delete_flow`, `ap_create_table` and similar. It has no tool
that invokes a published flow as an end-user data source, and exposing it to students would hand
them the keys to the automation layer. So the read path is a purpose-built server instead, and
Activepieces remains the automation layer for scheduled/scoped flows.

See `LICENSES.md` → *Custom components* for the full list of alternatives evaluated and rejected.

## The shim is frozen

`deploy/mcp-shim/server.mjs` is the only custom code in this repository. It is not a platform to
extend. The rule, enforced by review:

- one tool, no more
- read-only Moodle functions only, from the `isar` allowlist
- no generic `wsfunction` passthrough, ever
- no admin Moodle credentials
- no published port, no Caddy route
- new capabilities go in a new, separately-approved component

## Defence in depth for the read path

1. Moodle's own service restriction: `isar` can call four functions and nothing else.
2. Shim allowlist: unknown caller → refusal.
3. Header match: caller ≠ requested student → refusal.
4. Service-account assertion: if the token is no longer `isa_reader`, the shim refuses rather than
   returning possibly-wrong data. (Needed because `core_enrol_get_users_courses` returns course
   fields only — it carries no per-user identity, so it cannot self-verify.)
5. Network: no published port, no Caddy route; `moodle-mcp` is on the internal `backend` network.
   Caddy also sits on `backend`, so it has network-level reachability, but with no route and no
   identity header it cannot obtain data.
6. No credential is ever returned to the model or written to evidence.

## Data model

Baserow holds the student-facing record: `students`, `evidence`, `claims`, `concepts`, `plans`,
`institution_events` (physical tables 815–820). Two students, `student1` and `student2`, are
provisioned. Moodle holds authoritative teaching data. Claims carry evidence and can be corrected
by students; corrections flow through the `correction_handler` flow.

Note on counts: Baserow 2.x stores rows in per-table `database_table_<id>` relations, which also
carry the `trashed` flag. `students` holds 12 physical rows — 2 active plus 10 trashed
duplicates from repeated seeding. REST exposes only the 2 active students. This is correct
behaviour, not data loss.

## Secrets

All credentials live in `deploy/.env` (mode `600`, git-ignored) and are passed as environment
variables. No secret is written to `tests/evidence_*`, committed, or returned by any tool.