#!/usr/bin/env bash
# Restores an encrypted backup into a database. Restore into a NEW, empty database first and check it.
# Usage: TARGET_DATABASE_URL=... BACKUP_PASSPHRASE=... scripts/restore.sh backups/bet-....dump.gpg
set -euo pipefail
: "${TARGET_DATABASE_URL:?Set TARGET_DATABASE_URL (the database to restore into)}"; : "${BACKUP_PASSPHRASE:?Set BACKUP_PASSPHRASE}"
in="${1:?Pass the .dump.gpg file}"
tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT
gpg --batch --yes --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" --decrypt --output "$tmp" "$in"
pg_restore --no-owner --no-privileges --clean --if-exists --dbname="$TARGET_DATABASE_URL" "$tmp"
psql "$TARGET_DATABASE_URL" -Atc "select 'enquiries: ' || count(*) from enquiries union all select 'staff: ' || count(*) from staff union all select 'visits: ' || count(*) from sessions"
