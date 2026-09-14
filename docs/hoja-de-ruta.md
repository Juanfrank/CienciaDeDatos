# Hoja de ruta

Lo que queda por hacer, con el motivo por el que no esta hecho. Se ordena por lo que impide, no
por lo que cuesta.

Solo se listan cosas concretas. "Mejorar el rendimiento" no es una entrada; "el editor recarga la
definicion entera en cada cambio" si lo es.

---

## 0. Cumplido desde la ultima revision

Se anota con DONDE esta la prueba, que es lo unico que distingue "hecho" de "creido hecho".

- **Arrastrar y soltar en el editor de modulos** (era 2.1). Asa para mover y esquina para
  redimensionar, con la condicion que se le puso: los dos gestos pasan por la MISMA funcion que
  los botones, asi que no hay dos caminos que puedan divergir. Lo comprueban
  `arrastrar el asa mueve el bloque de columna`, `arrastrar la esquina cambia el ancho` y
  `el arrastre pasa por el MISMO camino que los botones`, en `apps/shell/e2e/canvas.spec.ts`.
- **Adjuntar complementos desde el editor** (era 2.4). `se puede adjuntar un tooltip desde el
  editor`, en el mismo archivo. Ya no hay que escribirlos en la definicion a mano.
- **Tema oscuro encendido** (era 2.6). Lo elige la cookie `tema` (`apps/shell/src/server/theme.ts`)
  y `apps/shell/e2e/dark-contrast.spec.ts` recorre con axe las paginas de modulo, el editor, el
  panel de administracion y la pantalla de restablecer EN OSCURO: dieciseis pruebas, ninguna
  infraccion. Era justo la condicion que se puso para encenderlo —«un tema dark a medias es peor
  que no tenerlo»—, y se cumple.

**2.2 sigue pendiente** aunque dependia de 2.1: el reposicionamiento existe en el editor, no en
el dialogo «Mi vista» de la personalizacion.

---

## 1. Bloqueado por el entorno

No hay nada que decidir: falta un servicio que este entorno no tiene. El diseno esta hecho y el
puerto definido, de modo que lo que falta es la implementacion de una interfaz ya escrita.

### 1.1 Entrega del token de restablecimiento por correo verificado (4.7.2)

**Que pide el contrato.** "Flujo de recuperacion de contrasena por correo verificado, con token
de un solo uso y expiracion corta — nunca envio de la contrasena actual ni de una nueva por canal
no verificado."

**Que hay.** El flujo entero, en `packages/auth/src/passwordReset.ts`: token de 24 bytes
aleatorios, guardado **hasheado** con Argon2id y pimienta, de un solo uso, con quince minutos de
vida. Al canjearse desbloquea la cuenta, aplica la politica de contrasenas, impide reutilizar las
ultimas cinco y **revoca las sesiones abiertas**. Todo ello registrado en el mismo log
consolidado de acceso de la seccion 7.

**Que falta.** El transporte. `IResetChannel` es el puerto; `InstitutionalMailNotAvailable` lo
implementa devolviendo `false` — declarado y no disponible, el mismo patron que los conectores de
datos pendientes y que Azure AD.

**Que se hace mientras tanto.** Un flujo **mediado**: el Administrador tramita el
restablecimiento desde `/admin/cuentas`, la aplicacion le muestra el codigo, y el lo entrega a la
persona por una via en la que haya verificado su identidad. Queda registrado quien lo tramito y
por que canal.

**Por que esto y no un sustituto automatico.** Se descartaron dos:

- *Entregarlo por la bandeja de avisos de la aplicacion.* Absurdo: no se puede leer sin entrar, y
  quien pide un restablecimiento es precisamente quien no puede.
- *Mostrarlo en pantalla a quien lo pide.* Convierte "he olvidado mi contrasena" en "dame acceso
  a esta cuenta". Es peor que no tener recuperacion.

La diferencia entre el flujo mediado y el de correo no es el codigo: es **quien verifica la
identidad**. En el mediado responde una persona; en el de correo responde el control del buzon.
Por eso el mediado no se presenta como equivalente, y la pantalla lo dice.

**Cuando exista SMTP**, se implementa `deliver` y se escoge el canal por configuracion. Nada mas
cambia: la respuesta deja de traer el codigo porque `entregado` pasa a ser `true`.

### 1.2 Azure AD (4.7.1)

`AzureAdIdentityProvider` esta implementado y probado; necesita un tenant contra el que validar
tokens. `/api/acceso` responde 501 con una explicacion en vez de simular un inicio de sesion.

### 1.3 Conectores de datos reales (2.2, fase 4)

`SqlDataConnector` y `XmlaDataConnector` no tienen fuente contra la que probarse. `MockDataConnector`
cumple el contrato y la prueba de agnosticismo de fuente (2.4) comprueba que cambiar de conector
no cambia nada aguas arriba.

### 1.4 Adaptador Azure SQL del gobierno y de la identidad (4.10.7, 6.7)

Los puertos —`GovernanceStore`, `ModuleStore`, `ILocalIdentityStore`, `ISessionStore`,
`IResetStore`— son asincronos precisamente para que una base de datos pueda implementarlos. El
esquema Prisma esta validado y los mapeadores escritos. Falta la base contra la que probarlo.

### 1.5 CDN / Front Door y rate limiting del endpoint de acceso (4.7.2, fase 3)

El *rate limiting* del login que pide 4.7.2 es **independiente del bloqueo de cuenta**, que si
esta implementado: aquel mitiga la fuerza bruta distribuida contra el endpoint, este protege una
cuenta concreta. Vive en Front Door o en App Service, no en el codigo de la aplicacion.

---

## 2. Decisiones de codigo pendientes

Nada las bloquea. Estan aqui porque se identificaron y no se hicieron.

### 2.2 Reposicionamiento en la personalizacion (4.6)

`UserPersonalization` admite `positionOverrides` y `columnOrder`, y `applyPersonalization` los
aplica. El dialogo "Mi vista" solo ofrece ocultar y mostrar. El modelo esta; falta el gesto, y
ya no depende de nada: el gesto existe en el editor (seccion 0) y falta portarlo aqui.

### 2.3 El editor reescribe la definicion entera en cada cambio

Cada casilla marcada manda las paginas completas. Funciona y es simple, pero dos personas
editando el mismo borrador se pisarian —hoy no ocurre porque un borrador es de una sola persona—
y el dia que haya modulos grandes sera caro. La forma correcta es una operacion por cambio, como
`applyTreeOperation` en el arbol.

### 2.5 Paginas multiples en el editor

Un modulo admite varias paginas —el modelo, la validacion y el ruteo `/m/{slug}/{pagina}` estan
hechos— y el editor solo edita la primera.

---

### 2.7 Mas tipos de visualizacion sobre ECharts

`barras` y `lineas` estan sobre ECharts. `mapa` sigue sin implementar —necesita la geometria de
los distritos judiciales, que no esta en el repositorio— y la arquitectura para anadir tipos ya
esta: una funcion pura que construye las opciones, un `tipo` mas en el despachador, y el
respaldo en DOM que corresponda a esa lectura.

Al anadir uno, la pregunta que hay que contestar es **cual es su respaldo accesible**: para las
barras son botones, para las lineas una tabla. No es un detalle de implementacion, es parte de
decidir que significa el objeto.

### 2.8 Comprobar que el ultimo Administrador puede AUTENTICARSE, no solo que existe

`wouldLeaveNoAdministrator` comprueba el gobierno: que alguien conserva el rol. No comprueba que
esa persona pueda entrar. Una cuenta local bloqueada, o alguien cuya cuenta de Azure AD se
desactivo, satisface la invariante mientras la institucion sigue de hecho sin acceso.

Hacerlo bien exige que la comprobacion de gobierno consulte el estado de identidad, y son dos
capas que hoy estan separadas a proposito: `access-control` es `type:lib` y no sabe nada de
credenciales. Lo razonable es un aviso —no un bloqueo— en `/admin/equipos` y en
`/admin/cuentas`, cruzando quienes administran con el estado de sus cuentas locales.

Mientras tanto, el aviso de "conviene que haya al menos dos" y el procedimiento de acceso de
emergencia cubren el caso.

### 2.9 La consulta en lenguaje natural, retirada de la interfaz

El campo «Pregunte:» esta **oculto**: `VISIBLE_QUERY` en
`apps/shell/src/components/ModuleView.tsx` es `false`. La ruta `/api/consulta` sigue viva y sus
pruebas tambien.

El motivo no es que falle, es que responde poco: reconoce medidas y valores del vocabulario del
modulo y devuelve una URL con filtros. Eso es util como cimiento y no es lo que alguien espera al
ver un campo de busqueda encima de sus datos. Un campo visible es una promesa, y quien lo ve
escribe en el.

Para devolverlo hace falta, por este orden:

1. Que entienda comparaciones y periodos («mas que el trimestre pasado»), no solo igualdades.
2. Que conteste sobre la cifra, no solo que filtre la vista.
3. Volver a mirar ADR-011: lo que NO puede hacer es traducir a SQL libre, que 4.2 prohibe. El
   vocabulario tiene que seguir saliendo de lo que quien pregunta ya puede ver, porque ahi esta
   lo que impide que la pregunta se convierta en una puerta trasera al ambito.

Encenderlo es cambiar la constante. Las pruebas de navegador que lo ejercitaban estaban saltadas
y se retiraron: una prueba que no corre se desincroniza en silencio y hay que reescribirla igual
el dia que se reactive. Viven en el historial de git.


### 2.10 El texto visible sale del componente, no del catalogo

`AGENTS.md` lo pone entre las reglas que no se negocian y dice que lo garantiza una prueba. No
habia tal prueba, y la regla lleva incumpliendose casi entera: **53 claves en el catalogo de
`@app/i18n` contra 322 cadenas escritas dentro de 56 componentes**. Solo tres archivos importan el
traductor.

No es cosmetico. Mientras el texto viva en el componente, la aplicacion no puede cambiar de
idioma —que es lo que el propio paquete existe para permitir—, cada cadena repetida en dos
pantallas puede discrepar, y nada impide que una palabra en ingles se cuele donde una persona la
lea. Ha pasado cinco veces durante el renombrado.

Hoy hay un trinquete: `tools/coherencia/i18n.spec.ts` cuenta las cadenas sueltas y falla si suben
de 322. El numero solo puede bajar, y quien migre una cadena baja el tope en el mismo commit.

Migrar de golpe es un cambio grande y mecanico. El orden sensato es por pantalla, empezando por
las que mas acumulan: `Presentation.tsx` (55), `EditorObjectSettings.tsx` (22), `SidebarPanel.tsx`
(17), `ModuleList.tsx` (15).

### 2.11 Las propiedades siguen en espanol

El renombrado al ingles cubrio declaraciones, archivos, clases CSS e identificadores de prueba.
Se dejo fuera, sin darse cuenta, la clase mas leida desde fuera: **las propiedades**. Son 167
nombres distintos en 478 sitios —`definicion.dimensiones`, `instancia.presentacion`, `objeto.
titulo`—, y hasta ahora el detector ni siquiera las miraba porque solo buscaba declaraciones.

Ahora `node tools/rename/detect.mjs` las cuenta. Renombrarlas NO es equivalente a lo ya hecho: la
definicion de un modulo se guarda como JSON en el almacen, asi que las claves estan en disco. Un
renombrado sin migracion deja de leer los modulos ya guardados.

Hace falta, por ese orden:

1. Una migracion que lea la forma vieja y escriba la nueva, con su prueba sobre un fixture real.
2. El renombrado, paquete a paquete, como los anteriores.
3. Una guarda que compare las claves del JSON guardado con las del tipo, que es el contrato que
   hoy no ata nadie.

### 2.12 Politica de contenido (CSP) completa

El middleware pone ya `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y, en
produccion, `Strict-Transport-Security`. Falta la CSP de verdad —`default-src 'self'`—, que es la
que haria CUMPLIR el principio 1 en vez de solo comprobarlo con una prueba de navegador.

No se hizo ahora porque no es un cambio sin riesgo: ya existe una CSP parcial para el enmarcado
(`frame-ancestors`, en `embedding.ts`) con la que habria que fusionarla, y Next necesita `nonce`
por peticion para sus scripts de hidratacion. Una CSP mal puesta no avisa: deja la pagina en
blanco.

### 2.13 `exceljs` arrastra un `uuid` con aviso de seguridad

`npm audit` reporta dos avisos moderados, los dos del mismo sitio: `exceljs` depende de una
version de `uuid` sin comprobacion de limites del buffer. `npm audit fix --force` baja `exceljs`
a la 3.4.0, que es un cambio de API.

El alcance real aqui es pequeno —el `uuid` afectado se usa al escribir un libro, con datos que ya
pasaron por la proyeccion, y el fallo necesita que quien llama pase un buffer propio—, pero el
aviso se queda hasta que `exceljs` publique una version con el `uuid` corregido o se cambie de
libreria para el formato Excel.

---

## 3. Revisado y descartado

Se anota para que no se vuelva a proponer sin argumento nuevo.

- **Texto a SQL para la consulta en lenguaje natural.** 4.2 prohibe el SQL libre construido por
  un modulo, y una pregunta traducida a SQL es eso con otro nombre. Ver ADR-011.
- **Un "modo publico" para la vista incrustada.** Se pide en cuanto alguien descubre que el
  iframe no funciona para visitantes anonimos. Que no funcione es el comportamiento correcto:
  una vista incrustada no es una vista publica. Ver ADR-010.
- **Cuenta de emergencia con credenciales guardadas.** Ver
  `docs/operacion/acceso-de-emergencia.md`, apartado "Lo que NO se hace".
- **Cachear por usuario para acelerar el camino de lectura.** Multiplica las entradas de cache
  por el numero de personas y rompe 6.6, que pide cachear el dataset una vez y reutilizarlo. El
  ambito se aplica al leer, no al poblar.
