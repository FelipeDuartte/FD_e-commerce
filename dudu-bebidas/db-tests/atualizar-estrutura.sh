#!/usr/bin/env bash
# Copia a ESTRUTURA do banco de teste (tabelas, funções, regras — nenhum
# dado) pro Supabase local dos testes. Rode quando aplicar uma migration
# nova no ambiente de teste. Uso: npm run test:db:estrutura
#
# A URL (com a senha) vem do Supabase do TESTE → Connect → Session pooler.
# Ela é lida escondida e não fica salva em lugar nenhum.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.docker/bin:$PATH"

printf "Cole a URL de conexão do banco de TESTE (fica escondida): "
read -rs DBURL
echo
case "$DBURL" in
  *wkpicpczqdclxlrrwvbe*) ;;
  *) echo "❌ Essa URL não é do ambiente de teste (wkpicpczqdclxlrrwvbe). Nada foi feito." >&2; exit 1 ;;
esac

DESTINO=db-tests/supabase/migrations/00000000000001_estrutura_teste.sql
TEMP=$(mktemp -t estrutura_teste)
trap 'rm -f "$TEMP"' EXIT

# Copia pra um arquivo temporário: se a conexão cair no meio, a cópia
# anterior continua intacta.
if ! npx supabase db dump --db-url "$DBURL" -f "$TEMP"; then
  unset DBURL
  echo "❌ A cópia falhou (veja o erro acima). A estrutura anterior foi mantida." >&2
  exit 1
fi
unset DBURL

if ! grep -q 'CREATE TABLE' "$TEMP"; then
  echo "❌ A cópia veio vazia ou incompleta. A estrutura anterior foi mantida." >&2
  exit 1
fi

mv "$TEMP" "$DESTINO"
echo "✅ Estrutura atualizada. Agora rode: npm run test:db"
