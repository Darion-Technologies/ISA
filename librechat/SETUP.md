# LibreChat "Darion ISA" preset — setup (UI config only, no code)

1. Admin creates accounts: `admin` (admin role) + `student1@localhost` (user role). `ALLOW_REGISTRATION=false` so no open signup.
2. Agents > New Agent > Name: `Darion ISA`. Paste verbatim prompt from `DARION_ISA_SYSTEM_PROMPT.md` (§4).
3. Model: `Darion Gateway / groq-llama-3.3-70b` (routes via LiteLLM → Groq).
4. Tools: enable MCP `mem0` (memory recall/store) + `moodle-webhook` (read-only timetable/deadlines via Activepieces webhook). Also allow Baserow read via Activepieces webhook tool if Moodle REST MCP is unavailable.
5. Instructions for memory: agent must scope all Mem0 calls with `user_id = <LibreChat user id>` (per-student isolation; T7).
6. Record preset/agent ID here after creation: `AGENT_ID=TODO`.
7. Moodle REST alternative: only if a maintained open-source MCP server with compatible license exists — none verified today, so Activepieces webhook is the default path.

## Health check
- Log in as student1, ask "what do I have today?" → agent must call moodle-webhook tool, cite Moodle seed data, never guess.
