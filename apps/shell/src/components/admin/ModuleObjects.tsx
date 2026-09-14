import Link from 'next/link';
import type { MessageKey, Translator } from '@app/i18n';
import type { ObjetoEnModulo } from '../../server/recursos';
import { BumpModule } from './BumpModule';

/**
 * Que hay dentro de un modulo, sin salir de la lista — seccion 4.5.
 *
 * La columna decia un numero. Un numero no responde a la pregunta que se hace mirandolo, que es
 * «¿y por que este modulo no se parece a los demas?». Lo que responde es el desplegable: cada
 * objeto, la version que fija, y si esa version ya no es la ultima, el boton de subirla ahi mismo.
 *
 * Va plegado porque un modulo con quince objetos convertiria la tabla en una pared de texto.
 */
export function ModuleObjects({
  slug,
  objetos,
  t,
}: {
  slug: string;
  objetos: ObjetoEnModulo[];
  t: Translator;
}) {
  if (objetos.length === 0) {
    return <span className="muted-text">{t('admin.modules.objects.none')}</span>;
  }

  const atrasados = objetos.filter((o) => o.atrasada).length;

  return (
    <details data-testid={`objetos-${slug}`}>
      <summary>
        {t('admin.modules.objects.count', { n: objetos.length })}
        {atrasados > 0 ? (
          <>
            {' '}
            <span className="insignia badge--error" data-testid={`objetos-atrasados-${slug}`}>
              {t('admin.modules.objects.behind', { n: atrasados })}
            </span>
          </>
        ) : null}
      </summary>

      <table className="tabla tabla--anidada">
        <thead>
          <tr>
            <th scope="col">{t('admin.modules.objects.column.object')}</th>
            <th scope="col">{t('admin.modules.objects.column.version')}</th>
            <th scope="col">{t('admin.modules.objects.column.instances')}</th>
            <th scope="col">{t('admin.resources.column.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {objetos.map((o) => (
            <tr key={`${o.objectId}@${o.version}`} data-testid={`objeto-${slug}-${o.objectId}-${o.version}`}>
              <th scope="row">
                {/* El nombre lleva a donde mas se usa ese objeto: es la otra mitad de la misma
                    pregunta, leida desde el catalogo. */}
                <Link href={`/admin/resources/usage/${o.objectId}`}>{o.name}</Link>{' '}
                <span className="muted-text">{t(CATEGORIA[o.category] ?? 'admin.modules.objects.category.other')}</span>
              </th>
              <td>
                v{o.version} <Vigencia objeto={o} t={t} />
              </td>
              <td>{o.instancias}</td>
              <td>
                {o.atrasada ? (
                  <BumpModule
                    slug={slug}
                    objectId={o.objectId}
                    desde={o.version}
                    hasta={o.ultima}
                  />
                ) : (
                  <span className="muted-text">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/**
 * Si la version fijada es la ultima, una vieja, o de un objeto que ya no existe.
 *
 * Con nombre y no como ternario anidado, por lo mismo que en `AssetTable`: la rama del medio se
 * queda en una linea que el trinquete de cadenas sueltas cuenta como prosa de pantalla.
 */
function Vigencia({ objeto, t }: { objeto: ObjetoEnModulo; t: Translator }) {
  if (objeto.desconocido) {
    return <span className="insignia badge--error">{t('admin.modules.objects.unknown')}</span>;
  }
  if (objeto.atrasada) {
    return (
      <span className="insignia badge--error">
        {t('admin.modules.objects.latestIs', { version: objeto.ultima })}
      </span>
    );
  }
  return <span className="insignia">{t('admin.usage.latest')}</span>;
}

/** La categoria del catalogo, dicha en la lengua de quien mira. */
const CATEGORIA: Partial<Record<ObjetoEnModulo['category'], MessageKey>> = {
  grafico: 'admin.modules.objects.category.chart',
  tabla: 'admin.modules.objects.category.table',
  indicador: 'admin.modules.objects.category.indicator',
  filtro: 'admin.modules.objects.category.filter',
  mapa: 'admin.modules.objects.category.map',
  elemento: 'admin.modules.objects.category.element',
  contenedor: 'admin.modules.objects.category.container',
  complemento: 'admin.modules.objects.category.addon',
};
