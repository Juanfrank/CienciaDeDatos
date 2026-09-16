# Registro de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Versionado segun [SemVer](https://semver.org/lang/es/).

Los objetos visuales llevan ademas **su propio versionado**, independiente del de
la aplicacion: cada objeto del catalogo se publica con `MAYOR.MENOR.PARCHE` y cada
instancia fija la version exacta que usa. Publicar una version nueva de un objeto
nunca altera las instancias ya desplegadas, asi que esos cambios aparecen aqui
como adiciones y jamas como rupturas.

## [Sin publicar]

### Seguridad
- **El secreto TOTP se guarda cifrado.** Se escribia en claro pese a un comentario que prometia lo
  contrario. Es una credencial completa y permanente: quien leyera el almacen podria generar codigos
  validos indefinidamente. Ahora va en un sobre AES-256-GCM cuya clave se deriva de `AUTH_PEPPER`,
  ligado ademas a la cuenta, de modo que un sobre copiado de una cuenta a otra no descifra. No hace
  falta configurar nada: los registros existentes se cifran la primera vez que se leen, y
  `npm run cifrar-totp` alcanza las cuentas que nadie lee. Un secreto que no se pueda descifrar
  impide entrar en vez de dejar entrar sin segundo factor.
- El webhook de refresco de datasets RECHAZA cuando `WEBHOOK_SECRET` no esta configurado, en vez
  de dejar pasar. Antes, sin la variable puesta, cualquiera podia invalidar entradas del cache.
  La comparacion del secreto pasa a ser de tiempo constante.
- Cabeceras en toda respuesta: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
  y, solo en produccion, `Strict-Transport-Security`.

### Corregido
- El inicio de sesion no funcionaba: la ruta leia `correo` y `codigo` cuando el formulario ya
  mandaba `mail` y `code`.
- Cuatro frases se leian en ingles en la interfaz: «Su role aqui», «limita esta view a», «Data de
  source» y «Tab 1». Tambien `(all)` en el desplegable del panel de filtros.
- El panel lateral no se plegaba: el selector del CSS esperaba un atributo con otro nombre.

### Anadido
- **Mapa de calor.** Dos dimensiones cruzadas —materia por trimestre— con la intensidad diciendo
  donde se concentra la carga. La cifra va dentro de la celda y la tabla alternativa las lleva
  todas: el color esta para ver el patron de un vistazo, no en lugar del dato. Admite escala
  divergente para las medidas que tienen un punto medio con sentido, como una variacion contra el
  objetivo.
- **Diagrama de caja.** Compara la forma de una medida entre grupos: los dias de resolucion
  materia a materia, cada una con su mediana, sus cuartiles y los expedientes que se salen del
  resto. Los atipicos se pueden apagar, los bigotes se pueden llevar hasta el minimo y el maximo, y
  la media se puede marcar junto a la mediana — que se separen es lo que dice que la distribucion
  esta sesgada.
- **Histograma.** Un objeto nuevo para la pregunta que el catalogo no sabia contestar: no cuanto
  tarda de media un expediente, sino cuanto tarda cada uno. Reparte las observaciones de una medida
  en intervalos —automaticos o los que se pidan—, y puede leerse como acumulado, que es lo que
  contesta «que parte se resolvio en menos de N dias». Admite una linea de referencia sobre el
  plazo, anclada al eje de los dias. Necesita un dataset con una fila por caso, y lo dice.
- **Contingencia contra desastres del estado de gobierno.** `npm run respaldo` vuelca a un archivo
  todo lo que no se puede reconstruir —organizacion, equipos, ambitos, paquetes, modulos y su
  historial, auditoria, marcadores, personalizacion, incrustaciones y alertas— y `npm run restaurar`
  lo devuelve, en seco por defecto. El procedimiento esta en `docs/operations/contingencia.md`.
  El respaldo NO se lleva las credenciales locales, ni las sesiones, ni los tokens de un solo uso:
  devolverlos resucitaria sesiones revocadas y enlaces ya gastados.
- **`/health` avisa cuando el estado se perdio.** Hasta ahora, un almacen que perdiera datos no
  hacia fallar nada: la aplicacion volvia a los datos de demostracion y respondia 200. Ahora la
  comprobacion `estado-de-gobierno` lo reporta como caido y dice que falta.
- Licencia de uso interno sin redistribucion, aviso de componentes de terceros y
  declaracion de autoria.
- Este registro de cambios.
- `@app/i18n`: catalogos en sintaxis ICU MessageFormat con espanol e ingles,
  plurales por `Intl.PluralRules`, negociacion BCP 47 y formateadores de numero,
  fecha y lista atados al idioma. El idioma de la aplicacion sigue siendo el
  espanol y solo lo cambia la cookie `idioma`.
- `<html lang>` refleja el idioma en uso, que es lo que usa un lector de pantalla
  para elegir voz.

## [1.0.0] — 2026-09-13

Primera version completa de la capa de visualizacion.

### Anadido — objetos visuales
- Doce tipos de grafico: columnas, barras horizontales, lineas, area, pastel,
  dona, medidor, combinado, dispersion, embudo, cascada y mapa de arbol.
- Tabla, matriz jerarquica con subtotales, tarjeta KPI, segmentador y panel de
  filtros con seis tipos de selector.
- Elementos que no consumen datos —cuadro de texto, titulo de seccion, linea,
  forma y conexion— y cuatro contenedores: simple, desplazable, ampliable y con
  pestanas.
- Objetos adjuntables: tooltip explicativo y tabla de datos de origen.
- Veintiseis claves de presentacion: leyenda, etiquetas de dato, ejes, orden,
  apilado, lineas de referencia, colores de serie, tooltip, pequenos multiplos,
  formato condicional y formato numerico por medida, entre otras.

### Anadido — editor
- Construccion de modulos sin escribir codigo: paleta agrupada por la pregunta
  que responde cada objeto, pozos de campos con nombre, arrastrar y redimensionar
  sobre el lienzo, y vista previa con datos reales.
- Panel de formato con buscador sobre dieciocho secciones.
- Ciclo de vida de modulo: borrador, publicado y retirado.

### Anadido — gobierno y acceso
- Arbol de organizacion, equipos, paquetes de modulos y matriz de permisos.
- Ambito de acceso que solo puede restringir; ampliar exige justificacion escrita
  y queda destacado en auditoria.
- Panel de administracion con las siete superficies de gestion, incluida la vista
  de «quien ve que» con la carpeta que origino cada restriccion.
- Autenticacion dual: Azure AD y credenciales locales con segundo factor TOTP.

### Anadido — datos
- Job de poblacion de cache como proceso aparte: ninguna peticion de una persona
  llega a la fuente.
- Cache por dataset y ambito, con implementaciones en disco, en memoria y sobre
  Azure Blob Storage.
- Validacion de cada mapeo contra el esquema real antes de guardar.

### Anadido — presentacion y accesibilidad
- Tema institucional en Material Design 3, con puerta de contraste que ningun
  modulo puede publicarse sin pasar.
- Tema dark verificado con axe sobre las mismas paginas que el light.
- Diseno responsivo a 390, 820 y 1280 px.
- Respaldo accesible de cada grafico y filtrado cruzado por raton y por teclado.

### Anadido — exportacion y avisos
- Exportacion encolada a CSV, XLSX, PDF y SVG desde un documento comun.
- Alertas y suscripciones basadas en datos.

### Anadido — verificacion
- 1171 pruebas unitarias y 414 de navegador.
- Verificador nx con typecheck, lint, limites de dependencia, esquema Prisma y
  compilacion de infraestructura; las pruebas de navegador corren en CI.

### Corregido
Durante el desarrollo se detectaron y corrigieron, entre otros:
- Los formateadores de cifra no llegaban al grafico: `JSON.stringify` borraba
  cada `formatter` y las cifras salian sin formato.
- El diseno movil no funcionaba: tres fallos encadenados en la rejilla, y la
  prueba que lo guardaba pasaba por coincidencia.
- El filtrado cruzado estaba a medias en casi todos los objetos.
- Trece reglas de CSS usaban una variable tipografica que el tema no emitia, asi
  que el navegador descartaba la declaracion entera.
- Las barras horizontales coloreaban por valor desde el primer dia sin que el
  editor lo ofreciera.
- La matriz no tenia formato condicional aunque compartia contrato con la tabla.
- El respaldo accesible del medidor no decia la escala, que es lo que convierte
  una cifra en un medidor.
