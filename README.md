# Capa de visualizacion — Poder Judicial

Aplicacion web en Azure App Service que sustituye a Power BI como herramienta de reporting
institucional. Implementa el contrato de ingenieria
*Instrucciones para un agente de IA: construccion de la capa de visualizacion en Azure App Service*.

## Estado: Entregable A (*gate* de la seccion 0)

El contrato prohibe implementar modulos de negocio antes de aprobar tres artefactos. Este
repositorio contiene exactamente esos tres, y nada mas:

| | Artefacto | Donde |
|---|---|---|
| **A.1** | Diagrama de arquitectura | [`docs/arquitectura/README.md`](docs/arquitectura/README.md) |
| **A.2** | Contrato de conector de datos | [`packages/data-contracts/`](packages/data-contracts/README.md) |
| **A.3** | Estructura de monorepo con limites forzados | este archivo + [`eslint.config.mjs`](eslint.config.mjs) |

Las decisiones tomadas estan en [`docs/adr/`](docs/adr/). La mas significativa, y la que
requiere aprobacion explicita, es
[ADR-007: los modulos son librerias, no artefactos de despliegue](docs/adr/ADR-007-modulos-como-librerias-no-como-despliegues.md).

**Siguiente paso: revision y aprobacion de A.1–A.3.** La Fase de cimiento (Entregable B:
infraestructura, identidad dual, resolucion de ambitos, cache) no arranca hasta entonces.

## Puesta en marcha

```bash
npm install          # npm workspaces: enlaza los 11 proyectos
npm run typecheck    # tsc sobre todo el repositorio
npm test             # vitest en todos los proyectos
npm run lint         # eslint + limites de dependencia, por proyecto
npm run verify:boundaries   # afirma que la regla de limites REALMENTE muerde
```

## Estructura

```
/apps
  /shell                     Shell Next.js: navegacion, layout, auth, API          [type:app]
  /modules
    /modulo-ejemplo          Un proyecto por modulo de negocio                     [type:module]
  /cache-populator           Job de poblacion de cache (Azure Function)            [type:job]
/packages
  /data-contracts
    /types                   IDataConnector y tipos puros                          [type:contract-types]
    /server                  Implementaciones: Mock, Sql, Xmla                     [type:server-data]
  /access-control            Arbol de navegacion, equipos, ambitos de acceso       [type:lib]
  /ui-components             Objetos visuales versionados con semver               [type:ui]
  /auth                      Azure AD + credenciales locales                       [type:server]
  /caching                   ICacheStore, BlobCacheStore, registro de datasets     [type:server]
  /design-tokens             Tema organizacional                                   [type:util]
  /testing-utils             Utilidades compartidas de prueba                      [type:util]
/infra                       IaC (Bicep)
/docs/adr                    Decisiones de arquitectura
/docs/arquitectura           Diagramas
```

Salvo `data-contracts` y el modulo de ejemplo, los paquetes son **marcadores de posicion**: el
esqueleto existe con sus etiquetas de limites ya aplicadas, y cada `index.ts` declara en que
entregable se llena.

## Los limites no son una convencion

La regla arquitectonica central del sistema —el navegador nunca habla con la fuente de datos,
y el camino de lectura de una solicitud de usuario nunca invoca el conector— **esta hecha
cumplir por el linter**, no por la disciplina de quien escribe el codigo:

```
type:module  ──✗──>  type:server-data     (un modulo no puede importar un conector)
type:app     ──✗──>  type:server-data     (el shell tampoco)
type:job     ──✓──>  type:server-data     (solo el job de poblacion)
```

`npm run verify:boundaries` lintea a proposito un fixture que viola esa regla y afirma que
falla **por la regla correcta**. Si algun dia la regla se relaja en una migracion de
configuracion, CI se pone rojo en vez de degradarse en silencio.

## Los tres principios que gobiernan el resto

1. **La aplicacion es siempre el intermediario.** El navegador solo habla con la API de esta
   aplicacion. Ninguna excepcion, ni para reducir latencia.
2. **El cache es la unica via de lectura.** Ninguna solicitud de una persona usuaria invoca
   `IDataConnector.query()`. El conector solo se invoca desde el job de poblacion.
3. **Fuente-agnosticismo.** La capa de analisis todavia no existe y su forma final no esta
   decidida. Cambiar de fuente debe ser configuracion, nunca codigo.

## Nota sobre dependencias

`npm audit` reporta advisories de severidad alta en `smol-toml`, dependencia transitiva de
`nx`. Son de **herramienta de desarrollo** y no llegan al artefacto desplegado; la unica via
de correccion que ofrece npm es retroceder a `nx@22`, que no es una correccion. Revisar cuando
`nx` actualice la dependencia.
