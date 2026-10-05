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

## Moodle seeding
1. Finish web installer at https://moodle.localhost.
2. Site admin > Enable web services + REST protocol, create token.
3. Create courses from ../seed/courses.csv, calendar events from ../seed/timetable.csv, assignments/exam from ../seed/assessments.csv.
4. mod_attendance: install ONLY from official plugin directory zip (Site admin > Plugins > Install). If it requires code patch, STOP per mission rule.

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
