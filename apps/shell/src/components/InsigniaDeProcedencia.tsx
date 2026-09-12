/**
 * Si lo que se ve es la vista institucional o una personalizada — seccion 4.6.
 *
 * Es informacion sobre el ORIGEN de lo que hay en pantalla, asi que vive en la cabecera del
 * modulo, junto a la fecha del dato, y no entre los botones de accion: quien mira necesita
 * saberlo siempre, no solo cuando va a pulsar algo.
 */
export function InsigniaDeProcedencia({
  provenance,
}: {
  provenance: { isPersonalized: boolean; label: string };
}) {
  return (
    <span
      className={`insignia ${provenance.isPersonalized ? 'insignia--personalizada' : 'insignia--oficial'}`}
      data-testid="procedencia"
    >
      {provenance.label}
    </span>
  );
}
