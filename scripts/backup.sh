#!/usr/bin/env bash
# Makes an encrypted copy of the whole database.
# Usage: DATABASE_URL=... BACKUP_PASSPHRASE=... scripts/backup.sh [output-folder]
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL}"; : "${BACKUP_PASSPHRASE:?Set BACKUP_PASSPHRASE}"
out="${1:-backups}"; mkdir -p "$out"
file="$out/bet-$(date -u +%Y-%m-%dT%H%MZ).dump"
pg_dump --format=custom --no-owner --no-privileges --schema=public --dbname="$DATABASE_URL" --file="$file"
gpg --batch --yes --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" --symmetric --cipher-algo AES256 --output "$file.gpg" "$file"
rm -f "$file"
echo "$file.gpg"
