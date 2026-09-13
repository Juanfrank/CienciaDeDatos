/** Si lo que se ve es la vista institucional o una personalizada — seccion 4.6. */
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
