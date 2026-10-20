#!/usr/bin/env bash
# Prueba las migraciones en un PostgreSQL local desechable (Docker).
# No toca Supabase. Uso: npm run test:sql   (requiere Docker en ejecución)
#
# Orden: imitación de Supabase -> migraciones 0001..0004 -> datos "existentes"
#        -> 0005 (sobre esos datos) -> pruebas de la Etapa 2 -> más datos "existentes"
#        -> 0006 (sobre esos datos) -> pruebas de deudas, bancos e inversiones
#        -> 0007 -> pruebas de reglas de categorización -> 0008 -> pruebas de dividir movimientos.
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE="${PG_IMAGE:-postgres:17-alpine}"
NAME="finanzas-pg-test-$$"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
for _ in $(seq 1 60); do
  docker exec "$NAME" pg_isready -U postgres -q 2>/dev/null && break
  sleep 1
done
sleep 1

run() {
  echo "-> $1"
  docker exec -i "$NAME" psql -X -q -U postgres -v ON_ERROR_STOP=1 --no-psqlrc -f - < "$1" 2>&1 \
    | sed -e 's/^psql:<stdin>:[0-9]*: //' -e 's/^NOTICE:  //'
  return "${PIPESTATUS[0]}"
}

run supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/000[1-4]_*.sql; do run "$f"; done
run supabase/tests/10_data_before_0005.sql
run supabase/migrations/0005_etapa2.sql
run supabase/tests/20_etapa2.sql
run supabase/tests/25_data_before_0006.sql
run supabase/migrations/0006_deudas_inversiones.sql
run supabase/tests/30_deudas_inversiones.sql
run supabase/migrations/0007_reglas.sql
run supabase/tests/40_reglas.sql
run supabase/migrations/0008_dividir.sql
run supabase/tests/50_dividir.sql
