#!/usr/bin/env bash
# init-backend.sh — Initialize RESTHeart Cloud backend for Todo Board
# Usage: ./scripts/init-backend.sh <url> <username> <password>
# Example: ./scripts/init-backend.sh https://acac36.eu-central-1-free-1.restheart.com root secret

set -euo pipefail

# ── Args ──────────────────────────────────────────────────────────────────────
if [ "$#" -ne 3 ]; then
  echo "Usage: $0 <restheart-url> <username> <password>"
  echo "Example: $0 https://xyz.restheart.com admin secret"
  exit 1
fi

URL="${1%/}"   # strip trailing slash
USER="$2"
PASS="$3"
AUTH="$USER:$PASS"

echo "→ Initializing RESTHeart backend at $URL"
echo ""

# ── Helper ────────────────────────────────────────────────────────────────────
check() {
  local label="$1"
  local status="$2"
  if [[ "$status" =~ ^2 ]]; then
    echo "  ✓ $label ($status)"
  else
    echo "  ✗ $label failed ($status)"
    exit 1
  fi
}

# ── 1. Collections ────────────────────────────────────────────────────────────
echo "1. Creating collections..."

STATUS=$(http --ignore-stdin PUT "$URL/todos"     -a "$AUTH" -v 2>&1 | grep "^HTTP/" | awk '{print $2}')
check "todos collection" "$STATUS"

STATUS=$(http --ignore-stdin PUT "$URL/swimlanes" -a "$AUTH" -v 2>&1 | grep "^HTTP/" | awk '{print $2}')
check "swimlanes collection" "$STATUS"

STATUS=$(http --ignore-stdin PUT "$URL/_schemas"  -a "$AUTH" -v 2>&1 | grep "^HTTP/" | awk '{print $2}')
check "_schemas store" "$STATUS"

# ── 2. JSON Schema ────────────────────────────────────────────────────────────
echo ""
echo "2. Creating todo JSON schema..."

SCHEMA_FILE=$(mktemp /tmp/todo-schema-XXXX.json)
cat > "$SCHEMA_FILE" << 'EOF'
{
  "_id": "todo",
  "$schema": "http://json-schema.org/draft-04/schema#",
  "type": "object",
  "properties": {
    "title":      { "type": "string" },
    "status":     { "type": "string", "enum": ["open", "in-progress", "blocked", "closed", "closed_and_forgot"] },
    "groupId":    { "type": "string" },
    "swimlaneId": { "type": "string" },
    "assignees":  { "type": "array", "items": { "type": "string" } },
    "notes":      { "type": "string" },
    "tags":       { "type": "array", "items": { "type": "string" } },
    "createdAt": {
      "type": "object",
      "properties": { "_$date": { "type": "number" } },
      "additionalProperties": false
    },
    "closedAt": {
      "type": "object",
      "properties": { "_$date": { "type": "number" } },
      "additionalProperties": false
    }
  },
  "required": ["title", "status", "createdAt"]
}
EOF

STATUS=$(http PUT "$URL/_schemas/todo?wm=upsert" -a "$AUTH" Content-Type:application/json < "$SCHEMA_FILE" -v 2>&1 | grep "^HTTP/" | awk '{print $2}')
check "todo schema" "$STATUS"
rm "$SCHEMA_FILE"

# ── 3. Apply schema to todos collection ───────────────────────────────────────
echo ""
echo "3. Applying schema validation to todos collection..."

STATUS=$(http --ignore-stdin PATCH "$URL/todos" -a "$AUTH" jsonSchema:='{"schemaId":"todo"}' -v 2>&1 | grep "^HTTP/" | awk '{print $2}')
check "schema applied to todos" "$STATUS"

# ── 4. ACL ────────────────────────────────────────────────────────────────────
echo ""
echo "4. Creating ACL rules for role '\$unauthenticated'..."

MONGO_FILTER='{"readFilter":{"groupId":"@qparams['"'"'groupId'"'"']"},"writeFilter":{"groupId":"@qparams['"'"'groupId'"'"']"},"mergeRequest":{"groupId":"@qparams['"'"'groupId'"'"']"}}'

STATUS=$(http --ignore-stdin PUT "$URL/acl/todoUserCRUD" -a "$AUTH" \
  roles:='["$unauthenticated"]' \
  predicate='path-prefix("/todos") and qparams-contain(groupId)' \
  priority:=100 \
  mongo:="$MONGO_FILTER" \
  -v 2>&1 | grep "^HTTP/" | awk '{print $2}')
check "ACL todos" "$STATUS"

STATUS=$(http --ignore-stdin PUT "$URL/acl/todoUserSwimlanes" -a "$AUTH" \
  roles:='["$unauthenticated"]' \
  predicate='path-prefix("/swimlanes") and qparams-contain(groupId)' \
  priority:=100 \
  mongo:="$MONGO_FILTER" \
  -v 2>&1 | grep "^HTTP/" | awk '{print $2}')
check "ACL swimlanes" "$STATUS"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "✓ Backend initialized successfully!"
echo ""
echo "Now update src/app/todo.service.ts and src/app/swimlane.service.ts:"
echo "  BASE URL → $URL"
echo ""
echo "No app user required — access is controlled via the groupId query parameter."
