#!/usr/bin/env bash
# Roda os testes do banco (pgTAP) no Supabase local — nunca no teste/produção.
# Uso: npm run test:db
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.docker/bin:$PATH" # Docker Desktop instala o comando aqui

if ! docker info >/dev/null 2>&1; then
  echo "❌ O Docker não está rodando. Abra o Docker Desktop e espere \"Engine running\"." >&2
  exit 1
fi
if ! grep -q 'CREATE TABLE' db-tests/supabase/migrations/00000000000001_estrutura_teste.sql 2>/dev/null; then
  echo "❌ A cópia da estrutura do banco está faltando ou vazia. Rode antes: npm run test:db:estrutura" >&2
  exit 1
fi

# Sobe o banco local se ainda não estiver de pé
if ! docker ps --format '{{.Names}}' | grep -q '^supabase_db_dudu-db-tests$'; then
  npx supabase db start --workdir db-tests
fi

# Recria do zero (estrutura + dados de exemplo) e roda os testes
npx supabase db reset --workdir db-tests
npx supabase test db --workdir db-tests
