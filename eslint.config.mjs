import nx from '@nx/eslint-plugin';

/**
 * Limites de dependencia entre modulos (seccion 3.1 del contrato de ingenieria).
 *
 * La regla clave es que `type:module` NO puede depender de `type:server-data`.
 * Eso convierte el criterio de aceptacion "ninguna solicitud de un modulo invoca
 * IDataConnector.query() de forma directa" (seccion 9) en un error de linter, no
 * en una convencion que dependa de la disciplina de quien escribe el codigo.
 *
 * `type:app` (el shell de Next.js) tampoco puede depender de `type:server-data`:
 * el camino de lectura de una solicitud de usuario se sirve exclusivamente desde
 * el cache (seccion 6.3), y /health reporta el conector activo leyendo el latido
 * que el job de poblacion deja en el cache, sin instanciar conector alguno.
 * El unico proyecto autorizado a tocar los conectores es `type:job`.
 */
const depConstraints = [
  {
    sourceTag: 'type:module',
    onlyDependOnLibsWithTags: ['type:ui', 'type:contract-types', 'type:lib', 'type:util'],
  },
  {
    sourceTag: 'type:ui',
    onlyDependOnLibsWithTags: ['type:contract-types', 'type:util'],
  },
  {
    sourceTag: 'type:app',
    onlyDependOnLibsWithTags: [
      'type:module',
      'type:ui',
      'type:contract-types',
      'type:lib',
      'type:util',
      'type:server',
    ],
  },
  {
    sourceTag: 'type:job',
    onlyDependOnLibsWithTags: [
      'type:server-data',
      'type:server',
      'type:contract-types',
      'type:lib',
      'type:util',
    ],
  },
  {
    sourceTag: 'type:server',
    onlyDependOnLibsWithTags: ['type:server', 'type:contract-types', 'type:lib', 'type:util'],
  },
  {
    sourceTag: 'type:server-data',
    onlyDependOnLibsWithTags: ['type:contract-types', 'type:util'],
  },
  {
    // `type:ui` incluye `ui-components`, que no es solo React: es el REPOSITORIO de objetos
    // versionados (contratos de datos, semver, politica de deprecacion). La definicion de un
    // modulo referencia objetos por id y version, asi que esta dependencia es legitima y va en
    // esa direccion. Lo que sigue prohibido es la inversa: el repositorio de objetos no puede
    // depender de la definicion de un modulo concreto.
    sourceTag: 'type:lib',
    onlyDependOnLibsWithTags: ['type:contract-types', 'type:ui', 'type:util'],
  },
  {
    sourceTag: 'type:util',
    onlyDependOnLibsWithTags: ['type:util'],
  },
  {
    // Las herramientas verifican el repositorio: comparan lo que una libreria declara contra lo
    // que la aplicacion hace. Para eso tienen que LEER el contrato —el catalogo de objetos, los
    // tipos, los catalogos de texto—, asi que pueden depender de ellos.
    //
    // Lo que no pueden es alcanzar `type:server-data`: el principio 2 vale tambien aqui, y una
    // prueba que abriera la fuente para comprobar algo seria el primer camino de produccion que
    // lo rompe sin que ninguna regla lo note.
    sourceTag: 'type:tooling',
    onlyDependOnLibsWithTags: ['type:ui', 'type:contract-types', 'type:lib', 'type:util'],
  },
];

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  {
    ignores: ['**/node_modules', '**/dist', '**/.nx', '**/.next', '**/out-tsc'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Un parametro prefijado con _ esta deliberadamente sin usar (firmas que deben
      // cumplir una interfaz sin consumir todos sus argumentos).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: false,
          // El segmentador de JSX es uno solo: lo usa el renombrador para no traducir prosa y lo
          // usa la prueba que comprueba que no quedo ninguna traducida. Dos copias acabarian
          // discrepando justo en el caso raro, que es el unico que importa.
          allow: ['../rename/segmentos.mjs'],
          depConstraints,
        },
      ],
    },
  },
];
