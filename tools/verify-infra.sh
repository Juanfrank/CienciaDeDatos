#!/usr/bin/env bash
#
# Compila las plantillas Bicep y trata CUALQUIER advertencia como error.
#
# Importa porque una propiedad mal ubicada en Bicep no hace fallar el despliegue: se ignora en
# silencio. Ya ocurrio una vez en este repositorio —clientAffinityEnabled dentro de siteConfig,
# donde no aplica— y ARR affinity nunca se habria activado sin que nadie lo notara.
set -euo pipefail

BICEP="${BICEP:-bicep}"
if ! command -v "$BICEP" >/dev/null 2>&1; then
  echo "No se encontro el compilador de Bicep. Instalalo o exporta BICEP=/ruta/al/binario."
  echo "  curl -sL -o bicep https://github.com/Azure/bicep/releases/latest/download/bicep-linux-x64"
  exit 127
fi

echo "==> Compilando infra/main.bicep"
SALIDA="$("$BICEP" build infra/main.bicep --stdout 2>&1 >/dev/null)"

if [ -n "$SALIDA" ]; then
  echo "FALLO: Bicep emitio advertencias."
  echo "$SALIDA"
  exit 1
fi

echo "OK: las plantillas compilan sin advertencias."
