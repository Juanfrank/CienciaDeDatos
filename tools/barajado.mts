/**
 * La suite de unidad, varias veces y con el orden BARAJADO — apartado 2.19.
 *
 * Existe porque los procesos se reutilizan entre archivos de prueba (`isolate: false`, que baja la
 * suite de doce segundos a cuatro). El precio de eso es que el registro de modulos ya no es nuevo
 * por archivo: lo que un archivo deje puesto se lo encuentra el siguiente. Una suite que siempre
 * corre en el mismo orden no puede ver esa clase de fallo — pasa o no pasa, pero siempre igual, y
 * el dia que aparezca sera al anadir un archivo que no tiene nada que ver.
 *
 * No va en `npm run verify` a proposito. Barajar en cada verificacion convierte cada fallo en algo
 * que hay que reproducir a ciegas, y un rojo que no se reproduce se termina ignorando. Esto es
 * para el pase nocturno y para cuando se toca el estado de proceso.
 *
 * LO QUE LO HACE UTIL ES LA SEMILLA. Cada pasada la elige, la imprime antes de correr y, si falla,
 * deja escrita la orden exacta que repite ESE orden. Sin eso seria un generador de rojos
 * irrepetibles, que es peor que no tenerlo.
 *
 *   npm run test:barajado         # diez pasadas
 *   npm run test:barajado -- 30   # treinta
 */
import { spawnSync } from 'node:child_process';

const PASADAS = Number(process.argv[2] ?? 10);

if (!Number.isInteger(PASADAS) || PASADAS < 1) {
  console.error(`Numero de pasadas invalido: '${process.argv[2]}'. Tiene que ser un entero >= 1.`);
  process.exit(2);
}

const ordenDe = (semilla: number) => [
  'vitest',
  'run',
  '--sequence.shuffle',
  `--sequence.seed=${semilla}`,
];

console.log(`Barajado: ${PASADAS} pasada(s) de la suite de unidad.\n`);

for (let i = 1; i <= PASADAS; i += 1) {
  // Entera y acotada: la semilla se imprime y se vuelve a teclear, asi que tiene que ser corta.
  const semilla = Math.floor(Math.random() * 1_000_000);
  const etiqueta = `pasada ${String(i).padStart(String(PASADAS).length)}/${PASADAS}  semilla ${semilla}`;

  const inicio = Date.now();
  // La salida se hereda solo cuando falla: en verde, diez pasadas completas serian mil lineas.
  const resultado = spawnSync('npx', ordenDe(semilla), { encoding: 'utf8' });
  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);

  if (resultado.status === 0) {
    console.log(`  ✓ ${etiqueta}  (${segundos} s)`);
    continue;
  }

  console.error(`  ✗ ${etiqueta}  (${segundos} s)\n`);
  console.error(resultado.stdout ?? '');
  console.error(resultado.stderr ?? '');
  console.error(
    '\nEse orden se repite exactamente con:\n\n' +
      `    npx ${ordenDe(semilla).join(' ')}\n\n` +
      'Un fallo aqui casi nunca es de la prueba que se pone roja: es de lo que dejo puesto la\n' +
      'que corrio antes. Ver el apartado 2.19 de la hoja de ruta.\n',
  );
  process.exit(1);
}

console.log(`\n${PASADAS} pasada(s) en verde, cada una con otro orden.`);
