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
- **El editor guarda cuando alguien se lo pide (4.2).** Cada gesto —anadir un objeto, mapear un
  campo, mover una caja— escribia en el almacen, y el lienzo se dibujaba con lo que devolvia esa
  escritura: el dibujo era un efecto secundario de guardar. Con eso no habia forma de probar una
  idea y desecharla, porque lo probado ya estaba guardado y «descartar» significaba deshacer a
  mano. Ahora el borrador vive en el editor y hay tres botones: guardar borrador, descartar y
  enviar a aprobacion — mas «aprobar y publicar» para quien puede, que va fuera de la puerta de
  edicion porque quien revisa una propuesta no la esta editando.
  Separar las dos cosas exigio poder dibujar sin escribir: `POST /api/modules/<slug>/preview`
  devuelve diagnosticos, cerraduras y objetos sin tocar el almacen. Y exigio que el editor diga
  cuando esta al dia y no solo cuando guarda: `data-drawing` existe porque, con el guardado
  explicito, `data-saving` es casi siempre «no» y las pruebas que lo miraban dejaron de esperar
  nada. Ahora hay una prueba de lo que antes no se podia ni escribir: que lo NO guardado no
  sobreviva.
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
- **Un tema pasa a ser la identidad visual COMPLETA, y hay un segundo de fabrica.** Antes un tema
  eran tres colores de origen y punto: la letra, los tamanos, los radios y la sombra eran
  constantes globales que compartian todos, asi que lo que se servia como «tema institucional» era
  en realidad «esos tres colores mas lo que quedara en cuatro constantes». Ahora un tema declara
  seis colores —los tres de marca y los tres semanticos— y seis ejes de estilo, cada uno sobre un
  conjunto CERRADO (`typeface`, `typeScale`, `cornerRadius`, `borderTone`, `shadowShape`,
  `shadowTint`). Cerrado
  por dos razones que valen para todos: una letra es un archivo que hay que servir desde el propio
  origen —el principio 1 no admite pedirsela a un dominio ajeno— y el valor termina en una
  variable CSS, donde una cadena libre es superficie de inyeccion.
  - **Los dos semanticos que no existian.** El exito se pintaba con `secondary` —un AZUL— y la
    advertencia con `tertiary`, que en el tema institucional es el rojo de la norma. Es decir: «va
    bien» salia azul y «ojo con esto» salia igual que un error. Ahora son roles propios de la
    paleta MD3, con sus ocho tokens y sus parejas de contraste, y lo consumen `.notice-ok`,
    `.notice-atencion` y el delta de un indicador.
  - **El tema institucional, escrito entero.** Declara sus seis ejes aunque casi todos sean el
    valor por omision: un tema de fabrica es la referencia que se copia, y lo que no diga no se
    hereda, se adivina. Cambian dos cosas de como se veia: el verde y el ambar —que antes no eran
    ni verde ni ambar— y los radios, que pasan a los tres de la norma (8, 12 y pastilla). Lo
    segundo es lo unico de este tema que NO sale de la especificacion, y sale de lo que la
    institucion ya tiene en pantalla: sus tableros no llegan a los 28 px que Material reserva para
    un dialogo, y un dialogo mucho mas redondeado que la tarjeta que lo abre no se lee como
    jerarquia, se lee como otra aplicacion.
  - **«Linea grafica», el segundo.** La capa visual de la linea grafica del tablero de casos
    penales: azul de accion, el rojo de la norma como acento, gris azulado, su verde y su ambar,
    Poppins en escala compacta —que jerarquiza por peso y no por tamano—, tres radios, borde tenue
    y sombra difusa con tinte de marca. Dos apartes deliberados de la guia, los dos cerrados y
    anotados abajo: su morado de «Acento secundario» no entra, y sus componentes y reglas de
    maqueta tampoco —un tema decide como se VE la aplicacion, no que objetos existen—.
  - **El borde se copio por CONTRASTE, no por hexadecimal.** `--line: #e3e8f3` sobre blanco da
    1,23; la derivacion de Material a tono 80 daba 1,70, que es la diferencia entre una tarjeta
    perfilada y una enmarcada. El eje `borderTone` mueve el tono de `outlineVariant` al 92, que da
    1,23 exacto. Solo toca el borde DECORATIVO: el de los campos y los botones (`outline`) no lo
    mueve ningun tema, porque ahi el borde no adorna —dice donde se puede escribir— y 1.4.11 le
    exige 3:1.
  - **Lo comprueba** `packages/design-tokens/src/graphicLineTheme.spec.ts` — veinticinco pruebas:
    AA en los dos modos por las dos listas, la letra, que la escala no se cruce, los tres radios
    en los dos temas, que la escala de Material siga siendo la de quien no dice nada, el borde por
    contraste, que el de los controles no se mueva, la forma de la sombra, que en oscuro pierda el
    tinte, que un tema de acento morado pueda declarar su rojo, que el exito sea verde en los DOS
    temas, y que ninguno deje un eje sin declarar.
  - **Y lo puede expresar la pantalla.** El dialogo de crear tema ofrece los tres semanticos y los
    seis ejes, y parte del tema institucional REAL en vez de una copia escrita en el componente
    —que ya se habria quedado vieja hoy mismo, ofreciendo los siete radios de Material como «lo
    que ya hay»—. El panel ensena la especificacion completa de cada tema. Un tema que solo se
    pudiera escribir tocando el codigo convertiria el panel en la forma facil de administrar en
    vez de en la forma de administrar.

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

### 2.2 Reposicionamiento en la personalizacion (4.6) — HECHO

`UserPersonalization` admitia `positionOverrides` y `applyPersonalization` los aplicaba; el
dialogo «Mi vista» solo ofrecia ocultar y mostrar. El modelo estaba; faltaba el gesto.

Portado del editor, no reescrito: `Reorganizar.tsx` usa el MISMO `useDrag` y las mismas clases del
lienzo. Dos arrastres distintos acaban divergiendo, y el que se usa menos es el que se rompe. Para
que el arrastre pueda medir, el modo dibuja la rejilla con filas de alto fijo y colocacion
absoluta —la del editor—; al guardar se vuelve a la del visor.

El teclado hace lo mismo sobre la misma operacion: las flechas mueven, Mayus con las flechas
redimensiona, y la etiqueta accesible dice columna y fila despues de cada movimiento. La prueba de
navegador va por ahi a proposito: el camino del teclado es el que se rompe sin que nadie lo note.

Dos cosas cambiaron en el servidor y las dos importan:

1. `savePersonalization` ahora cambia **solo lo que se envia**. Ocultar y colocar son gestos en
   pantallas distintas y ninguna conoce lo de la otra —la que coloca no puede enumerar los objetos
   ocultos porque ya no los ve—, asi que reescribir el registro entero convertia dos gestos
   independientes en uno destructivo.
2. Se valida la disposicion **resultante**, no cada posicion suelta: puesta encima de otra, una
   posicion es valida por si misma y la vista queda rota. Pero solo se rechaza lo que la
   personalizacion ROMPE: un modulo publicado con objetos pisandose es problema de quien lo
   publico, y bloquear por eso quitaria justamente la herramienta con la que apartarlos.

`columnOrder` sigue sin gesto: el orden de columnas de una tabla es una superficie distinta y se
hara con el resto de la personalizacion de tablas.

### 2.3 El editor reescribe la definicion entera en cada cambio — HECHO

Cada casilla marcada mandaba las paginas completas. Funcionaba y era simple, y tenia dos problemas
que no se ven con un modulo pequeno y una sola persona: dos personas sobre el mismo borrador se
pisan, y el coste crece con el modulo en vez de con el cambio.

`applyModuleOperation` en `packages/module-model/src/moduleOperations.ts`, con la misma forma que
`applyTreeOperation` en el arbol y por el mismo motivo: es PURA y vive en el modelo, de modo que
el editor y el servidor aplican exactamente lo mismo. Dos implementaciones —una para dibujar y
otra para guardar— acaban difiriendo, y la diferencia aparece como «lo que veia no es lo que se
guardo».

Siete operaciones: anadir, renombrar y quitar pagina; anadir, quitar y reemplazar objeto; y mover,
que va aparte porque es la mas frecuente —cada arrastre— y lleva cuatro numeros en vez de la
instancia entera.

Lo que arregla el pisarse es DONDE se aplican: `saveDraft` las aplica sobre el borrador GUARDADO,
no sobre la foto que el editor tenia en pantalla. Dos cambios sobre cosas distintas se componen.
Una tanda es todo o nada y un rechazo es 409 —un conflicto, no una averia—, con el numero de la
operacion que fallo, porque «no se pudo guardar» sobre una tanda de seis no dice donde mirar.

`paginas` sigue aceptandose, y no es un descuido: reemplazar el borrador entero es exactamente lo
que hacen restaurar una version del historial, sembrar un modulo de prueba y el boton de descartar
del editor —volver al punto de retorno es declarar un estado, no una secuencia de cambios—.
Mandar las dos cosas a la vez se rechaza: no hay forma de saber cual gana.

Verificado enrojeciendo la acumulacion entre operaciones y el todo-o-nada.

### 2.5 Paginas multiples en el editor — CERRADO

El editor abre todas las paginas, y las crea, rebautiza y quita desde la barra que hay sobre el
lienzo. Eran tres cables y no uno: elegir la pagina, que el cambio caiga en la ABIERTA —`conItems`
escribia en `paginas[0]` fijo— y que `/preview` sepa cual dibujar, porque devolvia siempre la
primera y los bloques de las demas salian vacios.

---

### 2.7 Mas tipos de visualizacion sobre ECharts

`barras` y `lineas` estan sobre ECharts. `mapa` sigue sin implementar —necesita la geometria de
los distritos judiciales, que no esta en el repositorio— y la arquitectura para anadir tipos ya
esta: una funcion pura que construye las opciones, un `tipo` mas en el despachador, y el
respaldo en DOM que corresponda a esa lectura.

Al anadir uno, la pregunta que hay que contestar es **cual es su respaldo accesible**: para las
barras son botones, para las lineas una tabla. No es un detalle de implementacion, es parte de
decidir que significa el objeto.

### 2.8 Comprobar que el ultimo Administrador puede AUTENTICARSE, no solo que existe — HECHO

`wouldLeaveNoAdministrator` comprueba el gobierno: que alguien conserva el rol. No comprueba que
esa persona pueda entrar. Una cuenta local bloqueada, o alguien cuya cuenta de Azure AD se
desactivo, satisface la invariante mientras la institucion sigue de hecho sin acceso.

Resuelto como **aviso y no como bloqueo**, que era lo razonable: `accesoDeQuienesAdministran` en
`apps/shell/src/server/admin.ts` cruza quienes administran con el estado de sus cuentas locales y
lo muestra el componente `AdminAccess` en `/admin/teams` —junto a quienes administran— y en
`/admin/users` —junto al estado de las cuentas—. Vive en el shell y no en `access-control` porque
ese paquete es `type:lib` y no sabe nada de credenciales, a proposito.

Bloquear habria sido prometer mas de lo que se comprueba: desde dentro solo se ve la cuenta local,
y que una identidad de Azure AD siga activa lo sabe Azure. Rechazar un cambio sobre media
comprobacion dejaria a quien administra sin poder reorganizar nada por una cuenta que quiza si
funciona. Lo que SI se ve entero es el caso 2 del procedimiento de emergencia —Azure AD deja de
responder y ninguno de los que administran tiene cuenta local—, y ese es el aviso.

Tres impedimentos, los tres comprobables: sin cuenta local, cuenta bloqueada, y cuenta sin segundo
factor —4.7.2 lo exige, asi que una cuenta sin TOTP no es utilizable—. La gravedad es `grave` si
ademas no hay federacion configurada, porque entonces nadie puede entrar de ninguna forma.

Se comprobo enrojeciendo la comprobacion de cuenta bloqueada, que es el caso que da nombre al
apartado.

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
habia tal prueba, y la regla llevaba incumpliendose casi entera: **53 claves en el catalogo de
`@app/i18n` contra 322 cadenas escritas dentro de 56 componentes**. Solo tres archivos importaban
el traductor.

No es cosmetico. Mientras el texto viva en el componente, la aplicacion no puede cambiar de
idioma —que es lo que el propio paquete existe para permitir—, cada cadena repetida en dos
pantallas puede discrepar, y nada impide que una palabra en ingles se cuele donde una persona la
lea. Ha pasado cinco veces durante el renombrado.

Hay un trinquete: `tools/coherence/i18n.spec.ts` cuenta las cadenas sueltas y falla si suben del
tope. El numero solo puede bajar, y quien migre una cadena baja el tope en el mismo commit.

Va por **54**, desde las 322 del principio. Han pasado enteras al catalogo la crema del modulo con
«Mi vista», el registro de auditoria, las reglas de color, los objetos, la bandeja de avisos y su
creacion, «quien ve que», la tabla de datos de origen, el editor de ambitos, las lineas de
referencia y el restablecimiento de contrasena. Ninguna pantalla acumula ya mas de tres.

Sigue abierto porque cincuenta y cuatro no es cero, pero lo que queda ya no son pantallas: son
palabras sueltas repartidas de tres en tres, y algun falso positivo de la propia guarda —la
expresion regular de la prosa cuenta como texto una condicion de JSX escrita en linea—. Donde han
aparecido, la condicion se ha extraido a una constante con nombre: se lee mejor y ademas deja de
contarse. Relajar la expresion regular seria peor, porque se comeria texto de verdad.

Dos erratas del renombrado salieron a la luz al migrar, y estan corregidas en el catalogo:
«Anadir colorRule de color» y «Ver dataRows».

### 2.11 Las propiedades siguen en espanol — EN CURSO, con lo que bloqueaba ya resuelto

El renombrado al ingles cubrio declaraciones, archivos, clases CSS e identificadores de prueba. Se
dejo fuera, sin darse cuenta, la clase mas leida desde fuera: **las propiedades**. `node
tools/rename/detect.mjs` ya las cuenta.

Renombrarlas NO es equivalente a lo ya hecho, y ese es el punto entero: la definicion de un modulo
se guarda como JSON en el almacen, asi que las claves estan **en disco**. Renombrar una propiedad
en el tipo compila perfectamente —el JSON es `unknown` para el compilador— y deja de leerse el
campo en todos los modulos que ya existen. No hay error ni prueba roja; lo que hay es un grafico
que sale sin formato y nadie sabe por que.

**Hecho lo que bloqueaba:**

1. **La migracion**, `packages/module-model/src/migrateDefinition.ts`. Una tabla de renombrados,
   cada uno con la RUTA donde vive la clave —`tipo` aparece en sitios que quieren decir cosas
   distintas, y renombrarlos todos porque se llaman igual es el error que una migracion tiene que
   no cometer—. Se aplica al LEER, en `moduleStore`, y tambien sobre el historial, que es de donde
   sale lo que se restaura. Es idempotente, asi que se queda puesta en vez de borrarse «cuando ya
   no haga falta», que es una fecha que nadie decide. Su prueba corre sobre un fixture con la
   estructura real: paginas, objetos, instancias y complementos anidados.
2. **La guarda**, `tools/coherence/claves-guardadas.spec.ts`. Ata lo que hoy no ataba nadie: una
   clave ya renombrada no se puede volver a escribir con su nombre viejo en ningun archivo —ni la
   semilla, ni una prueba, ni un componente—, porque lo que se escriba asi nace ya invisible para
   el codigo que lo lee. Busca la clave escrita COMO CLAVE y no la palabra suelta: la aplicacion
   habla espanol y su prosa esta llena de la palabra. Verificada enrojeciendo con la clave vieja
   devuelta a la semilla.
3. **El primer renombrado, de punta a punta:** `presentacion` -> `presentation`, la mas leida de
   todas —vive en la instancia de cada objeto y en la de cada complemento adjuntado—. 24 archivos,
   con las tres suites de navegador en verde.

**Lo que queda** son **106 claves** mas en `ui-components` y `module-model` —`icono`, `acento`,
`etiqueta`, `leyenda`, `apilado`, `medidor`…—. Es trabajo mecanico, y ahora es trabajo mecanico
SEGURO: cada tanda es una fila en la tabla, una pasada de `tools/rename/renombrar.mjs` y la guarda
diciendo si quedo algo sin mover. Conviene ir por grupos que se leen juntos —el formato de cifra,
los ejes, la leyenda— y no de una vez: una pasada de cien claves no se revisa.

Dos detalles que la primera pasada enseno, y que valen para las siguientes:

- `renombrar.mjs` no toca un acceso indexado por cadena —`ObjectInstance['presentacion']`—, porque
  para el es una cadena. Los avisa al terminar; hay que mirarlos.
- La clave que aparece dentro de un diagnostico (`slot: \`presentacion.${clave}\``) se renombra
  tambien: es el nombre del campo dicho a quien edita, y dejarlo en espanol seria senalar un campo
  que ya no se llama asi.

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

### 2.15 No hay forma de crear el PRIMER Administrador en un despliegue real — HECHO

Lo abrio el arreglo anterior: cerrar la siembra de demostracion dejaba un despliegue sin la
variable **sin ninguna cuenta local**. Era lo correcto —lo que sembraba era una clave publica para
toda la institucion— pero faltaba la otra mitad.

Resuelto con un **comando de operacion** y no con una ruta HTTP, que es el punto entero: una ruta
de arranque es una puerta que queda abierta para siempre y que hay que acordarse de cerrar, y
basta con que se pierda el estado que la deshabilita para que vuelva a estar abierta.

`npm run crear-administrador -- <userId>` (`tools/crear-administrador.mts` sobre
`apps/shell/src/server/primerAdministrador.ts`) crea una sola cuenta local, con contrasena
aleatoria impresa UNA vez y su propio secreto TOTP, y se niega en tres casos: si ya existe alguna
credencial local, si el gobierno no conoce al usuario, y si ese usuario no es Administrador en
ningun equipo —concede el ACCESO, no el rol—. La creacion consta en la auditoria con `sistema`
como actor.

La negativa central esta probada por su mensaje y no por la clase del error, y con el mismo
`userId` en los dos intentos: con otro, el gobierno sembrado solo tiene un Administrador y la
comprobacion de rol taparia la negativa, de modo que la prueba pasaria igual con la negativa
desactivada. Se comprobo enrojeciendo.

El procedimiento esta en `docs/operations/primer-administrador.md`, junto al de
`acceso-de-emergencia.md`, que describe la situacion inversa —quedarse sin Administradores— y
comparte con este la pregunta de fondo: quien puede crear el acceso cuando no hay acceso.

### 2.16 La incorporacion en otros portales fuera del propio dominio — HECHO

La cookie de sesion era `sameSite: 'lax'`. Un navegador NO la manda a un iframe de otro sitio, asi
que un portal externo de verdad no veia datos nunca: veia «Se requiere iniciar sesion», incluso con
la sesion abierta en otra pestana.

Y `lax` era, a la vez, la **unica** proteccion contra la falsificacion de peticiones que la
aplicacion tenia. Ponerlo en `none` a secas habria cambiado un problema por uno peor. De ahi el
orden en que se hizo, que es lo que importa de este apartado:

**1. Primero el token, en todas las escrituras.** `apps/shell/src/server/csrf.ts`. Es un HMAC de la
sesion con el secreto del servidor, no un valor guardado aparte: nada que almacenar, nada que
caducar, nada que quede huerfano al revocar la sesion. Y ata el token A ESA sesion —un doble envio
sin firmar lo rompe quien pueda escribir una cookie en el dominio, por ejemplo desde un subdominio
comprometido—.

**2. Una sola puerta, en el middleware.** No cuarenta comprobaciones repartidas por los manejadores
de ruta: cuarenta sitios donde acordarse, y el que se olvide es justamente el que nadie mira —la
ruta nueva, escrita con prisa, que no existia cuando se hizo la ultima revision de seguridad—.
Exentas solo dos rutas, y cada una con su motivo escrito: entrar, que es de donde SALE el token, y
restablecer, que lo ejecuta quien no tiene sesion.

**3. Una sola puerta tambien en el cliente.** `pedir` pone la cabecera. Las diecisiete escrituras
que iban con `fetch` a pelo pasan por ahi, y lo que impide que aparezca la numero cuarenta y siete
es `tools/coherence/escrituras.spec.ts`: si escribe, va por `pedir`. El compilador no puede ver esa
diferencia —las dos funciones existen y las dos devuelven una respuesta— y una revision tampoco,
porque lo que hay que notar es la AUSENCIA de algo.

**4. Y solo entonces, la cookie puede cruzar.** `cookiePolicy` decide en un sitio, para las dos
cookies: con origenes de incrustacion declarados y en produccion, `sameSite: 'none'` con `secure`;
en cualquier otro caso, `lax`. Las dos juntas porque con politicas distintas el navegador mandaria
una y no la otra, y toda escritura quedaria rechazada sin que nada lo explicara. Y `none` solo con
HTTPS porque un navegador RECHAZA `SameSite=None` sin `Secure`: ponerlo en desarrollo no relajaria
la proteccion, dejaria la aplicacion sin sesion.

El token NO es condicional: se exige tambien con `lax`. Una proteccion que se enciende con una
variable de entorno es una proteccion que en algun entorno esta apagada.

Verificado enrojeciendo la puerta: con la comprobacion desactivada, la escritura falsificada pasa.

La pagina incrustada sigue sin dibujar un formulario de contrasena dentro del marco ajeno, que
ensenaria a la gente a escribir su clave donde no debe.

### 2.17 La prueba del tiempo de respuesta del acceso es intermitente

Salio a la luz corriendo las verificaciones completas, y conviene anotarla antes de que alguien la
redescubra como «fallo raro que se arregla repitiendo».

`ni por el tiempo que tarda en contestar`, en `packages/auth/src/auth.spec.ts`, compara dos
medidas de reloj: lo que tarda el acceso con un correo que existe y con uno que no. Es la prueba
que demostro el fallo real —la rama «esta cuenta no existe» salia en microsegundos y revelaba por
el reloj que correos hay— y el arreglo es bueno: ahora se verifica contra un hash de relleno y se
paga el mismo coste.

Lo fragil es la MEDIDA, no lo medido. Con las veintiuna tareas de `nx run-many` compitiendo por la
maquina, una de las dos llamadas a Argon2 puede tardar el triple que la otra sin que nada este mal:
se vio 39,7 ms contra 14,6 ms, con el margen puesto en la mitad. Aislada pasa siempre.

Arreglarlo no es subir el margen —eso la convierte en una prueba que ya no distingue nada— sino
medir de una forma que no dependa del reloj de pared: varias repeticiones y comparar medianas, o
mejor, comprobar lo que de verdad importa —que el camino de «no existe» EJECUTA la verificacion de
relleno— en vez de cuanto tarda.

### 2.18 `no se puede exportar un modulo que el equipo no tiene concedido` fallo una vez

Sin diagnostico, y se anota precisamente por eso: es la unica forma de que la proxima vez que
falle no empiece de cero.

Esta en `apps/shell/e2e/exportacion.spec.ts:108`. Fallo una vez en el pase `parallel` con tres
workers —323 de 324— y volvio a pasar las dos veces siguientes, la suite entera y el archivo solo.
No se capturo el mensaje, que es el error de metodo a no repetir: sin el no se puede saber si lo
que fallo fue la espera del helper `exportar` (`expect.poll`, 15 s, hasta `lista|fallida`) o la
propia afirmacion de que el trabajo termino en `fallida`.

Lo que ya se descarto: no es contaminacion entre pruebas. Los cinco archivos que escriben en
`/api/admin/*` estan los cinco en `SECUENCIALES`, y cada worker levanta su propio almacen.

Por donde seguir, y en este orden: guardar el informe del pase completo (`--reporter=list,json`)
para tener el mensaje la proxima vez, y mirar si 15 s bastan cuando tres workers compiten por la
maquina — si es eso, el arreglo no es subir el plazo sino que la consulta diga en que estado
quedo, porque «se quedo en encolada» y «termino en lista» son dos fallos distintos que hoy se leen
igual.

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
- **El morado `#7c5cfc` de la linea grafica, en cualquier forma.** Aquella guia lo pone en
  «Acento secundario» y lo describe como «series alternas en graficos». Como ACENTO ya se probo y
  se retiro: el rol de acento tine los avisos, las formas y la segunda serie de todo grafico, y
  con el morado ahi la aplicacion perdia el rojo en los sitios donde el rojo es la marca. Y como
  color de serie tampoco: pedia darle a un tema su propia paleta de series —una lista libre de
  colores que ninguna derivacion comprueba—, y eso abre por la puerta de atras justo lo que 4.9
  cierra por la de delante, porque las series SI tienen que alcanzar 3:1 sobre la superficie.
  Las series salen de las paletas tonales y se comprueban. El acento de los dos temas de fabrica
  es el rojo de la norma.
