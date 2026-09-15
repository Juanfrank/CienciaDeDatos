# apps/shell/src/server — el lado servidor

Todo lo que no llega al navegador. Aqui viven la sesion, la lectura del cache, el gobierno y las
exportaciones.

| Archivo | Responsabilidad |
|---|---|
| `session.ts`, `identity.ts` | Sesion, credenciales locales y TOTP. `identity.ts` es la UNICA puerta del almacen de credenciales: es donde el secreto TOTP se cifra y se descifra |
| `data.ts` | Lectura del cache y recorte por ambito. Es el unico camino a los datos |
| `context.ts`, `governance.ts` | Arbol, equipos, paquetes y usuarios |
| `admin.ts` | `assertAdmin`, la guarda de todas las rutas de administracion |
| `audit.ts` | Registro de cambios de configuracion |
| `modules.ts`, `moduleStore.ts`, `cicloDeVida.ts` | Definicion, almacen y estados de un modulo |
| `editor.ts` | Lo que el panel del editor necesita saber del catalogo |
| `exports.ts`, `worker.ts` | Documento exportable y cola |
| `theme.ts` | Modo de color pedido por cookie |
| `almacenCompartido.ts` | Estado que sobrevive a mas de una instancia |
| `backup.ts`, `installation.ts` | Respaldo del estado autoritativo y deteccion de que se perdio |

## Reglas

- **`assertAdmin` al principio de cada Route Handler de `/api/admin/*` y de cada pagina de
  `/admin`.** Ocultar el enlace no es proteger, y hay pruebas que piden las rutas a mano.
- **Ampliar un ambito exige justificacion escrita** y pasa por `assertConfigChangeIsAuditable`.
- **El estado de aplicacion vive en el almacen compartido**, no en variables de modulo: la
  aplicacion escala a mas de una instancia.
- **Nada de esto importa `IDataConnector`.** Los datos llegan del cache.

## Que NO hacer

- No leer `process.env` disperso: la configuracion se resuelve en `packages/config`.
- No confiar en que una comprobacion hecha en el cliente se haya hecho.
