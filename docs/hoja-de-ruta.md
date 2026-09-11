# Hoja de ruta

Lo que queda por hacer, con el motivo por el que no esta hecho. Se ordena por lo que impide, no
por lo que cuesta.

Solo se listan cosas concretas. "Mejorar el rendimiento" no es una entrada; "el editor recarga la
definicion entera en cada cambio" si lo es.

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

**Que falta.** El transporte. `IResetChannel` es el puerto; `CorreoInstitucionalNoDisponible` lo
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

### 2.1 Impedir que la institucion se quede sin ningun Administrador

**El hueco.** `cambiarMembresia` comprueba el permiso de QUIEN hace el cambio, no el estado en
que queda el sistema. Un Administrador puede retirarse a si mismo el rol, o retirarselo al
ultimo que quedaba, y entonces nadie puede volver a nombrar a ninguno: el panel exige ser
Administrador para entrar.

**Donde va.** En el mismo sitio donde vive `wouldExpand`: una comprobacion sobre el resultado
propuesto, no sobre quien lo propone. `guardarEquipo` y `cambiarMembresia` la invocan antes de
escribir.

**Mientras tanto**, la red de seguridad es `docs/operacion/acceso-de-emergencia.md`, que explica
como restituir un Administrador desde el almacen de gobierno.

### 2.2 Arrastrar y soltar en el editor de modulos

El editor coloca los objetos apilados y permite quitarlos, pero no reposicionarlos. El arrastre
lo pide 4.2 para el editor y 4.10.8 para el arbol; en el arbol ya estan los dos gestos —arrastre
y botones— sobre la misma operacion. Falta el equivalente en la rejilla.

**Con la misma condicion que en el arbol**: arrastrar y soltar por si solo es inaccesible por
teclado y con lector de pantalla, y 4.9 dice que la accesibilidad no se pospone. Los dos gestos,
sobre la misma funcion.

### 2.3 Reposicionamiento en la personalizacion (4.6)

`UserPersonalization` admite `positionOverrides` y `columnOrder`, y `applyPersonalization` los
aplica. El dialogo "Mi vista" solo ofrece ocultar y mostrar. El modelo esta; falta el gesto, y
depende de 2.2 para no hacer dos veces el mismo trabajo.

### 2.4 El editor reescribe la definicion entera en cada cambio

Cada casilla marcada manda las paginas completas. Funciona y es simple, pero dos personas
editando el mismo borrador se pisarian —hoy no ocurre porque un borrador es de una sola persona—
y el dia que haya modulos grandes sera caro. La forma correcta es una operacion por cambio, como
`applyTreeOperation` en el arbol.

### 2.5 Objetos adjuntables en el editor

`tooltip-explicativo` y `tabla-de-datos` se validan, se dibujan y se exportan, y se pueden
declarar en la definicion de un modulo. El editor todavia no ofrece adjuntarlos: hay que
escribirlos en la definicion.

### 2.6 Paginas multiples en el editor

Un modulo admite varias paginas —el modelo, la validacion y el ruteo `/m/{slug}/{pagina}` estan
hechos— y el editor solo edita la primera.

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
