# Contingencia: perder el estado de gobierno

> Procedimiento operativo. Lo ejecuta una persona, no el codigo. Lo que el codigo hace es
> **detectarlo**, **volcarlo** y **devolverlo**, y negarse a devolver lo que no debe volver.

## Que problema resuelve

El gobierno de esta aplicacion —la organizacion general, los equipos, los ambitos, los paquetes,
las definiciones de modulo y su historial, la auditoria de configuracion, los marcadores, la
personalizacion, los codigos de incrustacion y las alertas— vive en el **almacen compartido**.

Ese estado tiene una propiedad que lo separa de todo lo demas: **no se puede reconstruir**. Los
datasets del cache si; son una copia de la fuente y el job los vuelve a traer. El gobierno lo
escribio una persona decidiendo quien ve que.

Y tiene un modo de fallo peor que perderse: **perderse sin que se note**. El gobierno y los
modulos caen a la semilla de demostracion cuando no hay nada guardado, lo cual es correcto para un
despliegue nuevo. Si el almacen pierde datos, la aplicacion **no falla**: arranca con los datos de
demostracion y parece sana. Alguien entra, ve una aplicacion que funciona, y no tiene por que
sospechar que los equipos que esta mirando no son los de la institucion.

## Lo que NO se hace

- **El respaldo no lleva las credenciales locales.** Llevan el secreto TOTP, y un archivo con ellas
  seria el segundo factor de toda la institucion en un solo sitio. Se recuperan por otro camino,
  mas abajo.
- **El respaldo no lleva sesiones ni tokens de un solo uso.** Devolverlos resucitaria sesiones que
  alguien revoco a proposito y enlaces de restablecimiento ya gastados. `restaurar` los rechaza
  aunque aparezcan en el archivo: la exclusion es una regla, no un descuido de quien volco.
- **No se copia el directorio del almacen.** Copiarlo se lleva precisamente lo de arriba, y ademas
  ata la copia al sistema de archivos: el dia que el almacen sea Blob o SQL —que es justo el dia en
  que esto importa— una copia de archivos no sirve.
- **La aplicacion no se respalda a si misma.** Un respaldo escrito por el proceso en el mismo disco
  que quiere proteger no protege de nada.

## Que es autoritativo y que se repuebla

La lista completa, con el motivo de cada decision, esta en `apps/shell/src/server/backup.ts` y es
la que usan los dos comandos. `npm run respaldo` la imprime al terminar. En resumen:

| Se respalda | No se respalda, y por que |
|---|---|
| Gobierno, modulos y su historial, auditoria de configuracion, catalogo, incrustaciones, marcadores, personalizacion, reglas y suscripciones de alerta, auditoria de acceso | Credenciales (segundo factor en claro) · sesiones y tokens (resucitarlos es un agujero) · exportaciones (plazo de 1 h) · datasets, esquema y latido (los repuebla el job) · centinelas |

Que ninguna clave se quede fuera de esa lista sin que nadie lo decida lo comprueba
`tools/coherence/respaldo.spec.ts`: una clave nueva sin clasificar pone la suite en rojo.

## RPO y RTO, dichos como son

- **RPO: desde la ultima vez que alguien ejecuto el comando.** Hoy el respaldo es manual, asi que
  la ventana de perdida es el intervalo entre ejecuciones. Programarlo desde fuera de la aplicacion
  es el siguiente paso, y hasta que exista este numero no es una promesa.
- **RTO: minutos**, para el estado. Restaurar es un comando. Lo que alarga la vuelta es el acceso:
  las credenciales no vuelven con el respaldo (ver mas abajo).

## El kit de recuperacion

Sin las tres cosas no se vuelve:

1. **El archivo de respaldo.**
2. **`AUTH_PEPPER`**, la misma con la que corria la aplicacion. Vive en Key Vault, que tiene
   borrado suave de 90 dias y proteccion de purga. Sin ella, las credenciales que se creen despues
   no verificaran contra nada de lo anterior.
3. **`CACHE_DIR`**, el directorio del almacen al que se restaura.

## Procedimiento de respaldo

```bash
CACHE_DIR=/ruta/al/almacen npm run respaldo -- /ruta/segura/respaldo-2026-09-15.json
```

Solo lee. Al terminar dice cuantas claves se llevo, de que prefijos, y **enumera lo que dejo
fuera con su motivo**: quien va a confiar en ese archivo tiene que saber que no contiene.

El archivo no es un secreto de acceso —no lleva credenciales— pero si es el gobierno entero de la
institucion: quien lo tenga sabe quien ve que. Se guarda donde se guarda la informacion interna,
no en un portatil.

## Procedimiento de restauracion

Requisitos previos: dos personas, quien ejecuta y quien atestigua, igual que en
`acceso-de-emergencia.md`. Restaurar reescribe el gobierno entero.

1. **Comprobar que hace falta.** `/health` lo dice: la comprobacion `estado-de-gobierno` en
   **caido** significa que este despliegue tuvo estado propio y ya no lo encuentra, y nombra las
   claves que faltan. Si dice `ok`, esto no es una contingencia.

   Si el almacen desaparecio ENTERO, `/health` no puede distinguirlo de un despliegue nuevo: el
   centinela se fue con todo lo demas. En ese caso lo que lo delata es que la aplicacion muestre la
   organizacion de demostracion —«Equipo Distrito Norte», «Equipo Distrito Este»— en lugar de la
   real.

2. **Abrir un registro ANTES de tocar nada**: quien ejecuta, quien atestigua, por que, y la hora.

3. **Mirar el respaldo EN SECO.** Sin `--aplicar` no se escribe nada:

   ```bash
   CACHE_DIR=/ruta/al/almacen npm run restaurar -- /ruta/segura/respaldo-2026-09-15.json
   ```

   Dice cuantas claves escribiria y cuales rechaza. Si el resumen no cuadra —muy pocas claves, una
   fecha que no es la que se esperaba— **el archivo no es el que se creia**, y se para aqui.

4. **Aplicar**, con `--aplicar`. Si el archivo esta alterado, la suma de comprobacion no cuadra y
   no se escribe **ni una sola clave**: media restauracion deja el gobierno en un estado que nadie
   tuvo nunca, y es peor que ninguna.

5. **Devolver el acceso**, que es lo que el respaldo no trae:

   ```bash
   CACHE_DIR=/ruta/al/almacen AUTH_PEPPER=... npm run crear-administrador -- <userId>
   ```

   El resto de las cuentas locales, por restablecimiento mediado desde `/admin/accounts`
   (ADR-013). Quien entre por Azure AD no necesita nada de esto.

6. **Comprobar por la aplicacion**, no por el archivo: entrar, abrir `/admin`, y ver que la
   organizacion, los equipos y los modulos son los que tienen que ser. `/health` vuelve a `ok`.

7. **Cerrar el registro** y **revisar la causa**. Un estado perdido no es un accidente meteorologico:
   o fue un borrado, o un despliegue, o el disco. Sin la causa, vuelve a pasar.

## Despues

- **Volver a respaldar**, ya sobre el estado restaurado.
- **Revisar la auditoria de configuracion** de las horas previas: si lo que se perdio fue un
  borrado dirigido, ahi esta quien lo hizo.
- **Avisar de las sesiones.** Todas las sesiones anteriores quedaron invalidadas —no se
  restauran— y quien estuviera dentro tendra que entrar de nuevo. Es deliberado.

## Lo que el codigo ya impide, y lo que no

**Impide** que una restauracion devuelva a la vida una sesion revocada o un token de un solo uso
ya gastado, aunque alguien los meta en el archivo a mano. **Impide** restaurar un respaldo alterado
o de un formato que esta version no sabe leer, y lo impide antes de escribir la primera clave.
**Impide** que una clave nueva del almacen se quede fuera del respaldo sin que nadie lo decida.

**Detecta** la perdida PARCIAL: el almacen sigue, pero falta lo que este despliegue llego a
escribir. Es el caso frecuente —un borrado, una migracion a medias, un despliegue que se llevo una
clave por delante— y `/health` lo reporta como caido.

**No detecta** la perdida TOTAL del almacen. Si desaparece entero, el centinela desaparece con el y
lo que queda es indistinguible de un despliegue nuevo. Desde dentro no hay nada desde donde mirar.
Lo cubre esto: el paso 1 de arriba, y la supervision de fuera.

**No protege** de que el almacen se pierda, solo de que la perdida sea definitiva. Hoy todo el
estado vive en el disco local de la instancia: `BlobCacheStore` esta escrito y probado, la
infraestructura ya crea el contenedor, y nadie lo instancia. Cablearlo es la accion que mas riesgo
quita, y esta anotada en el apartado 2.20 de la hoja de ruta.
