# Darion ISA V1 — deploy

Assembly only. Zero custom application code. All services are unmodified upstream images.

## Prereqs
- Docker 24+ + Compose v2, 8GB RAM, ports 80/443 free
- Groq API key (you supply). Only this endpoint receives prompts.

## Exact commands
```bash
cp deploy/.env.example deploy/.env
# generate secrets:
for k in PG_PASSWORD LITELLM_MASTER_KEY LIBRECHAT_JWT_SECRET LIBRECHAT_CREDS_KEY MEILI_MASTER_KEY BASEROW_JWT BASEROW_SECRET AP_JWT_SECRET AP_ENCRYPTION_KEY MOODLE_DB_PASSWORD MOODLE_ADMIN_PASSWORD; do echo "$k=$(openssl rand -hex 32)"; done
# paste values into deploy/.env, set GROQ_API_KEY
cd deploy
docker compose up -d postgres ferretdb meilisearch
docker compose up -d litellm librechat baserow activepieces valkey moodle-db moodle caddy
# optional doc parsing:
docker compose --profile docling up -d docling
docker compose ps
```

Create extra Postgres DBs (once):
```bash
docker compose exec postgres psql -U isa -d isa -c "CREATE DATABASE baserow; CREATE DATABASE activepieces; CREATE DATABASE litellm;"
```

Trust Caddy internal CA for localhost (run on host):
```bash
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt /tmp/isa-root.crt
# Linux: sudo cp /tmp/isa-root.crt /usr/local/share/ca-certificates/isa-root.crt && sudo update-ca-certificates
```

## URLs (localhost, self-signed TLS)
- Chat: https://chat.localhost (LibreChat, ALLOW_REGISTRATION=false — admin creates student account)
- Moodle: https://moodle.localhost (complete web installer, enable web services REST, create courses per /seed)
- Baserow: https://baserow.localhost (create `isa` DB per ../baserow/SCHEMA.md)
- Flows: https://flows.localhost (import ../workflows/*.json)
- Add `127.0.0.1 chat.localhost moodle.localhost baserow.localhost flows.localhost` to /etc/hosts.

## Mem0 wiring (official server compose, not vendored)
```bash
git clone https://github.com/mem0ai/mem0.git /tmp/mem0
cd /tmp/mem0/server && cp .env.example .env  # set OPENAI key + JWT_SECRET
make bootstrap && make up
# In LibreChat UI: Settings > MCP > mem0 URL http://mem0:8888/mcp, connect per-user.
# LibreChat built-in memory is KV-only (no semantic recall) — Mem0 is primary.
```

## Moodle seeding (done 2026-10-05 via tool-native CLIs + REST — reproducible)
# All secrets stay in deploy/.env (gitignored). CSVs in ../seed are data only.
# Bootstrap password in seed/moodle_users.csv ("Bootstrap1!") is rotated immediately after upload.
docker cp ../seed/moodle_courses.csv <moodle-container>:/tmp/moodle_courses.csv
docker cp ../seed/moodle_users.csv <moodle-container>:/tmp/moodle_users.csv
docker compose exec moodle php admin/tool/uploadcourse/cli/uploadcourse.php --mode=createnew --file=/tmp/moodle_courses.csv --delimiter=comma
docker compose exec moodle php admin/tool/uploaduser/cli/uploaduser.php --mode=createnew --file=/tmp/moodle_users.csv --delimiter=comma
for u in student1 student2 isa_reader; do docker compose exec moodle php admin/cli/reset_password.php --username=$u --password="$MOODLE_DEMO_PASSWORD" --ignore-password-policy; done
# Web services + REST are enabled by image default (verified: enablewebservices=1, webserviceprotocols=rest,
# moodle_mobile_app service enabled+unrestricted). Tokens are provisioned per Moodle's own
# webservice/lib.php semantics (32-hex, tokentype permanent, system context) into mdl_external_tokens
# for admin (setup) + isa_reader (read-only: enrolled as student in 6 courses only).
# login/token.php cannot be used headless here (requires https + browser host); UI follow-up may replace these tokens.
# Calendar events: core_calendar_create_calendar_events (explicit instances; do NOT use repeats=N —
# Moodle generates repeats with a +1h DST shift after 2026-10-25 and repeats=N means N total occurrences).
# mod_attendance: install ONLY from official plugin directory zip (Site admin > Plugins > Install). If it requires code patch, STOP per mission rule.
# Real mod_assign activities: core_courseformat_new_module is ajax-only (not callable via REST token) —
# create the 2 assignments in the Moodle UI (course > Add activity); dues already exist as calendar events.

## Health check per phase
```bash
docker compose ps --format "table {{.Name}}\t{{.Status}}"
curl -k https://chat.localhost/api/health || docker compose logs librechat --tail=50
curl -k https://moodle.localhost | head -5
```

## Backup + retention
```bash
docker compose exec postgres pg_dump -U isa isa > backup_isa_$(date +%F).sql
docker compose exec moodle-db pg_dump -U moodle moodle > backup_moodle_$(date +%F).sql
# Volumes pgdata/moodle_db/bas… hold truth. Retain 30 days, student data stays on this server.
# Telemetry off: LiteLLM telemetry:false, Activepieces AP_TELEMETRY_ENABLED=false, Meili NO_ANALYTICS=true.
```

## Gaps / fallbacks applied
- MongoDB (SSPL) replaced by FerretDB eval image per LibreChat+FerretDB docs. Prod split (PG+DocumentDB+FerretDB) is a TODO.
- Moodle has no official prod image; using community ellakcy/moodle unmodified. Fallback: php:8.3-apache + MOODLE_503_STABLE per moodlehq docs.
- getmeili/meilisearch + valkey/valkey used for LibreChat search + Activepieces queue (Redis SSPL avoided).
