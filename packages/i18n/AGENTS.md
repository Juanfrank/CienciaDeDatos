# packages/i18n — internacionalizacion

El idioma de la aplicacion es el espanol y asi seguira. Lo que esta capa aporta es que ninguna
cadena visible viva dentro de un componente: anadir un idioma es escribir un catalogo, no
recorrer trescientos archivos buscando comillas.

| Archivo | Que es |
|---|---|
| `locales.ts` | Idiomas admitidos y negociacion BCP 47 |
| `formato.ts` | Formateo ICU MessageFormat: interpolacion, numero, plural y select |
| `catalogo/es.ts` | Catalogo de REFERENCIA. Se escribe primero |
| `catalogo/en.ts` | Ingles. Atado por tipo al de referencia |
| `traductor.ts` | `crearTraductor(locale)` y los formateadores de `Intl` |

## Reglas

- **El mensaje es una frase completa.** Lo que varia va como argumento ICU, nunca como
  concatenacion: el orden de las palabras cambia entre idiomas y un traductor que recibe
  fragmentos no puede hacer su trabajo.
- **Los plurales se escriben con `{n, plural, ...}`**, no con un ternario sobre `n === 1`. El
  espanol tiene dos categorias y el arabe seis; `Intl.PluralRules` lo resuelve por idioma.
- **Los numeros y las fechas salen de `t.numero` y `t.fecha`**, nunca de `toLocaleString()` sin
  argumento: sin idioma explicito sale el del servidor, que no es el de quien mira.
- **La clave describe QUE dice el mensaje, no donde aparece.** Una cadena que se usa en dos
  pantallas tiene una clave, no dos.
- **`en` es un `Record<ClaveDeMensaje, string>`**: una clave nueva en espanol no compila hasta
  que se traduce, y una que sobra tampoco.

## Que NO hacer

- No escribir una cadena visible dentro de un componente.
- No partir una frase para insertar un valor en medio.
- No traducir identificadores, `objectId`, nombres de dataset ni claves de presentacion: son
  contrato, no texto.
- No anadir un catalogo por region (`es-DO`): se negocia por subetiqueta primaria.
