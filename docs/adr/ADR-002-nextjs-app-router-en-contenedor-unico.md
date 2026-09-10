# ADR-002: Next.js App Router en un contenedor Linux unico

- **Estado:** aceptada
- **Fecha:** 2026-09-10
- **Contexto del contrato de ingenieria:** Secciones 4.11 (URL por modulo y filtros en la query string), 5.1 (contenedor Docker), y principio 1 (la aplicacion es el intermediario).

## Contexto

La aplicacion necesita URLs estables por modulo y pagina, con los filtros reflejados en la query string, y necesita un backend propio que sea el unico componente que habla con la fuente de datos. Las alternativas evaluadas fueron una SPA con Vite mas una API NestJS separada, y un backend .NET con frontend React.

## Decision

Se usa **Next.js con App Router**, en un unico contenedor Linux desplegado en App Service. Los *Route Handlers* son la API propia de la aplicacion.

## Consecuencias

- El ruteo por slug y la reconstruccion de estado desde la query string son nativos, no logica de navegacion ad hoc por modulo.
- Un solo artefacto de despliegue: sin CORS entre frontend y backend, sin dos runtimes que mantener.
- **Costo aceptado:** un modulo no puede ser un artefacto de despliegue independiente (ver ADR-007). 
- Se descarta .NET pese a su mejor soporte XMLA nativo, porque los contratos del documento estan escritos en TypeScript y reescribirlos introduciria una traduccion permanente entre el contrato y el codigo.
