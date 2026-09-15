import type { MessageKey, Translator } from '@app/i18n';
import type {
  AccesoDeQuienesAdministran,
  ImpedimentoDeAcceso,
} from '../../server/admin';

/**
 * Si quienes administran pueden ademas ENTRAR — apartado 2.8 de la hoja de ruta.
 *
 * Sale en las dos pantallas donde la pregunta se hace de verdad: en equipos, junto a quienes
 * administran, y en usuarios, junto al estado de sus cuentas. Dividirlo —el rol en una pantalla y
 * la cuenta en otra— es exactamente lo que hacia que nadie cruzara las dos cosas hasta la
 * emergencia.
 *
 * Es un aviso, no un bloqueo, y el texto dice que se comprobo: la cuenta local. Que la identidad de
 * Azure AD siga activa lo sabe Azure, y prometer aqui una comprobacion que no se hace seria peor
 * que no avisar.
 */
const CLAVE_DEL_MOTIVO: Record<ImpedimentoDeAcceso, MessageKey> = {
  'sin-cuenta': 'admin.adminAccess.reason.noAccount',
  bloqueada: 'admin.adminAccess.reason.locked',
  'sin-segundo-factor': 'admin.adminAccess.reason.noSecondFactor',
};

export function AdminAccess({
  acceso,
  t,
}: {
  acceso: AccesoDeQuienesAdministran;
  t: Translator;
}) {
  const impedidos = acceso.quienes.filter((q) => q.impedimento !== undefined);
  const detalle = t.lista(
    impedidos.map((q) =>
      t('admin.adminAccess.impeded', {
        quien: q.userId,
        // El filtro de arriba ya lo garantiza, pero el tipo no lo sabe.
        motivo: t(CLAVE_DEL_MOTIVO[q.impedimento ?? 'sin-cuenta']),
      }),
    ),
  );

  return (
    <p
      className={acceso.gravedad === 'ok' ? 'aviso' : 'aviso notice-atencion'}
      data-testid="acceso-administradores"
    >
      {acceso.gravedad === 'ok'
        ? t('admin.adminAccess.ok', { n: acceso.conAccesoPropio })
        : acceso.gravedad === 'atencion'
          ? t('admin.adminAccess.federated', { detalle })
          : t('admin.adminAccess.none', { detalle })}
    </p>
  );
}
