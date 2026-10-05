# STEP 3B - compose hardening evidence (all via Caddy CA, no --insecure)

## images pinned by digest
activepieces/activepieces:0.92.1@sha256:d22e3f36f78d70264a020d309aa4535c161ba9ee25eeb783759cde3308cd803a
activepieces/activepieces:0.92.1@sha256:d22e3f36f78d70264a020d309aa4535c161ba9ee25eeb783759cde3308cd803a
baserow/baserow:2.4.0@sha256:f35444dbbbd390c48dae30eaed0b9668b04ff4b71c97d08f9cb2dd436ba22150
caddy:2.11.4@sha256:0c994536bddb66445885237f1a5dcc1916bccea922661c76b4e9fc24061f9b52
ellakcy/moodle:postgresql_apache_500_php8.3@sha256:61b43d191bcbfc12dc6e91683eb6e7c9135e981615c234843eb053762f6fc45f
getmeili/meilisearch:v1.13@sha256:bed3fb650e62da53145777204891159242f6ea4ce69e215b36223af4aa64a0ae
ghcr.io/berriai/litellm:v1.104.0@sha256:625981c83410a3ea68eb0697590a57ec1d764d634514d54fa5db0591077ee839
ghcr.io/ferretdb/ferretdb-eval:2@sha256:1bf47a449dd65839aabfc1a535d1370c98326f8a90de20437eda0aeb30bd8dd5
librechat/librechat:v0.8.7@sha256:c5db3331b845e1f289f8d04c0c77936c4bbe372f76730a804abc1c37e44d23a9
postgres:18.6-alpine@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873
postgres:18.6@sha256:5a5a84b19854a9ffaa54082c166ff4ec27473a361e496e5ea167f298f2da9722
postgres:18.6@sha256:5a5a84b19854a9ffaa54082c166ff4ec27473a361e496e5ea167f298f2da9722
valkey/valkey:8@sha256:640c5e62cea04b6d6f2084232651d0cc70362d31f4f805e7be94dbed6855e8f2

## db-backup output (14-day retention, moodledata volume included)
total 106M   
-rw-r--r--    1 root     root       94.0M Oct  5 19:57 activepieces-2026-10-05.dump
-rw-r--r--    1 root     root        9.5M Oct  5 19:57 baserow-2026-10-05.dump
-rw-r--r--    1 root     root      237.5K Oct  5 19:57 litellm-2026-10-05.dump
-rw-r--r--    1 root     root        1.7M Oct  5 19:57 moodle-2026-10-05.dump
-rw-r--r--    1 root     root          87 Oct  5 19:57 moodledata-2026-10-05.tar.gz

## service states
activepieces	running	Up 28 minutes (healthy)
activepieces-worker	running	Up 28 minutes (healthy)
baserow	running	Up 28 minutes (healthy)
caddy	running	Up 28 minutes (healthy)
db-backup	running	Up 28 minutes
ferretdb	running	Up 28 minutes (healthy)
librechat	running	Up About a minute (healthy)
litellm	running	Up 28 minutes (healthy)
meilisearch	running	Up 28 minutes
moodle	running	Up 28 minutes
moodle-db	running	Up 28 minutes
postgres	running	Up 28 minutes (healthy)
valkey	running	Up 28 minutes
