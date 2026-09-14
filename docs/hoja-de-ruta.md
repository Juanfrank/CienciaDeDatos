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
- **Politica de contenido completa** (era 2.12). `apps/shell/src/server/csp.ts` construye la
  cabecera con un `nonce` por peticion, fusionada con la politica de enmarcado que ya existia.
  El `nonce` viaja tambien en las cabeceras de ENTRADA (`NextResponse.next({ request })`), que es
  lo que permite a Next firmar sus propios scripts de hidratacion; sin eso la pagina sale en
  blanco y sin error. Lo comprueban `apps/shell/src/server/csp.spec.ts` y, en el navegador,
  `apps/shell/e2e/shell.spec.ts`.
- **El aviso de seguridad de `uuid`** (era 2.13). Se cierra con `overrides` en `package.json`
  —`uuid`, `smol-toml`, `deepmerge-ts`— en vez de bajar `exceljs` de version, que era un cambio
  de API. `npm audit` reporta cero vulnerabilidades.
- **Tamano por defecto de las visualizaciones.** Un objeto entra en la rejilla con la talla que
  su propio contrato de datos sugiere, no con un 6x3 igual para todos.
  `packages/ui-components/src/presentation/defaultSize.spec.ts` recorre el catalogo entero.
- **El cromo de la cuenta y el panel de administracion, reorganizados.** La cabecera tenia cuatro
  controles compitiendo con el arbol; ahora todo lo que no es mirar datos vive en el menu que se
  despliega sobre las iniciales. El panel se agrupa por el OBJETO que se administra —modulos,
  recursos, usuarios, equipos, temas, origenes— en vez de por concepto.
- **Las claves del catalogo de mensajes, al ingles.** Las 253 claves pasaron de
  `accion.guardar` a `action.save`. Los VALORES del catalogo espanol siguen en espanol: son el
  idioma de la aplicacion, no un identificador. El registro de la correspondencia queda en
  `tools/i18n/migrate-keys.mjs`, que ademas se ejecuta con `--check`.
- **Las carpetas, al ingles.** 54 carpetas —rutas del panel, rutas de API, `tools/`, `docs/`, el
  modulo de ejemplo— con su registro en `tools/rename/migrate-folders.mjs`. La excepcion
  deliberada es `/m/[slug]`: es la URL que la gente guarda, incrusta y reparte. El grupo
  `(modules)` que la contiene si se renombro, porque los parentesis lo sacan de la URL.
- **Dos guardas nuevas, cada una probada con el fallo real que la motivo.** `tools/coherence/`
  ata ahora tambien las **rutas de API** —por ahi se colaron cinco roturas de golpe, porque la
  guarda de rutas se saltaba `/api` a proposito— y los **prefijos de clave armados con
  plantilla**: una clave armada con plantilla lleva un `as MessageKey` que apaga el tipo, y por
  ahi el renombrado dejo la paleta del editor dibujando «familia.comparison» como encabezado.
- **Auditoria de seguridad: lo que se arreglo.** El acceso revelaba por el RELOJ que correos
  existen —la rama «esta cuenta no existe» salia sin verificar nada, en microsegundos, frente a
  las decenas de milisegundos que Argon2id tarda a proposito—. Ahora verifica contra un hash de
  relleno y paga el mismo coste; lo mide `packages/auth/src/auth.spec.ts`, que antes del arreglo
  veia 0,17 ms contra 34 ms. Y tres superficies que se cumplian pero que nada MANTENIA quedan
  atadas en `tools/coherence/autorizacion.spec.ts` y `tools/coherence/rutas-de-scripts.spec.ts`.
- **Una prueba que llevaba desde el primer dia sin comprobar nada.** «El registro dice quien, que
  y cuando, no identificadores crudos» seleccionaba `.log__row` en `/admin/audit`, donde esa clase
  no esta, y metia su unica asercion dentro de `if (filas.count() > 0)`. Cero filas, verde
  siempre. Lo que tapaba: las dos pantallas de auditoria mostraban `u-admin` donde deberia ir un
  nombre. Arreglado en las dos, y la prueba ahora provoca el cambio y comprueba las cuatro
  columnas sin condicion.
- **Los recursos, en tabla, con su uso real y su vuelta atras (4.5, 4.10.8).** La lista de
  tarjetas se lee bien de una en una y mal de quince en quince: para comparar «que version corre
  cada uno» habia que recorrerla con el dedo. Ahora es una tabla con acciones por fila —editar,
  que lleva a proponer, y deshabilitar, que quita el objeto de la paleta SIN tocar los modulos que
  ya lo tienen, porque retirar y romper no son lo mismo—.
  La columna de uso decia «12 usos» y ahi se acababa: doce usos en dos modulos que ya corren la
  ultima version no son lo mismo que doce en nueve anclados a una que se retira el mes que viene,
  y la pantalla los dibujaba igual. Ahora dice en cuantos MODULOS, cuantos van atrasados, y lleva
  a una pantalla donde cada fila es un modulo con la version que fija y el boton de subirlo.
- **Subir de version conserva lo configurado.** Es la regla que ordena `bumpInstance`: lo que
  alguien eligio a mano se queda, y SOLO lo que la version nueva anade cae a su valor por defecto.
  Lo nuevo no se rellena con un valor —se queda ausente, que es como el dibujante aplica su
  defecto—, y lo que la version nueva ya no admite se quita pero nunca en silencio: vuelve con su
  valor anterior para que quien sube lo lea antes de confirmar. Sobre un borrador se guarda; sobre
  un modulo publicado se publica una version NUEVA, porque el principio 8 no tiene excepciones.
  Se prueba contra el catalogo real: `tarjeta-kpi` va por 1.2.0 y cada version anadio una clave.
- **Las propuestas del catalogo, como metadato.** El catalogo es codigo y eso no es un accidente
  que corregir: 4.5 exige pruebas en verde y revision por pares, y ninguna de las dos se puede
  afirmar sobre algo tecleado en un formulario. Por eso el permiso del Colaborador es «proponer
  objetos al repositorio» y no «crear objetos». Lo que el panel gobierna es la DECISION: quien
  propuso que version, que cambia, y si se certifica o se devuelve con motivo. El codigo sigue
  llegando por el repositorio.
- **La pestana del navegador decia otra cosa que el encabezado.** El `<title>` del documento se
  quedo en «Capa de visualizacion» —el nombre con el que el contrato describe el sistema por
  dentro— cuando el encabezado paso a nombrarse de cara a la gente. Una pestana que no coincide
  con lo que se ve en pantalla es de las cosas que hacen dudar de si uno esta donde cree.
- **El script de capturas del panel estaba roto de tres formas** y ninguna se notaba, porque un
  script de capturas solo falla cuando alguien lo ejecuta: apuntaba a `/admin/arbol` y a una
  gemela que el renombrado al ingles movio, y entraba llamando a `/api/session/active-team` con
  un `userId`, que es justo lo que 4.7 cerro. Reescrito: entra por la puerta, cubre las veinte
  secciones y siembra una propuesta para que la cola de revision no salga vacia —una captura de
  una pantalla vacia no ensena la pantalla—.
  La guarda de rutas ahora mira tambien bajo `tools/`, y por dos caminos que antes no cubria: los
  archivos `.mts` —el filtro era `/\.tsx?$/`, asi que la carpeta entraba en la lista y salian cero
  archivos— y las URL que viajan en una TABLA en vez de dentro del `goto`, comparando por
  segmentos para que `/m/casos-pendientes` siga casando con `/m/[slug]` mientras `/admin/arbol` no
  casa con nada.
- **La matriz de permisos de 4.10.1, visible (4.10.8).** Estaba escrita, probada y era invisible:
  `MATRIX` es privada de `@app/access-control`, y `capabilitiesOf` no lo llamaba nadie desde
  produccion. Quien administra no tenia forma de ver que puede cada rol. Ahora
  `/admin/users/permissions` la dibuja recorriendo el codigo que DECIDE, no una copia: copiar una
  matriz de permisos a mano es exactamente lo que se queda viejo sin que nadie se entere, y lo que
  mas duele que lo haga. Los roles no se editan ahi, y no es un descuido: el contrato los fija en
  tres y los declara no configurables — la pagina explica, no configura. Una guarda nueva ata cada
  capacidad del tipo `Capability` con su rotulo del catalogo en los dos sentidos: anadir una
  capacidad sin rotulo la dibujaria como `cap.<lo-que-sea>` en la tabla que explica quien puede
  que, y quitarla dejaria el rotulo huerfano.
- **La cola de revision, en el panel y con el cambio delante (4.1).** Aprobar ocurria en
  `/editor`, mezclado con los borradores propios de quien miraba: para revisar una propuesta habia
  que reconocerla entre los suyos, abrirla y acordarse de como estaba antes. Ahora
  `/admin/modules/pending` lista solo lo que espera decision, con quien lo propuso, cuanto lleva
  esperando y **que cambia** respecto a lo publicado —paginas y objetos que entran, salen o
  cambian, por su titulo—. El resumen sale de `diffModules`, que compara por IDENTIDAD y no por
  posicion: comparar por posicion convierte «se movieron dos objetos» en «cambiaron los dos», y un
  resumen que exagera se deja de leer igual que uno que miente.
- **Y el motivo de la devolucion ya no se pide con `window.prompt`.** Era un dialogo del
  navegador: sin etiqueta asociada, sin tema, sin lector de pantalla y bloqueable. La seccion 4.9
  dice que la accesibilidad no es opcional. Ahora es un campo con su `<label>` dentro de la pagina,
  y el boton esta deshabilitado mientras este vacio, que es la misma regla que el servidor exige
  dicha antes de gastar un viaje.
- **Lo publicado se guarda, ya no se pisa (4.5).** El modelo decia versionar desde el primer dia
  —el comentario de `version` dice literalmente que un objeto publicado nunca se modifica, que se
  publica otra version— y lo que hacia el codigo era `modules.save(...)` con
  `version: modulo.version + 1`: sobrescribir, con un contador al lado. La pregunta «¿que veia la
  gente antes del cambio del martes?» no tenia respuesta. Ahora cada publicacion guarda una foto
  completa, el panel las lista en `/admin/modules/<slug>/history` con quien publico cada una, y
  volver atras **publica una version nueva** con el contenido de la vieja en vez de reactivarla,
  que es lo unico que deja el historial legible. Se comprueba ANTES de tocar el almacen: una
  version que hoy no se puede publicar —un campo del esquema que ya no existe— se rechaza sin
  llegar a reemplazar lo que esta vivo, y eso tiene su propia prueba.
- **La siembra de credenciales de demostracion, cerrada con llave.** `asegurarCredenciales()` se
  llamaba en CADA peticion de acceso sin ninguna condicion, y da de alta a todas las cuentas del
  gobierno con la misma contrasena y el mismo secreto TOTP, los dos publicados en este
  repositorio. Ahora hace falta `SEED_DEMO_CREDENTIALS=1`, que ponen `npm run dev` y las pruebas
  de navegador y no pone ningun despliegue. Mirar `NODE_ENV` no habria servido: `next start`, con
  el que corren las pruebas, ES produccion. Lo ata
  `tools/coherence/autorizacion.spec.ts`, que comprueba las dos mitades —que la puerta sale antes
  de escribir nada, y que la llave solo la tienen las superficies de demostracion declaradas—.
- **Lo que la auditoria confirmo sano**, para no volver a mirarlo sin motivo: Argon2id con los
  parametros de OWASP y pimienta separada; sesion opaca de 8 h, revocable, con `httpOnly` y
  `secure` en produccion; el webhook de recarga falla cerrado y compara en tiempo constante; el
  token de restablecimiento son 24 bytes aleatorios, de un solo uso y con caducidad; la descarga
  de una exportacion comprueba de quien es y no toca el disco; la personalizacion toma el usuario
  de la sesion, nunca del cuerpo. `npm audit` da cero vulnerabilidades.

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
restablecimiento desde `/admin/accounts`, la aplicacion le muestra el codigo, y el lo entrega a la
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
tokens. `/api/sign-in` responde 501 con una explicacion en vez de simular un inicio de sesion.

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
credenciales. Lo razonable es un aviso —no un bloqueo— en `/admin/teams` y en
`/admin/accounts`, cruzando quienes administran con el estado de sus cuentas locales.

Mientras tanto, el aviso de "conviene que haya al menos dos" y el procedimiento de acceso de
emergencia cubren el caso.

### 2.9 La consulta en lenguaje natural, retirada de la interfaz

El campo «Pregunte:» esta **oculto**: `VISIBLE_QUERY` en
`apps/shell/src/components/ModuleView.tsx` es `false`. La ruta `/api/query` sigue viva y sus
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

Hoy hay un trinquete: `tools/coherence/i18n.spec.ts` cuenta las cadenas sueltas y falla si suben
del tope. El numero solo puede bajar, y quien migre una cadena baja el tope en el mismo commit.
Empezo en 322 con 53 claves; va por **218 con 290 claves**, y las cuatro pantallas que mas
acumulaban ya no estan entre las peores.

Migrar de golpe es un cambio grande y mecanico. El orden sensato sigue siendo por pantalla,
empezando por las que mas acumulan hoy:
`apps/shell/src/components/CreateNotice.tsx` (13),
`apps/shell/src/components/admin/TreeEditor.tsx` (13),
`apps/shell/app/admin/audit/page.tsx` (12) y
`apps/shell/src/components/admin/LocalAccounts.tsx` (11).

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

### 2.14 Clases de CSS que nadie escribe, y nada lo comprueba

Las guardas de `tools/coherence` atan los atributos `data-*`, los identificadores de prueba, las
rutas y los campos del cable. Falta la que ata **los nombres de clase**: el TSX escribe uno y la
hoja de estilo define otro, y no se entera nadie —el navegador aplica un selector que no encuentra
nada y se queda mudo—.

Medido hoy: **26 clases definidas en `globals.css` que ningun componente escribe** (`editor__*`
del editor anterior, las utilidades `md-*`, `palette__*`) y una docena escritas sin ninguna regla,
la mayoria envoltorios de BEM sin estilo propio, que es legitimo.

La guarda util es la del sentido que no tiene falsos positivos: una regla cuyo nombre no aparece
en ningun componente es CSS muerto. Hace falta antes limpiar las 26, porque un trinquete que nace
rojo no lo mira nadie.

**Media hecha.** El otro sentido —la clase que una PRUEBA usa como selector— ya esta atado en
`tools/coherence/interfaz.spec.ts`, y no nacia rojo. Queda la mitad del CSS muerto, que si lo
hace.

Aun asi no habria bastado para el fallo que lo motivo, y conviene decirlo: la prueba del registro
de auditoria seleccionaba `.log__row`, que EXISTE —en el resumen de `/admin`— mientras la prueba
abria `/admin/audit`, donde la tabla es otra. Clase correcta, pagina equivocada, cero filas, y la
unica asercion metida dentro de un `if (filas.count() > 0)` que nunca se cumplia. La prueba salia
verde desde que se escribio sin mirar nada, y con eso tapaba que las dos pantallas mostraban
`u-admin` en la columna «quien», que es justo lo que decia comprobar que no pasaba. Las dos
pantallas muestran ya el nombre de la persona.

Lo que de verdad falta para esa clase de fallo es una guarda sobre la asercion condicional: un
`expect` dentro de un `if` puede no ejecutarse nunca, y una prueba que no se ejecuta no se
distingue de una que pasa.

**El otro sentido esta medido y duele mas: una clase que el TSX escribe y que NINGUNA regla
estiliza.** Paso durante la cola de revision: los botones de publicar y devolver salieron con
`button-primario` y `button-secundario`, que no existen —las de verdad son `pastilla` y
`boton-contorno`—, y la pagina se dibujo con botones grises del navegador sin que nada fallara.
No lo caza el tipo, ni el lint, ni el navegador: un selector que no casa no protesta.

Medido hoy: **36 candidatos en 17 archivos**, pero la mayoria son falsos positivos del extractor
—un `className={\`x ${cond ? 'a' : 'b'}\`}` arrastra `cond`, `a` y `b` como si fueran clases—.
Los que parecen reales son una docena: `modulo`, `tree__folder`, `admin-home`, `admin-home__log`,
`alerta`, `latido`, `scope-editor`, `ampliaciones`, `pestana`, `opcion`, `valores`, `activo`.

Antes de la guarda hace falta un extractor que entienda las plantillas, porque una guarda con
falsos positivos termina con alguien relajandola. Con eso, las dos mitades de 2.14 se cierran a la
vez: la regla sin TSX es CSS muerto, y el TSX sin regla es un estilo que no se aplica.

### 2.15 No hay forma de crear el PRIMER Administrador en un despliegue real

Lo abre el arreglo anterior, y hay que decirlo claro: cerrar la siembra de demostracion deja un
despliegue sin la variable **sin ninguna cuenta local**. Era lo correcto —lo que sembraba era una
clave publica para toda la institucion— pero ahora falta la otra mitad.

Lo que hace falta es un **comando de operacion**, no una ruta HTTP: una ruta de arranque es una
puerta que queda abierta para siempre y que hay que acordarse de cerrar. El comando crea una sola
cuenta de Administrador, con contrasena aleatoria impresa UNA vez y su propio secreto TOTP, y se
niega a ejecutarse si ya existe alguna credencial local.

Va junto al procedimiento de `docs/operations/acceso-de-emergencia.md`, que describe la situacion
inversa —quedarse sin Administradores— y comparte con este la pregunta de fondo: quien puede
crear el acceso cuando no hay acceso.

Mientras tanto, `npm run dev` y las pruebas de navegador siguen funcionando con la bandera, asi
que esto no bloquea el desarrollo: bloquea el despliegue, que ya estaba bloqueado por 1.4.

### 2.16 La incorporacion en otros portales no funciona fuera del propio dominio

Decidido dejarlo asi, y anotado para que no se redescubra.

La cookie de sesion es `sameSite: 'lax'`. Un navegador NO la manda a un iframe de otro sitio, asi
que un portal externo de verdad no vera datos nunca: vera el mensaje «Se requiere iniciar sesion»,
incluso con la sesion abierta en otra pestana. Lo que SI funciona es el mismo sitio —subdominios
del propio portal—, y la pagina incrustada ya se comporta bien en el caso que no funciona: no
dibuja un formulario de contrasena dentro del marco ajeno, que ensenaria a la gente a escribir su
clave donde no debe, sino un enlace que abre la aplicacion en otra pestana.

Arreglarlo es `sameSite: 'none'`, y eso quita la UNICA proteccion CSRF que hoy tiene la
aplicacion: no hay token anti-CSRF, la proteccion es `lax`. Hacerlo bien es `none` **mas** un
token en todas las escrituras, y es un cambio que toca toda la superficie de escritura.

No se hace hasta que haya un portal externo real que lo pida. Hacerlo antes seria debilitar algo
que funciona para habilitar algo que nadie esta usando.

---

## 3. Revisado y descartado

Se anota para que no se vuelva a proponer sin argumento nuevo.

- **Texto a SQL para la consulta en lenguaje natural.** 4.2 prohibe el SQL libre construido por
  un modulo, y una pregunta traducida a SQL es eso con otro nombre. Ver ADR-011.
- **Un "modo publico" para la vista incrustada.** Se pide en cuanto alguien descubre que el
  iframe no funciona para visitantes anonimos. Que no funcione es el comportamiento correcto:
  una vista incrustada no es una vista publica. Ver ADR-010.
- **Cuenta de emergencia con credenciales guardadas.** Ver
  `docs/operations/acceso-de-emergencia.md`, apartado "Lo que NO se hace".
- **Cachear por usuario para acelerar el camino de lectura.** Multiplica las entradas de cache
  por el numero de personas y rompe 6.6, que pide cachear el dataset una vez y reutilizarlo. El
  ambito se aplica al leer, no al poblar.
