import { contrastRatio, lightTheme, darkTheme } from '../../packages/design-tokens/src/index';

for (const [nombre, t] of [['claro', lightTheme], ['oscuro', darkTheme]] as const) {
  const c = t.color;
  console.log(nombre, 'onPrimaryContainer', c.onPrimaryContainer, 'primaryContainer', c.primaryContainer);
  const pares: [string, string, string][] = [
    ['blanco sobre onPrimaryContainer', c.onPrimary, c.onPrimaryContainer],
    ['primaryContainer sobre onPrimaryContainer', c.primaryContainer, c.onPrimaryContainer],
    ['onPrimaryContainer sobre primaryContainer', c.onPrimaryContainer, c.primaryContainer],
    ['inverseOnSurface sobre inverseSurface', c.inverseOnSurface, c.inverseSurface],
  ];
  for (const [etiqueta, fg, bg] of pares) {
    console.log('  ', etiqueta, (contrastRatio(fg, bg) ?? 0).toFixed(2));
  }
}
