# Registro de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Versionado segun [SemVer](https://semver.org/lang/es/).

Los objetos visuales llevan ademas **su propio versionado**, independiente del de
la aplicacion: cada objeto del catalogo se publica con `MAYOR.MENOR.PARCHE` y cada
instancia fija la version exacta que usa. Publicar una version nueva de un objeto
nunca altera las instancias ya desplegadas, asi que esos cambios aparecen aqui
como adiciones y jamas como rupturas.

## [Sin publicar]

### Anadido
- Licencia de uso interno sin redistribucion, aviso de componentes de terceros y
  declaracion de autoria.
- Este registro de cambios.

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
- Tema oscuro verificado con axe sobre las mismas paginas que el claro.
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
