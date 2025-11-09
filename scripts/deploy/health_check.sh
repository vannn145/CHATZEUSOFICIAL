#!/usr/bin/env bash
set -euo pipefail

BASE="https://sistemazeus.com.br"

curl -fsSL "$BASE/" -o /dev/null && echo "/ => OK" || echo "/ => FAIL"
curl -fsSL "$BASE/privacy" -o /dev/null && echo "/privacy => OK" || echo "/privacy => FAIL"
curl -fsSL "$BASE/health" -o /dev/null && echo "/health => OK" || echo "/health => FAIL"

# Estatísticas
curl -fsS "$BASE/api/messages/appointments/stats" | jq . || echo "stats => FAIL (sem jq?)"