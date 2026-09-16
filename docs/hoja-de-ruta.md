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

**2.2 quedo cerrado** con el reposicionamiento portado al dialogo «Mi vista»; lo unico que sigue
sin gesto ahi es `columnOrder`, que va con el resto de la personalizacion de tablas.

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

### 2.7 Mas tipos de visualizacion sobre ECharts — EN CURSO

`mapa` sigue sin implementar —necesita la geometria de los distritos judiciales, que no esta en el
repositorio—. La arquitectura para anadir tipos esta: una funcion pura que construye las opciones,
un `tipo` mas en el despachador, y el respaldo en DOM que corresponda a esa lectura.

Al anadir uno, la pregunta que hay que contestar es **cual es su respaldo accesible**: para las
barras son botones, para las lineas una tabla. No es un detalle de implementacion, es parte de
decidir que significa el objeto.

**Que tipos faltaban, y de donde sale la lista.** No de un catalogo de graficos bonitos: de lo que
los sistemas judiciales publican. Las cuatro metricas que el National Center for State Courts y los
paneles de Maryland, Carolina del Norte y Ohio ensenan son tasa de resolucion, **tiempo hasta la
resolucion**, **edad de los casos pendientes** y certeza de la fecha de audiencia. Tres de las
cuatro son DISTRIBUCIONES, y este catalogo solo sabia dibujar promedios.

**Familia nueva: `distribution`.** Las familias agrupan por la PREGUNTA que contesta un objeto, y
«que forma tiene esta medida» no era ninguna de las ocho. La paleta del editor ya agrupa por
familia, asi que el objeto aparece donde se le busca.

#### Histograma — HECHO

`DiasResolucion` solo se podia ensenar como promedio, y un promedio esconde exactamente lo que
importa de un plazo: la cola. El histograma reparte las observaciones en intervalos y ensena donde
se acumulan.

1. **Pide grano ATOMICO, y se dice.** Sobre un dataset preagregado repartiria grupos y no casos, y
   dibujaria la forma de los grupos. Lo declara en sus `notes`, con la misma logica que
   `possibleAggregations`: el dato que no se puede calcular aqui no se calcula a medias.
   `casos-detalle` ya existia y es de grano atomico — una fila por caso.
2. **Los intervalos los calcula UNA funcion**, `packages/ui-components/src/charts/histogram.ts`, y de ella leen el dibujo Y el
   respaldo. Calculandolos dos veces, la tabla y el grafico terminan diciendo que el mismo caso cae
   en tramos distintos, sin que nada falle.
3. **El automatico es Freedman-Diaconis**, que toma la amplitud del recorrido intercuartilico y por
   tanto no se deja arrastrar por un atipico: un solo expediente de diez anos pondria a todos los
   demas en el primer intervalo. Con recorrido intercuartilico cero cae a Sturges.
4. **Tres mandos, y el primero cambia lo que el grafico DICE:** cuantos intervalos —con tres, toda
   distribucion parece una campana; con sesenta, ruido—, el acumulado —que es lo que contesta «que
   parte se resolvio en menos de N dias»— y el porcentaje.
5. **La linea de referencia se ancla al eje de la MEDIDA.** `referencesOf` las cuelga del eje de
   valores, que aqui cuenta casos: un plazo de «180 dias» apareceria a la altura de 180 CASOS.
   `binPosition` la traduce a la posicion que le toca dentro de su intervalo.
6. **El respaldo es una tabla de intervalos, no botones.** Una barra filtra porque ES un valor de
   una dimension; un intervalo es un tramo de una medida y no hay filtro que aplicar. Ofrecer el
   boton seria prometer un gesto que no lleva a ninguna parte — el fallo que ya se corrigio en la
   dispersion.

**Cinco claves que el histograma NO hereda de las barras**, cada una por su motivo y todas escritas
en `histogramOptions`: `apilado` (una sola serie, y solo llegaria a imponerle al eje la escala de 0
a 100), `legend` (repetiria el nombre de la medida que el titulo ya dice), `tooltip` (sus dos
opciones suman y ordenan series entre si), `conditional` —el importante: sus reglas comparan el
valor de la barra con un umbral, y **la barra de un histograma es un recuento**, asi que una regla
escrita sobre «dias» se evaluaria contra «cuantos casos»— y `references` tal cual, sustituida por la
version anclada.

Y **el alto de la barra no se formatea como la medida**: es la otra cara de lo mismo. Con el
formateador que llega, cincuenta CASOS se dibujarian como «50 d».

Verificado enrojeciendo cuatro: un ultimo intervalo que deja de cerrar por la derecha, la
referencia devuelta al eje de los recuentos, el catalogo que deja de declarar la clave que el dibujo
lee, y el formateador de la medida aplicado al recuento.

#### Diagrama de caja — HECHO

Lo que el histograma ensena de una distribucion, esto lo compara entre muchas: los dias de
resolucion materia a materia, cada una con su mediana, sus cuartiles y lo que se le sale. Es la
forma estandar de comparar rendimiento entre jurisdicciones.

1. **Los bigotes llegan al dato, no al limite calculado.** Tukey dice «vez y media el recorrido
   intercuartilico», pero el bigote se para en la observacion mas lejana que TODAVIA esta dentro:
   uno que terminara en el limite dibujaria un alcance que nadie midio.
2. **Los atipicos se nombran, no se quitan.** Un expediente que se sale del resto es lo que se
   busca. Van en su propia capa, como puntos sueltos —otra FORMA, no otro color, que 4.9 no admite
   como unico portador— y con su nombre en la leyenda.
3. **Un grupo sin observaciones no da una caja plana en cero.** Se queda fuera: dibujarla diria que
   esa materia resuelve todo en cero dias, que es lo contrario de «no se sabe».
4. **La referencia va al eje de valores**, al reves que en el histograma, porque aqui ese eje SI
   mide la medida: el plazo cruza todas las cajas a su altura.
5. **El respaldo lleva los cinco numeros**, que son el dibujo, y **su celda de grupo SI filtra** —a
   diferencia del histograma—: una materia es un valor de una dimension.

**Y el paquete de objetos sigue sin escribir texto visible.** Este grafico anade dos series que no
salen del mapeo, y la leyenda tiene que nombrarlas. Los rotulos llegan por `layerLabels`, ya
traducidos, igual que la paleta llega ya resuelta: el paquete es puro y no lee el catalogo de
mensajes.

**Dos limpiezas que el objeto obligo a hacer, y las dos eran duplicaciones a punto de divergir:**

- `quantile` y `numbersOf` vivian dentro del histograma y ahora las necesitaban dos. Estan en
  `packages/ui-components/src/charts/statistics.ts`, que no es de ninguno de los dos: dejarlas en
  uno habria terminado con el otro escribiendo su propia copia, que es como dos objetos discrepan
  sobre la mediana del mismo dato.
- El separador con el que `toCategorical` compone «Penal / caso-12» estaba escrito en dos sitios
  —quien une y quien parte—. Ahora es `LABEL_SEPARATOR`, uno solo.

#### Mapa de calor — HECHO

Materia por trimestre, con la intensidad diciendo donde se concentra la carga. Hasta ahora eso solo
se podia leer como una matriz de numeros, que sirve para consultar un dato y no para ver un patron.

**Y es el unico objeto del catalogo que comunica por el COLOR**, que es justo lo que el principio 4
no admite como unico portador. De ahi que dos cosas no sean opcionales:

1. **La cifra va DENTRO de la celda** por omision. Se puede apagar —con cuarenta columnas no cabe—,
   y apagarla no deja el objeto sin lectura alternativa.
2. **El respaldo no es un extra de accesibilidad: es la otra mitad del objeto.** La tabla lleva
   TODOS los cruces, tambien los que no tienen dato, y es lo que hace legitimo el degradado.

Lo demas que decide:

- **Un cruce que no existe es `null`, no un cero.** Un cero pintaria la celda del color mas frio y
  diria «aqui no hay pendientes», cuando lo que pasa es que esa combinacion no esta en el dataset.
- **La escala divergente se hace SIMETRICA alrededor del punto medio.** Sin simetria, el mismo
  alejamiento a un lado y al otro se pintaria con intensidades distintas, y el degradado diria que
  una desviacion es mayor que la otra siendo iguales.
- **El degradado sale del hueco de la paleta que se elija**, no de un color fijo: si no, el control
  de color estaria en el panel y no responderia.
- **Ni referencias ni ejes de valor:** los dos ejes son de categorias, asi que una raya en «180
  dias» no cruzaria ningun eje que mida dias.

#### Diagrama de flujo — HECHO

El embudo ensena etapas que solo menguan. Esto ensena a DONDE va lo que sale de cada una, que es la
pregunta en cuanto el proceso se ramifica: de las audiencias celebradas, cuantas acaban en sentencia
y cuantas se archivan.

**Lo que este objeto obliga a resolver es el CICLO.** Un diagrama de flujo es un grafo dirigido
aciclico, y en un proceso judicial los ciclos existen de verdad: una apelacion devuelve el
expediente a primera instancia. Con el ciclo puesto, el trazado de ECharts se queda dando vueltas.

La salida no es dibujarlo ni quitarlo: es **apartarlo con nombre**. `flowsOf` detecta el ciclo
—recorriendo el grafo, no mirando solo el paso de vuelta—, lo deja fuera del lienzo y lo devuelve en
`dropped` con su motivo. **El respaldo lista TODOS los flujos**, los dibujados y los apartados, con
una columna que dice por que. Quitarlo en silencio dibujaria un proceso que no es el que hay, y
quien leyera el grafico creeria que esa devolucion no ocurre.

Lo mismo con una etapa que va a si misma, y con un flujo sin cifra: un enlace de grosor nulo dibuja
una linea que no lleva a nadie, que no es lo mismo que un paso por el que no pasa nadie.

**No hereda `axes` ni `references`:** no hay ejes donde anclar una raya, y el grosor del enlace ya
ES la cifra.

#### Y lo exportado es lo que el objeto ENSENA — HECHO

Los cuatro caian en la rama por defecto de `projectObject`, que vuelca una fila por categoria del
dataset. Para el histograma eso son mil doscientos casos crudos donde el objeto ensena doce
intervalos; para el diagrama de caja, las observaciones en vez de los cinco numeros.

El principio ya estaba escrito en el codigo, sobre la tarjeta KPI: *volcar aqui las filas del
dataset seria exportar algo que la tarjeta no muestra*. Aqui pesa mas, porque la transformacion es
justamente lo que estos objetos aportan. Ahora cada uno tiene su caso:

- El **histograma**, sus intervalos con el recuento, y la columna de lo dibujado cuando acumula.
- El **diagrama de caja**, una fila por grupo con los cinco numeros, los atipicos y el recuento.
- El **mapa de calor**, la rejilla como se ve, con un cruce inexistente viajando como vacio y no
  como cero — en una hoja de calculo, un cero es un dato.
- El **diagrama de flujo**, TAMBIEN los pasos que el lienzo no traza. Un ciclo es parte del proceso;
  dejarlo fuera de la exportacion convertiria una limitacion del dibujo en un dato que desaparece.

#### Y el grano que un objeto NECESITA deja de ser una nota — HECHO

El histograma y el diagrama de caja decian en sus `notes` «pide grano atomico», y **nada lo
comprobaba**. Una regla que nadie mantiene es lo que este repositorio no admite en ningun otro
sitio, y aqui el fallo es de los peores: sobre un dataset preagregado el objeto dibuja la forma de
los GRUPOS y ninguna cifra es falsa, asi que no hay nada raro que mirar.

`ObjectDataContract` gana `grain`, y la validacion lo compara con el del registro de datasets. No es
la comprobacion de agregaciones que ya existia —esa mira si una CIFRA saldria mal—: aqui lo que sale
mal es el objeto entero. El modulo queda marcado ROTO, con el motivo escrito.

Lo declaran dos objetos y solo dos. Ausente significa que da igual, que es el caso de casi todos:
una barra con la suma de un grupo es la misma suma venga de donde venga.

---

**Lo que queda de 2.7.** `mapa` sigue esperando la geometria de los distritos. Y de la lista que
salio de la investigacion, los candidatos con menos fuerza —radar, sunburst, calendario— no se
hicieron a proposito: ninguno contesta una pregunta que el catalogo no sepa ya contestar. Un radar
compara varios indicadores por grupo, que es lo que hace una matriz sin el problema de que el area
de un poligono exagere; un sunburst es un mapa de arbol en redondo; y un calendario es un mapa de
calor con las celdas puestas en forma de mes. Anadirlos seria crecer en numero de objetos y no en
preguntas que se puedan contestar.

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


### 2.10 El texto visible sale del componente, no del catalogo — HECHO

`AGENTS.md` lo pone entre las reglas que no se negocian y dice que lo garantiza una prueba. No
habia tal prueba, y la regla llevaba incumpliendose casi entera: **53 claves en el catalogo de
`@app/i18n` contra 322 cadenas escritas dentro de 56 componentes**. Solo tres archivos importaban
el traductor.

No era cosmetico. Mientras el texto viva en el componente, la aplicacion no puede cambiar de
idioma —que es lo que el propio paquete existe para permitir—, cada cadena repetida en dos
pantallas puede discrepar, y nada impide que una palabra en ingles se cuele donde una persona la
lea. Paso cinco veces durante el renombrado.

**Cerrado en cero.** `tools/coherence/i18n.spec.ts` pasa de trinquete a PUERTA: el tope es 0 y una
cadena nueva escrita dentro de un componente la rompe. De las 54 ultimas, 45 eran texto de verdad
y fueron al catalogo —35 claves nuevas, mas una decena que ya existian y solo habia que usar—; las
otras 9 eran falsos positivos del propio extractor.

Los falsos positivos se cerraron por los dos caminos que el apartado ya proponia, y en ese orden:

- Una condicion de JSX escrita en linea se saca a una CONSTANTE CON NOMBRE. Se lee mejor y ademas
  deja de contarse. Asi salieron las de `NavigationTree`, `AdminRail` y `TablaBuscable`.
- Una anotacion de tipo partida en varias lineas pone un `>` de un generico delante y un `<` de
  otro detras, y no hay constante que arregle eso. Se cerro ESTRECHANDO la deteccion con
  `NO_ES_PROSA`, que descarta `): `, `=>`, `${` y las entidades HTML: formas que la prosa no tiene
  nunca. Estrechar se puede; relajar la expresion de la prosa —admitir llaves, por ejemplo— seria
  lo contrario, se comeria texto de verdad y el numero bajaria solo.

**Cero de lo que la prueba MIDE**, que no es cero en absoluto y conviene no confundirlo: `PROSA`
exige que el texto quepa en una linea, asi que un parrafo que el formateador parte en dos le pasa
por delante. Es un limite conocido y esta escrito en la guarda. Ampliarla a varias lineas es otra
tanda, con su propio recuento y su propio tope.

Una leccion de cablear el traductor en veintiseis archivos: **`'use client'` no se deduce de si el
archivo lo declara, sino de quien lo monta.** `EditorHeader` no lo declaraba y lo dibujan los dos
lados —`apps/shell/app/editor/page.tsx`, que es de servidor, y `ModuleEditor`, que es de cliente—. Con el
hook puesto, la construccion paso y el navegador reviento en tiempo de ejecucion. Lo caza la suite
de navegador, no el compilador.

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

**Segunda tanda, hecha:** las seis del marco comun —`resaltado`, `colorDeResaltado`,
`mostrarTitulo`, `mostrarIcono`, `etiquetasDeDato`, `coloresDeSerie`—, con sus doce filas en la
tabla y las tres suites de navegador en verde.

**Lo que enseno, que cambia el metodo para las siguientes.** Se intento con catorce claves de una
vez y el compilador saco a la luz que cinco de ellas no son solo claves: `apilado` es tambien un
valor de `StackingMode`, y `combinado`, `medidor`, `embudo` y `cascada` lo son de `ChartKind`. Las
dos cosas se guardan y el renombrador solo ve identificadores, asi que movia las dos a la vez y
dejaba el catalogo de graficos sin poder despachar. `subtitulo` es peor: es una clave de
presentacion Y el nombre de una ranura dentro de `textos`.

De ahi la regla para las tandas que quedan: **antes de meter una clave en el plan, comprobar que
su nombre no es ademas un valor de una union guardada.** Si lo es, no entra en la pasada del
renombrador; se hace a mano desde el tipo, dejando que el compilador senale cada sitio.

El renombrador tampoco es reversible: deshacer la pasada con el mapa invertido convirtio
`data-highlight` en `data-resaltado`, porque `highlight` aparece dentro del atributo. Lo que
protege no es poder deshacer, es que el arbol este limpio antes de empezar.

**Y una guarda que faltaba.** `claves-guardadas.spec.ts` recorre `RENAMES` y comprueba que ninguna
clave ya renombrada se vuelva a escribir con su nombre viejo — pero renombrar en el codigo y
OLVIDAR la fila de la tabla le pasa por delante: sin fila no hay nada que recorrer. Se probo
quitando la de `resaltado` y la guarda seguia verde. Ahora el fixture de
`migrateDefinition.spec.ts` guarda las seis claves viejas DENTRO de la presentacion y exige
leerlas con la nueva: sin su fila, el valor no llega y enrojece, que es exactamente lo que le
pasaria a un modulo guardado antes del renombrado.

**Tercera tanda, hecha: los EJES**, que son la primera clave con hijos. `ejes` -> `axes` y las
siete de dentro —`mostrarY` -> `showY`, `tituloY` -> `yTitle`, `tituloY2` -> `y2Title`,
`desdeCero` -> `fromZero`, `minimoY` -> `yMin`, `maximoY` -> `yMax`, `escala` -> `scale`—, en
grupo porque se leen en grupo: quien abre la seccion «Ejes» del panel las ve todas a la vez.

Tres cosas que esta tanda enseno, y las tres cambian algo para las siguientes:

**1. El ORDEN de la tabla importa, y solo aqui.** Las filas se aplican en orden. La de `ejes` ->
`axes` tiene que ir ANTES que las siete de dentro: al reves, esas siete buscarian en
`presentation.axes` cuando lo guardado todavia dice `ejes`, no encontrarian nada —renombrar lo que
no esta no falla— y la definicion quedaria con el eje migrado y su contenido en espanol. Lo ata una
prueba que compara las posiciones en `RENAMES`, porque un comentario que pide no reordenar no
sobrevive a la primera reordenacion. Y las dos filas de cada clave las escribe ahora
`enLaPresentacion(...)`: once lineas copiadas por clave eran once sitios donde perder un `[]` de la
ruta del complemento, y una ruta que no alcanza nada no falla.

**2. Un `...` dentro de un objeto literal APAGA la comprobacion de propiedades sobrantes.** Es el
hallazgo que mas vale de la tanda. `Canvas.tsx` pasaba la presentacion al grafico con doce lineas
de la forma `...(presentation?.ejes ? { ejes: presentation.ejes } : {})`, y cuando `ejes` paso a
`axes` en las dos puntas —en el tipo de la presentacion y en el de las opciones— esa linea
**siguio compilando**: TypeScript no revisa propiedades sobrantes en un literal que lleva un
esparcido. El grafico se habria quedado sin sus ejes sin que nada protestara, que es exactamente el
fallo del que va este apartado, pero dentro del propio codigo y no en el disco. Ahora pasan por
`comun('axes')`, cuya clave tiene que existir en LOS DOS tipos: el mismo renombrado a medias ya no
compila. Verificado enrojeciendo con una clave que solo esta en uno.

**3. `claves-guardadas.spec.ts` solo mira el CODIGO.** Mientras las claves eran compuestas
—`presentacion`, `colorDeResaltado`— buscar «nombre:» bastaba: nadie escribe eso en una frase.
`ejes` y `escala` son palabras corrientes, y de golpe acuso a cuatro inocentes —«titulos de los
ejes: esos se suman aqui» en un comentario, «Una sola escala: la comparacion es directa» dentro de
un subtitulo—. Ninguna era un error y las cuatro empujaban a relajar la guarda. Usa el escaner de
`tools/rename/segmentos.mjs`, que ya sabia partir un archivo en codigo, comentario y cadena. Y
lleva `CONVIVEN`, una excepcion por archivo y con motivo, para la clave vieja que es a la vez el
nombre legitimo de otra cosa: `ejes` son tambien los seis ejes de ESTILO de un tema, en otro
paquete. Es la leccion de `tipo` —la misma palabra quiere decir cosas distintas en sitios
distintos— dicha donde una guarda que mira archivos, y no rutas, puede aplicarla.

**Cuarta tanda, hecha: las cuatro SIN GEMELO** —`leyenda` -> `legend`, `referencias` ->
`references`, `condicional` -> `conditional`, `multiplos` -> `multiples`—. Se eligieron juntas por
lo que NO tienen: ninguna es tambien la clave de otro tipo del repositorio ni un valor de una union
guardada. Esa comprobacion, que antes se hacia sobre los valores, ahora se hace tambien sobre las
CLAVES, y es lo que separo estas cuatro del resto.

**Y la leccion de esta tanda es sobre el metodo, no sobre las claves.** Una expresion regular
sobre el archivo entero no sirve: al aplicarla, reescribio prosa espanola de los comentarios («la
legend, SOLO en el primer panel»), una clase CSS, un identificador de prueba, dos slugs de pagina
y los terminos de BUSQUEDA del panel, que estan en espanol porque los teclea quien edita. Se
deshizo entera y se rehizo en dos pasadas:

1. **En la zona de CODIGO**, con el escaner de `tools/rename/segmentos.mjs` —el mismo que usa el
   renombrador y, desde esta tanda, la guarda—. Comentarios y cadenas quedan fuera por
   construccion.
2. **Y luego las cadenas que SI son la clave**: `PRESENTATION_KEYS`, `presenta(...)`,
   `admite("...")`. Se excluye lo que va detras de un `=`, que en JSX es un atributo
   —`className`, `data-testid`—, y se excluye `apps/shell/e2e`, donde una cadena igual a la clave
   casi siempre es un identificador de prueba o un slug.

Lo que quedo fuera de las dos pasadas lo nombro el compilador, una a una, y lo que se colo pese a
todo lo cazaron las guardas: `interfaz.spec.ts` encontro el testid `multiplos` convertido en
`multiples`, que es justo para lo que esta. **El identificador de prueba y el slug no se mueven con
la clave**: son otros contratos.

**Lo que queda** son **88 claves**, y las que quedan son las dificiles: `formato`, `formatos`,
`textos`, `icono`, `etiqueta`, `acento`, `orden`, `tipo`… Todas tienen gemelo —`formato` es
tambien la clave de una orden de exportacion, `textos` la de una hoja exportable, y `tipo`,
`icono`, `etiqueta` y `acento` aparecen como clave en decenas de sitios que no son la
presentacion—, asi que cada una obliga a elegir: renombrar tambien la del otro contrato —que es
otra superficie guardada, con su propia migracion— o anotarla en `CONVIVEN`, que es admitir que
esa guarda ya no mira ese archivo.

**Decidido: 2.11 PARA AQUI**, y las 88 se quedan como deuda escrita en vez de como trabajo a
medias. Lo que importa es que lo que queda no es «seguir renombrando»: es elegir entre ensanchar
cada tanda hasta el otro contrato o debilitar la guarda, y esa eleccion se toma cuando se retome,
no ahora. Lo entregado esta cerrado y verificado: veinticuatro claves, la migracion con su tabla y
su orden probado, y tres guardas —la de las claves en disco, la del esparcido que apagaba al
compilador y la del identificador de prueba que no se mueve con la clave—.

Dos detalles que la primera pasada enseno, y que valen para las siguientes:

- `renombrar.mjs` no toca un acceso indexado por cadena —`ObjectInstance['presentacion']`—, porque
  para el es una cadena. Los avisa al terminar; hay que mirarlos.
- La clave que aparece dentro de un diagnostico (`slot: \`presentacion.${clave}\``) se renombra
  tambien: es el nombre del campo dicho a quien edita, y dejarlo en espanol seria senalar un campo
  que ya no se llama asi.

### 2.14 Clases de CSS que nadie escribe, y nada lo comprueba — DOS GUARDAS PUESTAS, deuda medida

Las guardas de `tools/coherence` atan los atributos `data-*`, los identificadores de prueba, las
rutas y los campos del cable. Faltaba la de los nombres de CLASE, y faltaba justo donde mas duele:
un selector que no casa no protesta. No lo caza el tipo, ni el lint, ni el navegador.

El fallo que lo motivo: los botones de publicar y devolver salieron con `button-primario` y
`button-secundario`, que no existen —las de verdad son `pastilla` y `boton-contorno`—, y la pagina
se dibujo con los botones grises del navegador sin que nada fallara.

**Lo que bloqueaba era el extractor, y ya esta.** `tools/coherence/clases.mts` entiende una
plantilla, que es lo que un extractor ingenuo no hace: de
`className={`x ${cond ? 'a' : 'b'}`}` sacaba `cond`, `a` y `b` como si las tres fueran clases, y
una guarda con falsos positivos termina con alguien relajandola hasta que no comprueba nada.
Resuelve cuatro casos que se vieron de verdad al medir, y cada uno tiene su prueba:

1. **Plantillas ANIDADAS.** `` `tree__link ${activo ? `es-${modo}` : ''}` `` lleva una plantilla
   dentro del hueco de otra, y cualquier `[^`]*` se corta en la comilla de dentro. Se recorta
   contando llaves. Sin esto, la guarda acusaba de CSS muerto a `tree__link`, que esta viva.
2. **El literal con el que se COMPARA.** `typeof cell === 'number' ? 'is-number' : ''` tiene dos
   literales y solo uno es una clase. Daba `number` y `ok` como clases inexistentes.
3. **El prefijo armado a trozos.** `navegador--${tipo}` no se puede resolver, y contar
   `navegador--` era acusar a una clase que si existe.
4. **Del CSS, solo los SELECTORES**: dentro de un bloque, un `.` es el decimal de una medida.

**Nacio como trinquete con la deuda medida —19 y 34— y hoy es una PUERTA en CERO por los dos
sentidos.** `tools/coherence/clases.spec.ts`. Un trinquete solo vale mientras hay deuda que bajar;
con deuda cero es una puerta, que es lo que se queria desde el principio. Verificado enrojeciendo
por los dos lados: `button-primario` en un componente rompe un sentido y una regla que nadie
escribe rompe el otro, y los dos mensajes nombran la clase y el archivo.

**Lo que aparecio al limpiar, que es el argumento entero a favor de la guarda.** De las 19 clases
sin regla, tres eran fallos de verdad:

- `object__addon`, el boton de ampliar de un contenedor, se dibujaba como el **boton gris del
  navegador** dentro de la cabecera de la tarjeta. Es exactamente el fallo de `button-primario`,
  vivo y sin que nadie lo hubiera visto. Pasa a `button-link`, que es lo que usa la otra accion de
  cabecera que hay en el repositorio.
- `field`, en dos dialogos de administracion, donde la clase de verdad es `form__field`. Esos
  rotulos caian en el tamano heredado.
- `form__check`, la fila de una casilla, escrita en **seis** sitios y sin ninguna regla: el
  `<label>` quedaba en `display: inline` y el rotulo se partia por debajo del cuadrito. Se le
  escribio la regla, la misma forma que ya tienen `.lista-casillas label` y `.editor__fields
  label`.

Las otras dieciseis eran ganchos sin estilo, y quitarlos no cambia un pixel: una clase sin regla
no pinta nada, por definicion. Esa es tambien la garantia de que borrar CSS no rompio nada — el
OTRO sentido de la guarda, en cero, dice que toda clase que el TSX sigue escribiendo tiene su
regla.

**Y las 43 reglas muertas, fuera.** Once se fueron en la primera tanda: los alias `md-*` de la
escala tipografica, que encabezaban una lista de selectores sin aportar nada —`.md-display-small,
.vacio h1, .kpi__value { … }`—. Las 34 restantes tenian bloque propio y se miraron una a una:
casi todas son capas anteriores que se quedaron sin inquilino —el editor de antes de F5.11, el
arbol de antes de F5.43, las tarjetas de equipo de antes de F6.4, la leyenda que hoy dibuja
ECharts— mas cuatro utilidades MD3 (`md-estado`, `md-campo`, `md-label-large`, `md-boton--tonal`)
que nadie llego a usar.

**El prefijo, que es la unica excepcion y esta en el extractor, no en una lista.**
`navegador--${tipo}` escribe `navegador--pestanas-abajo` el dia que el tipo sea ese, y
`clasesEscritas` hace bien en no contar `navegador--`. Pero eso dejaba sus cuatro reglas como CSS
muerto, y un numero que dice «borra esto» estando vivo es peor que uno que se queda corto: el
falso positivo que se ve molesta, el que dice que borres hace dano. `prefijosEscritos` saca el
trozo fijo aparte y sirve para una sola cosa —una regla que empieza por un prefijo escrito no
cuenta como muerta—, con la salvaguarda de que `${todo}` entero no es prefijo de nada.

**`interfaz.spec.ts` deja de tener su propio extractor.** Leia el mismo marcado con una expresion
regular mas basta que se quedaba con toda palabra dentro de un `className={…}`, nombres de
variable incluidos: nunca daba un falso positivo y por eso mismo dejaba pasar al fantasma que se
llamara igual que cualquier variable. Ahora usa `clases.mts`, con los prefijos.

**La asercion condicional ya tiene su guarda, y esa SI nace en cero.** Es otra clase de fallo: un
`expect` dentro de un `if` puede no ejecutarse nunca, y una prueba que no comprueba nada no se
distingue de una que pasa. Es peor que no tenerla —una que falta se ve en la lista, y esta ocupa su
sitio y da confianza—. Fue lo que dejo la del registro de auditoria en verde desde el primer dia
mientras las dos pantallas mostraban `u-admin` donde deberia ir un nombre.

`tools/coherence/aserciones.spec.ts` recorre cada archivo de prueba carácter a carácter llevando la
cuenta de en cuantos `if` esta metido. Con una expresion regular no se puede: hace falta saber
donde CIERRA cada bloque, y eso es contar llaves. Se salta lo que va dentro de una cadena o un
comentario, porque esta misma guarda escribe `if` y `expect` entre comillas para explicarse y sin
eso se acusaria a si misma.

Mira el `expect` y no el `if`, y por eso **no toca el patron sano**: recoger en un bucle con
condiciones y afirmar DESPUES, fuera de toda rama —`for (…) if (malo(x)) problemas.push(x);` y
luego `expect(problemas).toEqual([])`—, que es como esta escrita media carpeta `tools/coherence`.

Al medir aparecieron tres casos, y los tres se cerraron antes de subir la guarda:

- `contract.spec.ts` afirmaba dentro de un `if` por cada objeto del catalogo; pasa a recoger
  `conLeyendaSinSerlo` y afirmar una vez.
- `accesibilidad.spec.ts` comprobaba el texto del punto de avisos **solo si habia punto**, o sea en
  verde la mayoria de los dias. Ahora afirma la EQUIVALENCIA entre punto y texto, que se ejecuta
  haya avisos o no y se rompe por los dos lados. Es lo que el componente garantiza: el punto y su
  texto para lector de pantalla son hermanos dentro del mismo condicional.
- `full-editor.spec.ts` si tiene una rama de verdad —solo algunas claves traen interruptor— y la
  declara con `// rama-declarada: <motivo>`, la unica valvula. Va en la LINEA y no en una lista
  aparte: se lee junto a lo que excusa y se mueve con el codigo, en vez de quedarse apuntando a una
  linea que ya es otra cosa. Y exige motivo, porque una excepcion sin motivo no la puede revisar
  nadie.

Verificado enrojeciendo por los dos lados: reintroducido el `if` del punto de avisos, la guarda lo
nombra con su linea; quitada la marca de `full-editor.spec.ts`, tambien.

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

### 2.19 La suite de unidad tardaba doce segundos importando lo mismo una y otra vez — HECHO

Lo destapo un aviso del propio vitest al final de una pasada: *«at least ~427ms faster with
`isolate: false`»*. Medido de verdad sobre los 103 archivos, el ahorro no eran 427 ms sino
**12,0 s -> 4,2 s**, casi 3x. El aviso se quedaba corto porque mide una carpeta; la suite entera
evaluaba **268 modulos 810 veces** y se le iba el 42% del tiempo solo en importar.

Pero tomarlo tal cual habria roto en silencio lo que mas importa aqui. Con los procesos
reutilizados, el registro de modulos deja de ser nuevo por archivo, y **cualquier modulo que
capture algo al evaluarse se lo lleva puesto al archivo siguiente**. Habia uno, y era el peor:

```ts
export const CACHE_DIR = process.env['CACHE_DIR'] ?? join(process.cwd(), '.cache-datos');
```

`vitest.setup.mts` le da a cada archivo su propio directorio temporal justamente para que una
prueba que escribe no deje huella en la siguiente. Con esa constante, el segundo archivo de cada
proceso habria seguido escribiendo en el directorio del primero: el aislamiento anulado, la suite
en verde. Comprobado con dos pruebas que comparan `CACHE_DIR` con `process.env.CACHE_DIR` — sin
aislar, no coinciden.

**Lo que se hizo, en este orden.**

1. **La raiz, en una sola pieza.** `cacheDir()` es ahora una funcion y `cacheL2` una fachada
   estable que pregunta por el directorio en cada operacion. Los cinco modulos que capturan el
   almacen al importarse —`exports`, `alerts`, `settings`, `context`, `data`— no se enteran de
   nada: siguen con el mismo objeto y el objeto sigue al directorio. El L1 se vacia al cambiar,
   porque es la memoria DE ESE disco y si no una lectura del archivo siguiente se serviria de
   memoria sin llegar a mirar el directorio nuevo.
2. **La guarda de eso**, `almacenCompartido.spec.ts`, que lo comprueba DENTRO de un archivo
   cambiando la variable a mano. Fiarlo a que dos archivos caigan en el mismo proceso no seria una
   guarda, seria un sorteo. Verificada enrojeciendo: con la constante de vuelta, las tres fallan.
3. **El barajado, que encontro lo que faltaba.** Con `isolate: false` a secas, `auth.spec.ts`
   fallaba en **tres de cada cinco** pasadas con `sequence.shuffle`: `vi.mock` sustituye un modulo
   antes de que se evalue el arbol que lo usa, y con el registro compartido ese arbol puede estar
   evaluado ya. Contaba cero llamadas a `verify` donde espera una por rama.

   Que falle es lo unico bueno del asunto: esa prueba afirma sobre las llamadas del doble. Una que
   solo sustituyera para «no tocar disco» se habria quedado verde y muda. De ahi que los archivos
   que simulan corran en su propio grupo con aislamiento, y que `tools/coherence/simulacros.spec.ts`
   compare la lista con los archivos que de verdad escriben `vi.mock` — leyendola del archivo de
   configuracion, no de una copia, y comprobando que la lectura encontro algo, porque una lista
   vacia compara bien contra nada.
4. **Y la otra pista del mismo aviso**, `fsModuleCache`: la transformacion se guardaba entre
   pasadas. Era el 18% del tiempo, ahora el 6%.

Verificado como el resto: `npm run verify` entero en verde, y **diez** pasadas con el orden
barajado, las diez en verde.

**Y el barajado queda como comando**, `npm run test:barajado` (`tools/barajado.mts`, tarea nx
`verification:barajado`), porque una comprobacion que solo se hizo una vez a mano no protege de
nada. Tres decisiones que lo hacen util en vez de molesto:

- **No entra en `npm run verify`.** Barajar en cada verificacion convierte cada rojo en algo que
  hay que reproducir a ciegas, y un rojo que no se reproduce se termina ignorando. Es para el pase
  nocturno y para cuando se toca el estado de proceso.
- **No se cachea.** Lo que comprueba es que el resultado no dependa del orden, y cada pasada elige
  otro; un acierto de cache devolveria el verde de un orden ya probado.
- **Imprime la SEMILLA de cada pasada** y, al fallar, la orden exacta que repite ese orden. Sin
  eso seria un generador de rojos irrepetibles, que es peor que no tenerlo. El camino de fallo se
  probo de verdad, con una prueba roja puesta a proposito: para en la primera, enseña la salida de
  vitest y la orden que la reproduce — y la orden reproduce.

Lo que queda anotado por si vuelve: hay cuatro lecturas de `process.env` a nivel de modulo
—`AZURE_AD_AVAILABLE`, `AVAILABLE_MAIL`, `SIEMBRA_PERMITIDA` y el punto final de App
Configuration—. Hoy son inofensivas: son banderas de arranque, no cambian despues de arrancar y
ninguna prueba las toca. Pero son la misma forma del fallo, y si alguna pasa a depender del
entorno en ejecucion hay que convertirla en funcion, como `cacheDir()`.

### 2.20 No habia contingencia contra desastres — HECHA la del estado autoritativo

El gobierno de la aplicacion —quien ve que, que modulos hay, que se publico y cuando, que cambio y
quien lo autorizo— no se puede reconstruir, y **nada lo respaldaba**. No estaba pendiente ni
descartado: no se habia planteado. El contrato de ingenieria tampoco lo pide en ninguna de sus
secciones recuperables.

**El hallazgo que ordena todo lo demas: el modo de fallo no es perder el estado, es no enterarse.**
`app:gobierno`, `app:modulos` y `app:modulos:historial` caen a la semilla de demostracion cuando no
hay nada guardado. Es correcto para un despliegue nuevo y desastroso despues: si el almacen pierde
datos, la aplicacion no falla — arranca con los datos de demostracion, responde 200 y parece sana.
Se comprobo a mano: borrado `app:gobierno`, la aplicacion servia «Equipo Distrito Norte» de la
semilla en lugar del equipo real, sin una sola senal.

**Lo que se hizo**, con el detalle y las alternativas descartadas en la ADR-022:

1. **`ICacheStore.keysByPrefix`**, el gemelo de lectura de `deleteByPrefix`. El respaldo enumera
   por el puerto y no leyendo el directorio: el dia que el almacen sea Blob o SQL —el dia en que la
   continuidad importa— una copia atada al sistema de archivos no serviria.
2. **`apps/shell/src/server/backup.ts`**: una tabla que clasifica CADA prefijo del almacen como
   `respaldar` o `no-respaldar`, con su motivo escrito, y de la que leen el volcado, la
   restauracion y la guarda.
3. **`npm run respaldo` y `npm run restaurar`**, con la restauracion **en seco por defecto** y un
   rechazo en bloque si la suma de comprobacion no cuadra: media restauracion deja el gobierno en
   un estado que nadie tuvo nunca.
4. **El centinela `app:instalacion`**, que recuerda que claves llego a escribir este despliegue.
   Con el, `/health` reporta **caido** cuando falta lo que existio — la primera comprobacion
   distinta de la base de identidad que lo hace, y por la misma razon que sostiene la tabla de
   `docs/observabilidad.md`.
5. **La prueba de ida y vuelta**: siembra, cambia por los caminos reales, vuelca, **borra el
   almacen entero**, restaura y compara por los lectores publicos. Verificada sacando tres
   prefijos de la tabla, uno a uno: los tres la ponen en rojo.
6. **`tools/coherence/respaldo.spec.ts`**, que obliga a DECIDIR: una clave nueva sin clasificar
   enrojece; `no-respaldar` con motivo es una respuesta valida.
7. **`docs/operations/contingencia.md`**, el procedimiento, con el RPO dicho como es.

**Dos decisiones que cuestan RTO y se toman a proposito.** Las credenciales locales no entran en el
respaldo —el archivo seria la identidad local entera, y la pimienta que la abre viaja en el mismo
kit de recuperacion—, asi que al restaurar hay que recrear el primer Administrador y pasar el resto
por el restablecimiento mediado. Y las sesiones y los tokens de un solo uso no vuelven nunca:
restaurarlos resucita sesiones revocadas y enlaces ya gastados.

**Lo que NO arregla, y hay que decirlo:**

- **`BlobCacheStore` no lo instancia nadie.** Esta escrito, probado y exportado; la infraestructura
  ya crea el contenedor y concede el RBAC; y la fachada de `almacenCompartido.ts` esta hecha para
  ese cambio de una pieza. Mientras tanto **todo el estado vive en el disco local de la
  instancia**: con el autoescalado a cinco, cada una tendria su propio gobierno, y un reciclaje o
  un swap de slot lo borra. Es la accion que mas riesgo quita y no se puede verificar sin Azure.
- **La perdida TOTAL del almacen no se detecta desde dentro**: el centinela se va con todo lo
  demas. Lo cubre el procedimiento.
- **El respaldo es manual**, asi que el RPO es «desde la ultima vez que alguien se acordo».
  Programarlo va fuera de la aplicacion: escribirlo desde el propio proceso en el mismo disco que
  quiere proteger no protege de nada.
- **Infraestructura**: Storage en `Standard_LRS` sin versionado ni retencion, base de identidad sin
  politica de respaldo declarada, una sola region.
- **El secreto TOTP seguia en claro.** Cerrado en el apartado 2.21, y sin la segunda pieza critica
  que se daba por descontada.


### 2.21 El secreto TOTP se guardaba en claro — HECHO

`LocalCredentialRecord.totpSecret` llegaba al almacen tal cual, con un comentario que prometia
«cifrado en reposo». No es un dato de perfil: es una credencial completa y permanente. Quien lee el
almacen genera codigos validos indefinidamente, sin dejar rastro, y el segundo factor deja de serlo
para esa cuenta. Y no se puede hashear como la contrasena —verificar un codigo exige el secreto
original—, asi que la unica proteccion posible es cifrarlo.

**Lo que cambia el encuadre respecto a lo que este apartado daba por descontado.** Se anoto como
«migracion de datos mas una segunda pieza critica en el arranque», y la segunda pieza no hace falta.
La clave se DERIVA de `AUTH_PEPPER` con HKDF y una etiqueta propia, por el mismo argumento con el
que 2.16 se nego a hacer condicional el token anti-CSRF: *una proteccion que se enciende con una
variable de entorno es una proteccion que en algun entorno esta apagada*. Una clave separada seria
opcional de hecho, y el modo de fallo de su ausencia es guardar en claro — que es justo lo que se
viene a arreglar. Las alternativas, en la ADR-023.

**Lo que se hizo:**

1. **`packages/auth/src/totpCipher.ts`.** AES-256-GCM, vector de inicializacion aleatorio por
   escritura y el correo de la cuenta como dato autenticado: un sobre copiado de una cuenta a otra
   no descifra, aunque quien lo copie pueda escribir en el almacen.
2. **El cifrado vive en la frontera de la PERSISTENCIA.** `totpSecret` sigue siendo el secreto en
   claro en el dominio, porque es lo que el proveedor necesita para verificar; quien decide como se
   escribe es `CredentialsStore`. El proveedor no se entera de nada y sus pruebas no cambian.
3. **Un secreto ilegible LANZA, no se degrada a ausente.** Es la decision de la que cuelga todo lo
   demas: el proveedor exige el codigo cuando el secreto esta presente, asi que un descifrado
   fallido convertido en `undefined` seria una cuenta que entra con la contrasena sola. Con la
   pimienta equivocada no entra nadie, en vez de entrar todos sin segundo factor.
4. **El campo en disco se llama distinto** —`totpSecretCipher`—, de modo que un registro anterior se
   reconoce por su nombre viejo y no por una heuristica sobre la forma de la cadena. Esa es la senal
   que dispara su migracion.
5. **La migracion ocurre al leer**, asi que una cuenta que entra se pone al dia sola. Y
   **`npm run cifrar-totp`** recorre las dormidas, que son las que nadie lee y las que mas tiempo
   pasarian en claro. Reutiliza el `keysByPrefix` que 2.20 anadio al puerto.
6. **`tools/coherence/credenciales.spec.ts`**, la guarda: solo `identity.ts` nombra la clave del
   almacen, solo el conoce el campo cifrado, y el prefijo sigue clasificado como `no-respaldar` —el
   unico cambio de una linea que convertiria el respaldo en un volcado de credenciales—.

Verificado enrojeciendo las cinco: un cifrado que no cifra, una tienda que guarda en claro, un
descifrado fallido que devuelve la cuenta sin segundo factor, una escritura de credencial en otro
archivo, y la clase del prefijo cambiada. Las cinco nombran al culpable.

**Lo que NO arregla:** la pimienta pasa a hacer falta tambien para LEER una credencial con segundo
factor, y sigue sin poder rotarse por separado —rotarla ya invalidaba todas las contrasenas—. La
separacion de verdad es que la identidad viva en su propia base, que es 1.4.

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
