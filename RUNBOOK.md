# RUNBOOK.md — Darion ISA V1

Exact commands for the operations that were performed by hand during the build. Every command
here was run as written against this stack. Nothing here prints a secret: tokens, passwords and
API keys are always read from `deploy/.env` into the environment and referenced as
`$VARIABLE`, never inlined.

Conventions used throughout:

- Run from the repository root `/home/darion-dev/Dev/ISA` unless a `workdir` is given.
- Load secrets without echoing them:
  ```bash
  cd /home/darion-dev/Dev/ISA/deploy && set -a && . ./.env && set +a
  ```
- Never pass `--insecure` or `curl -k`. In-network calls that must reach Baserow use the
  `Host: baserow.localhost` header instead (see §5 for why).
- Save raw output into `tests/evidence_<step>/` as you go.

---

## 1. Moodle web-service token generation

Moodle 5.0 ships **no CLI** for web-service tokens — `admin/cli/` has nothing matching `token`.
The token can only be minted from the Site admin UI (Site administration → Server → Web services
→ Tokens → Add token), which needs an interactive browser session.

For headless setup, the underlying core function was invoked directly. This is the same call the
UI makes, not a new code path:

```bash
# Inside the running moodle container. EXTERNAL_TOKEN_PERMANENT is Moodle's constant (0 = permanent).
docker compose -p darion-isa-v1 exec -T moodle php -r '
define("CLI_SCRIPT", true);
require("/var/www/html/config.php");
require_once($CFG->dirroot . "/lib/externallib.php");
$u = $DB->get_record("user", ["username" => "isa_reader", "deleted" => 0], "*", MUST_EXIST);
$t = external_generate_token(EXTERNAL_TOKEN_PERMANENT, "isar", $u->id, $u->contextid);
echo $t->token, "\n";
'
```

Confirmed signature in the running image:

```
/var/www/html/lib/externallib.php:62:function external_generate_token($tokentype, $serviceorid, $userid, $contextorid, $validuntil = 0, $iprestriction = '')
```

Capture the output straight into `.env` so it is never on a terminal:

```bash
NEW_TOKEN="$(docker compose -p darion-isa-v1 exec -T moodle php -r '...same as above...')"
```

Verify a token works without echoing it (only the HTTP status is printed):

```bash
curl -s -o /dev/null -w 'site_info http=%{http_code}\n' \
  --cacert /home/darion-dev/Dev/ISA/deploy/pki/caddy-root.crt \
  -G "https://moodle.localhost/webservice/rest/server.php" \
  --data-urlencode "wstoken=$MOODLE_ISA_READER_TOKEN" \
  --data-urlencode "wsfunction=core_webservice_get_site_info" \
  --data-urlencode "moodlewsrestformat=json"
```

Expected: `http=200`. A `403` with `webservice_access_exception` means the service is missing the
function; an `invalidtoken` exception means the token does not belong to the intended service.

`--cacert` is **required**, not decorative. Caddy's root is not installed in the host trust store
on this machine (`/usr/local/share/ca-certificates/` does not exist), so curl exits **60** with
`unable to get local issuer certificate` on every `*.localhost` call without it. Do not reach for
`-k` — pass the CA.

**Least privilege.** The token must belong to the dedicated `isar` service and to a user holding
only the `student` role. Audit both. Two schema traps: the role-assignment table is
`mdl_role_assignments` (singular "role"), and `mdl_external_tokens` has **no** `enabled` column.

```bash
DC="docker compose -p darion-isa-v1 -f /home/darion-dev/Dev/ISA/deploy/docker-compose.yml"

$DC exec -T moodle-db psql -U moodle -d moodle -c \
  "SELECT id, name, enabled, restrictedusers, restrictedgroups FROM mdl_external_services WHERE name='isar';"

$DC exec -T moodle-db psql -U moodle -d moodle -c \
  "SELECT DISTINCT r.shortname FROM mdl_user u JOIN mdl_role_assignments ra ON ra.userid=u.id JOIN mdl_role r ON r.id=ra.roleid WHERE u.username='isa_reader';"
```

Expected: `student`, and nothing else. `DISTINCT` matters — Moodle keeps one
`mdl_role_assignments` row per context, so the raw join returns `student` six times. Any other role
means the reader may hold capabilities such as `enrol/manual:enrol`.

Token inventory (values never shown):

```bash
$DC exec -T moodle-db psql -U moodle -d moodle -c \
  "SELECT t.id, u.username, s.name, t.tokentype, t.validuntil, t.lastaccess, t.iprestriction FROM mdl_external_tokens t JOIN mdl_user u ON u.id=t.userid JOIN mdl_external_services s ON s.id=t.externalserviceid;"
```

`tokentype=0` is `EXTERNAL_TOKEN_PERMANENT`; `validuntil=0` means no expiry. Both expected here.

Evidence: `tests/evidence_step4/README.txt`, `tests/evidence_step4/tokens_remaining.txt`.

---

## 2. LibreChat user creation

`ALLOW_REGISTRATION=false` in compose, so the signup route returns 404 and the UI cannot create
users. LibreChat's own image ships `config/create-user.js` for this, and it is the tool used.

```bash
cd /home/darion-dev/Dev/ISA/deploy && set -a && . ./.env && set +a

# ADMIN FIRST. The first user created becomes ADMIN (api/server/services/AuthService.js).
docker compose -p darion-isa-v1 exec -T librechat node config/create-user.js \
  "$LIBRECHAT_ADMIN_EMAIL" "ISA Admin" "admin"

docker compose -p darion-isa-v1 exec -T librechat node config/create-user.js \
  "$LIBRECHAT_STUDENT_EMAIL" "Demo Student" "student1"

docker compose -p darion-isa-v1 exec -T librechat node config/create-user.js \
  "student2@isa.test" "Demo Student Two" "student2"
```

Order is load-bearing. `create-user.js` usage, from the script itself:

```
Usage: npm run create-user -- <email> <name> <username> [--email-verified=false]
Note: if you do not pass in the arguments, you will be prompted for them.
```

Running it with **no arguments** blocks on a prompt and does not exit — it is not a no-op, it
hangs. Always pass all three positional arguments.

Password handling: pass the password only as a trailing argument if a specific one is needed, and
prefer setting it in `.env` and letting the prompt read it. A password typed as argv 4 is visible
in the container's process list for the lifetime of the call.

List what exists, without touching it:

```bash
docker compose -p darion-isa-v1 exec -T librechat node config/list-users.js
```

Verify a login end to end (status only, no tokens echoed). `--cacert` is required here too — see
§1 for why:

```bash
curl -s -o /dev/null -w 'login http=%{http_code}\n' \
  --cacert /home/darion-dev/Dev/ISA/deploy/pki/caddy-root.crt \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$LIBRECHAT_STUDENT_EMAIL\",\"password\":\"$LIBRECHAT_STUDENT_PASSWORD\"}" \
  https://chat.localhost/api/auth/login
```

Expected `http=200`. A 500 mentioning `generateRefreshToken` means `JWT_REFRESH_SECRET` is missing
from `.env` — that was a real committed bug in this stack and is now fixed.

Confirm registration is still closed (`ALLOW_REGISTRATION=false`):

```bash
docker compose -p darion-isa-v1 exec -T librechat printenv ALLOW_REGISTRATION
curl -s -o /dev/null -w 'signup http=%{http_code}\n' \
  --cacert /home/darion-dev/Dev/ISA/deploy/pki/caddy-root.crt \
  -X POST -H 'Content-Type: application/json' -d '{}' \
  https://chat.localhost/api/auth/signup
```

Expected: `false`, then `signup http=404`.

Current users: `admin@isa.test` (username `isaadmin`), `student1@isa.test`, `student2@isa.test`.

Evidence: `tests/evidence_step5/mcp_shim_raw.txt` (login 200 for both students),
`tests/evidence_step4/orphan_audit.txt`.

---

## 3. Removing a stale LibreChat user (`mongosh`)

`config/delete-user.js` **does not work non-interactively**. Its `askQuestion` helper
(`config/helpers.js`) creates a fresh readline per prompt, so piped stdin satisfies only the first
question; the process then exits silently on EOF. Attempting to pipe into it leaves the user in
place and looks like success.

To remove one user document directly:

```bash
cd /home/darion-dev/Dev/ISA/deploy && set -a && . ./.env && set +a

# Get the user id first (from list-users.js output, or by email lookup).
docker compose -p darion-isa-v1 exec -T ferretdb mongosh --quiet \
  "mongodb://${FERRETDB_PG_USER:-ferretuser}:${FERRETDB_PG_PASSWORD}@127.0.0.1:27017/LibreChat?authMechanism=SCRAM-SHA-256" \
  --eval 'db.users.find({email:"USER@HOST"},{email:1,_id:1}).forEach(u=>print(u._id))'
```

Delete it — substitute the literal id, never interpolate a value you have not read back:

```bash
docker compose -p darion-isa-v1 exec -T ferretdb mongosh --quiet \
  "mongodb://${FERRETDB_PG_USER:-ferretuser}:${FERRETDB_PG_PASSWORD}@127.0.0.1:27017/LibreChat?authMechanism=SCRAM-SHA-256" \
  --eval 'printjson(db.users.deleteOne({_id:ObjectId("USER_ID_HERE")}))'
```

Then **prove nothing was orphaned** — deleting a user is only safe if no conversation, file or key
rows reference them:

```bash
# Any collection still holding the deleted id, across every collection in the DB.
docker compose -p darion-isa-v1 exec -T ferretdb mongosh --quiet \
  "mongodb://${FERRETDB_PG_USER:-ferretuser}:${FERRETDB_PG_PASSWORD}@127.0.0.1:27017/LibreChat?authMechanism=SCRAM-SHA-256" \
  --eval '
    const dead = ObjectId("USER_ID_HERE");
    let hits = 0;
    for (const c of db.getCollectionNames()) {
      hits += db.getCollection(c).countDocuments({ user: dead });
      hits += db.getCollection(c).countDocuments({ userId: dead });
      hits += db.getCollection(c).countDocuments({ ownerId: dead });
    }
    print("orphan docs referencing deleted user: " + hits);
    print("collections: " + db.getCollectionNames().length);
  '
```

Also check for uploaded files left on disk:

```bash
docker compose -p darion-isa-v1 exec -T librechat sh -lc 'find /app/uploads -type f 2>/dev/null | wc -l'
```

Expected result for this stack: `orphan docs ... : 0`, `uploads: 0`. The two stale users were
created and removed before any conversation or file data existed, so nothing needed cleaning.

Evidence: `tests/evidence_step4/orphan_audit.txt`.

---

## 4. Caddy root CA mount

Caddy issues internal certificates for the `*.localhost` vhosts using its own root, which no client
trusts by default. That root is exported once into `deploy/pki/caddy-root.crt` and mounted
read-only into every container that calls another `*.localhost` service over TLS. Node reads it
through `NODE_EXTRA_CA_CERTS`, which is the documented mechanism (Activepieces publishes no
general trusted-CA variable; only `AP_POSTGRES_SSL_CA` and `AP_REDIS_CA_FILE`).

Export the root from the running Caddy container:

```bash
cd /home/darion-dev/Dev/ISA/deploy
docker compose -p darion-isa-v1 exec -T caddy cat /data/caddy/pki/authorities/local/root.crt \
  > pki/caddy-root.crt
chmod 644 pki/caddy-root.crt
```

The mount is then declared per-service in `deploy/docker-compose.yml`, in this exact form:

```yaml
      NODE_EXTRA_CA_CERTS: /usr/local/share/ca-certificates/caddy-root.crt
    volumes:
      - ./pki/caddy-root.crt:/usr/local/share/ca-certificates/caddy-root.crt:ro
```

Currently applied to exactly three services: `librechat`, `activepieces` and `activepieces-worker`
(`deploy/docker-compose.yml:172`, `:256`, `:292`).

Verify the export matches what Caddy is actually serving — compare fingerprints, never eyeball
the PEM:

```bash
docker compose -p darion-isa-v1 exec -T caddy cat /data/caddy/pki/authorities/local/root.crt \
  | openssl x509 -noout -fingerprint -sha256
openssl x509 -in pki/caddy-root.crt -noout -fingerprint -sha256
```

Both must print `sha256 Fingerprint=31:94:7D:5D:...:64:AA:DB:F9`.

Then confirm a trusting client actually validates the chain — all four names, from inside
Activepieces:

```bash
docker compose -p darion-isa-v1 exec -T activepieces node -e "
(async () => {
  for (const u of ['https://baserow.localhost/api/health/','https://chat.localhost/',
                   'https://moodle.localhost/','https://flows.localhost/api/v1/health']) {
    try { const r = await fetch(u); console.log(u, 'http=' + r.status); }
    catch (e) { console.log(u, 'FAIL', e.message); }
  }
})()"
```

Observed: `404`, `200`, `200`, `200`. The **404 is correct** — `/api/health/` does not exist on
Baserow 2.4, but reaching a 404 means the TLS handshake completed and the request was routed, which
is the only thing this check is proving. Any `CERT_HAS_EXPIRED`, `UNABLE_TO_VERIFY_LEAF_SIGNATURE`
or `unable to get local issuer certificate` here means `NODE_EXTRA_CA_CERTS` did not take effect:
recreate the container. Do not add a TLS-skip flag.

Do **not** set `auto_https off` in the Caddyfile. It disables certificate issuance outright, and
the symptom is a TLS handshake `internal error` with no leaf certificates at all.

---

## 5. Baserow API verification

Two authentication methods, and the difference matters:

| Operation | Header | Result |
|---|---|---|
| Rows — `/api/database/rows/table/{id}/` | `Authorization: Token $BASEROW_API_TOKEN` | 200 |
| Metadata — `/api/database/tables/`, `/api/database/views/` | `Authorization: JWT <admin jwt>` | 200 |
| Metadata with the database token | — | **401** |

The database token is only wired into views that opt in explicitly
(`baserow/contrib/database/api/tokens/authentications.py`, open-source — no Enterprise licence
needed). Metadata endpoints default to `JSONWebTokenAuthentication`
(`baserow/config/settings/base.py:447`). An invalid token returns the *identical* 401 on metadata
endpoints, proving the header is not consulted there at all.

**The Host header trap.** Baserow's inner Caddy answers **HTTP 200 with an empty body** for any
`Host` other than `baserow.localhost` (`Server: Caddy`, `Content-Length: 0`). That looks exactly
like success and will silently produce empty results. Always send the header.

The `.localhost` names resolve on this host through glibc `myhostname` (they are not in
`/etc/hosts`, which lists only `localhost`), and they resolve to `::1`, matching Caddy's
`:::443` listener. Host-side calls therefore work but **must** carry `--cacert`:

```bash
cd /home/darion-dev/Dev/ISA/deploy && set -a && . ./.env && set +a
DC="docker compose -p darion-isa-v1"

# In-network from inside the container: no CA needed, plain HTTP, but the Host header is required.
$DC exec -T -e TOK="$BASEROW_API_TOKEN" baserow sh -lc '
  curl -s -o /tmp/r.json -w "http=%{http_code} bytes=%{size_download}\n" \
     -H "Host: baserow.localhost" \
     -H "Authorization: Token $TOK" \
     "http://baserow.localhost/api/database/rows/table/815/?user_field_names=true"
  python3 -c "import json;d=json.load(open(\"/tmp/r.json\"));print(\"count=\",d.get(\"count\"))"
'
```

Prove the Host trap is real rather than folklore — wrong Host gives 200 with **zero** bytes, which
reads as success:

```bash
$DC exec -T baserow sh -lc '
  curl -s -o /dev/null -w "correct Host  http=%{http_code} bytes=%{size_download}\n" \
    -H "Host: baserow.localhost" "http://baserow.localhost/api/database/rows/table/815/"
  curl -s -o /dev/null -w "wrong   Host  http=%{http_code} bytes=%{size_download}\n" \
    -H "Host: wrong.localhost"   "http://baserow.localhost/api/database/rows/table/815/"
'
```

Observed: `correct Host http=200 bytes=876` vs `wrong Host http=200 bytes=0`. The empty 200
carries `Server: Caddy`, `Content-Length: 0`.

Run with the token passed in as an environment variable, never interpolated into the shell string:

```bash
docker compose -p darion-isa-v1 exec -T \
  -e TOK="$BASEROW_API_TOKEN" baserow sh -lc '...same as above...'
```

Metadata (views, fields) via an admin JWT:

```bash
docker compose -p darion-isa-v1 exec -T \
  -e EU="$BASEROW_ADMIN_EMAIL" -e EP="$BASEROW_ADMIN_PASSWORD" baserow sh -lc '
  curl -s -X POST -H "Host: baserow.localhost" -H "Content-Type: application/json" \
    -d "{\"email\":\"$EU\",\"password\":\"$EP\"}" \
    "http://baserow.localhost/api/user/token-auth/" -o /tmp/jw.json -w "token-auth http=%{http_code}\n"
  TOKJ=$(python3 -c "import json;print(json.load(open(\"/tmp/jw.json\"))[\"access_token\"])")
  curl -s -H "Host: baserow.localhost" -H "Authorization: JWT $TOKJ" \
    "http://baserow.localhost/api/database/views/table/817/" -o /tmp/v.json -w "views http=%{http_code}\n"
  python3 -c "
import json
d = json.load(open(\"/tmp/v.json\"))
vs = d if isinstance(d, list) else d.get(\"results\", [])
print(\"returned:\", len(vs), \"| any trashed:\", any(v.get(\"trashed\") for v in vs))
for v in vs: print(\"  \", v[\"id\"], v[\"name\"], v[\"type\"])
"'
```

Note: the views endpoint returns **active views only**. Trashed rows are invisible to it, so
"5 views" and "5 active views" are the same statement, and a trashed duplicate is undetectable
over REST. To see the physical truth — total vs active vs trashed — query Postgres, which is
authoritative for existence and counts:

```bash
docker compose -p darion-isa-v1 exec -T postgres \
  psql -U isa -d baserow -c "
    SELECT table_id,
           count(*) FILTER (WHERE trashed) AS trashed,
           count(*) FILTER (WHERE NOT trashed) AS active
    FROM (
      SELECT 815 AS table_id, trashed FROM database_table_815
      UNION ALL SELECT 816, trashed FROM database_table_816
      UNION ALL SELECT 817, trashed FROM database_table_817
      UNION ALL SELECT 818, trashed FROM database_table_818
      UNION ALL SELECT 819, trashed FROM database_table_819
      UNION ALL SELECT 820, trashed FROM database_table_820
    ) t GROUP BY table_id ORDER BY table_id;"
```

Baserow 2.x names physical tables `database_table_<id>`, never by display name. A query that
searches `information_schema` for `students` finds nothing and looks like a missing schema.

Which tables belong to which database:

```bash
docker compose -p darion-isa-v1 exec -T postgres \
  psql -U isa -d baserow -c "SELECT id, name FROM database_table WHERE database_id=256 ORDER BY id;"
```

Evidence: `tests/evidence_stepA/baserow_full_verification.txt`,
`tests/evidence_stepA/baserow_reverify_taskA.txt`.

---

## 6. Emptying the Baserow trash (Task D)

Use Baserow's own trash endpoints — the same calls the UI's **Empty trash** button makes. Do not
`DELETE FROM database_table_*` by hand: the trash tables carry foreign keys and soft-delete flags
that the handler and Celery task expect to own.

Four endpoints matter, all under `api/trash/`, all requiring an admin **JWT** (the database token
returns 401 here, same as on metadata endpoints — see §5):

| Endpoint | Purpose |
|---|---|
| `GET /api/trash/` | trash structure: workspaces, and per-workspace applications with `trashed` flags |
| `GET /api/trash/workspace/{workspace_id}/?application_id={app_id}` | enumerate an application's trash contents |
| `DELETE /api/trash/workspace/{workspace_id}/?application_id={app_id}` | empty it (HTTP 204) |
| `PATCH /api/trash/restore/` | undelete instead — the opposite operation |

**Always scope with `application_id`.** Omitting it targets the whole workspace. On this host,
workspace `155` also holds five trashed duplicate applications (`251`–`255`); a workspace-wide
`DELETE` would have destroyed those too, and they were deliberately to be kept.

Back up first, and prove the dump loads. `deploy/backups/` is root-owned and unreadable by this
user, so use a scratch path and verify by restoring into a throwaway database:

```bash
cd /home/darion-dev/Dev/ISA/deploy && set -a && . ./.env && set +a
DC="docker compose -p darion-isa-v1"

mkdir -p /tmp/opencode/isa-backup
$DC exec -T postgres pg_dump -U isa -d baserow > /tmp/opencode/isa-backup/baserow-pre-trash-empty.dump

# Prove restorability into a scratch DB, then drop it.
$DC exec -T postgres psql -U isa -d postgres -c "CREATE DATABASE baserow_restore_check;"
$DC exec -T postgres psql -U isa -d baserow_restore_check -q -v ON_ERROR_STOP=1 \
  < /tmp/opencode/isa-backup/baserow-pre-trash-empty.dump   # 0 errors
$DC exec -T postgres psql -U isa -d baserow_restore_check -c "SELECT count(*) FROM database_table_815;"
$DC exec -T postgres psql -U isa -d postgres -c "DROP DATABASE baserow_restore_check;"
```

Enumerate, then empty, then verify — as one captured block:

```bash
$DC exec -T -e EU="$BASEROW_ADMIN_EMAIL" -e EP="$BASEROW_ADMIN_PASSWORD" baserow sh -lc '
  curl -s -X POST -H "Host: baserow.localhost" -H "Content-Type: application/json" \
    -d "{\"email\":\"$EU\",\"password\":\"$EP\"}" \
    "http://baserow.localhost/api/user/token-auth/" -o /tmp/jw.json
  python3 -c "import json;print(json.load(open(\"/tmp/jw.json\"))[\"access_token\"])" > /tmp/jwt.txt

  # Enumerate first: rows 1-10 of table 815, views 3512-3523.
  curl -s -H "Host: baserow.localhost" -H "Authorization: JWT $(cat /tmp/jwt.txt)" \
    "http://baserow.localhost/api/trash/workspace/155/?application_id=256" -o /tmp/tc.json
  python3 -c "
import json
d = json.load(open(\"/tmp/tc.json\"))
print(\"count=\", d[\"count\"])
print(\"rows :\", sorted(i[\"trash_item_id\"] for i in d[\"results\"] if i[\"trash_item_type\"]==\"row\"))
print(\"views:\", sorted(i[\"trash_item_id\"] for i in d[\"results\"] if i[\"trash_item_type\"]==\"view\"))
"

  # Then empty, scoped to the application.
  curl -s -o /dev/null -w "DELETE http=%{http_code}\n" -X DELETE \
    -H "Host: baserow.localhost" -H "Authorization: JWT $(cat /tmp/jwt.txt)" \
    "http://baserow.localhost/api/trash/workspace/155/?application_id=256"
'
```

**The 204 does not mean the rows are gone.** `TrashHandler.empty()` only runs
`UPDATE core_trashentry SET should_be_permanently_deleted=True`
(`backend/src/baserow/core/trash/handler.py`). The physical removal is the Celery beat task
`baserow.core.trash.tasks.permanently_delete_marked_trash`, scheduled every
`OLD_TRASH_CLEANUP_CHECK_INTERVAL_MINUTES` (default 5) on the `export` queue. Observed here: 22
items still physically present at t=180s, fully purged at t=210s. Poll instead of assuming:

```bash
for i in $(seq 1 10); do
  sleep 30
  echo "t=$((i*30))s students_trashed=$($DC exec -T postgres psql -U isa -d baserow -tAc \
    "select count(*) filter (where trashed) from database_table_815;")"
done
```

Fingerprint the active rows before and after so a purge can never silently damage live data:

```bash
$DC exec -T postgres psql -U isa -d baserow -tAc \
  "select md5(string_agg(t::text, ';' order by id)) from database_table_815 t where not trashed;"
# Task D: 20d7caec9f313fec064b97f75826d329, identical before and after
```

Evidence: `tests/evidence_taskD_trash_empty.txt`.

---

## 7. Pre-commit secret scan

Run before every commit. CLEAN means no output.

```bash
cd /home/darion-dev/Dev/ISA
git add -A
git diff --cached | grep -nEi \
  '(sk-[A-Za-z0-9]{16,}|AIza[A-Za-z0-9_-]{20,}|gsk_[A-Za-z0-9]{16,}|Bearer [A-Za-z0-9._-]{20,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|postgres(ql)?://[^:$[:space:]]+:[^@$[:space:]]+@|-----BEGIN [A-Z ]*PRIVATE KEY-----|Authorization: Token [A-Za-z0-9]{8,})' \
  && echo 'SCAN_RESULT=MATCHES_FOUND' || echo 'SCAN_RESULT=CLEAN'
```

Whole-history scan:

```bash
git log -p --all | grep -cEi '(sk-[A-Za-z0-9]{16,}|AIza[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)'
```

Expected: `0`.

Known false positives that are safe: `postgres://${PG_USER:?}:${PG_PASSWORD:?}@postgres:5432/…`
in `deploy/docker-compose.yml` — a variable reference, not a literal.

`deploy/.env` is git-ignored (`.gitignore:2`) and must stay that way. Verify:

```bash
git check-ignore -v deploy/.env && stat -c '%a %n' deploy/.env
```

Expected: a `.gitignore` match, and mode `600`.
