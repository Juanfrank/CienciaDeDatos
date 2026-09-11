# Capa de visualizacion — Poder Judicial

Aplicacion web en Azure App Service que sustituye a Power BI como herramienta de reporting
institucional. Implementa el contrato de ingenieria
*Instrucciones para un agente de IA: construccion de la capa de visualizacion en Azure App Service*.

## Estado: Entregable A (*gate*) y Entregable B (Fase de cimiento)

**Entregable A** — los tres artefactos que la seccion 0 exige aprobar antes de implementar
modulos de negocio:

| | Artefacto | Donde |
|---|---|---|
| **A.1** | Diagrama de arquitectura | [`docs/arquitectura/`](docs/arquitectura/README.md) |
| **A.2** | Contrato de conector de datos | [`packages/data-contracts/`](packages/data-contracts/README.md) |
| **A.3** | Estructura de monorepo con limites forzados | este archivo + [`eslint.config.mjs`](eslint.config.mjs) |

**Entregable B** — la Fase de cimiento (seccion 8.1):

| | Frente | Donde | Estado |
|---|---|---|---|
| **B.1** | Infraestructura como codigo | [`infra/`](infra/README.md) | Plantillas Bicep, compilan sin advertencias |
| **B.2** | Identidad y gobierno | [`packages/identity-db/`](packages/identity-db/README.md) | Esquema Prisma valido, mapeadores probados, seed con dos equipos |
| **B.3** | Autenticacion dual | [`packages/auth/`](packages/auth/) | Azure AD + cuentas locales, normalizadas |
| **B.4** | Resolucion de ambito de acceso | [`packages/access-control/`](packages/access-control/) | `resolveEffectiveScope` como funcion pura |
| **B.5** | Cache y camino de lectura | [`packages/caching/`](packages/caching/) | L1/L2, clave con aislamiento, registro de datasets |
| **B.6** | Observabilidad y `/health` | [`docs/observabilidad.md`](docs/observabilidad.md) | Contrato de salud y formas de evento |

Las decisiones estan en [`docs/adr/`](docs/adr/). La mas significativa, y la que requiere
aprobacion explicita, es
[ADR-007: los modulos son librerias, no artefactos de despliegue](docs/adr/ADR-007-modulos-como-librerias-no-como-despliegues.md).

**Lo que queda fuera de esta fase:** el shell de Next.js y los modulos de negocio (editor de
grid, objetos prediseñados, theming, interactividad, panel de administracion), que son Fase 2;
el despliegue real y la prueba de carga, que son Fase 3; y los conectores `Sql`/`Xmla`, que
dependen de lo que entregue la capa de analisis.

## Puesta en marcha

```bash
npm install                 # npm workspaces: enlaza los 13 proyectos
npm run typecheck           # tsc sobre todo el repositorio
npm test                    # vitest: 179 pruebas
npm run lint                # eslint + limites de dependencia, por proyecto
npm run verify:boundaries   # afirma que la regla de limites REALMENTE muerde
npm run verify:schema       # valida el esquema de la base de identidad
npm run verify:infra        # compila las plantillas Bicep (advertencia = fallo)
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
  /identity-db               Esquema Prisma y mapeadores de gobierno               [type:server]
  /auth                      Azure AD + credenciales locales, normalizadas         [type:server]
  /caching                   ICacheStore, clave de cache, camino de lectura        [type:server]
  /observability             Contrato de /health y eventos de auditoria            [type:server]
  /ui-components             Objetos visuales versionados con semver               [type:ui]
  /design-tokens             Tema organizacional                                   [type:util]
  /testing-utils             Utilidades compartidas de prueba                      [type:util]
/infra                       IaC (Bicep)
/docs/adr                    Decisiones de arquitectura
/docs/arquitectura           Diagramas
```

Siguen siendo **marcadores de posicion**, con sus etiquetas de limites ya aplicadas y un
`index.ts` que declara en que fase se llenan: `apps/shell`, `apps/cache-populator`,
`packages/ui-components`, `packages/design-tokens` y `packages/testing-utils`.

> `access-control`, `identity-db`, `observability` y `apps/cache-populator` no figuran en la
> estructura obligatoria de la seccion 3.2. Se añaden porque el documento exige lo que
> contienen sin prever un lugar para ello; cada uno lo justifica en su README o en un ADR.

## Los limites no son una convencion

La regla arquitectonica central del sistema —el navegador nunca habla con la fuente de datos,
y el camino de lectura de una solicitud de usuario nunca invoca el conector— **esta hecha
cumplir por el linter**, no por la disciplina de quien escribe el codigo:

```
type:module  ──✗──>  type:server-data     (un modulo no puede importar un conector)
type:app     ──✗──>  type:server-data     (el shell tampoco)
type:server  ──✗──>  type:server-data     (ni el cache, ni auth, ni /health)
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
