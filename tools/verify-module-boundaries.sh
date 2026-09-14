#!/usr/bin/env bash
#
# Verifica que la regla de limites de dependencia de la seccion 3.1 realmente muerde.
#
# El lint normal (`nx run-many -t lint`) excluye el fixture negativo, porque su proposito
# es fallar. Este script lo lintea a proposito y AFIRMA dos cosas: que falla, y que falla
# POR LA REGLA CORRECTA. Si algun dia la regla se relaja o se pierde en una migracion de
# configuracion, esto se pone rojo en CI en vez de degradarse en silencio.
#
# Cubre el criterio de aceptacion de la seccion 9:
#   "Ninguna solicitud de un modulo, disparada por una persona usuaria, invoca
#    IDataConnector.query() de forma directa."
set -uo pipefail

FIXTURE="apps/modules/sample-module/src/__boundary-fixture__/forbidden-import.ts"
REGLA="@nx/enforce-module-boundaries"

echo "==> Linteando el fixture negativo: $FIXTURE"
SALIDA="$(npx eslint "$FIXTURE" --no-ignore --format json 2>/dev/null)"
CODIGO=$?

if [ "$CODIGO" -eq 0 ]; then
  echo "FALLO: se esperaba un error de limites de dependencia y el lint paso limpio."
  echo "       La regla $REGLA ya no protege el limite type:module -> type:server-data."
  exit 1
fi

MENSAJE="$(SALIDA="$SALIDA" REGLA="$REGLA" node -e '
  const resultados = JSON.parse(process.env.SALIDA || "[]");
  const regla = process.env.REGLA;
  const hallazgo = resultados
    .flatMap((r) => r.messages || [])
    .find((m) => m.ruleId === regla && m.severity === 2);
  if (hallazgo) console.log(hallazgo.message);
')"

if [ -z "$MENSAJE" ]; then
  echo "FALLO: el lint fallo, pero no por $REGLA."
  echo "$SALIDA"
  exit 1
fi

echo "OK: la regla $REGLA rechaza la importacion prohibida como se espera."
echo "    -> $MENSAJE"
exit 0
