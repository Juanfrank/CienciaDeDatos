import Link from 'next/link';
import { translator } from '../../src/server/locale';

export const metadata = { title: 'Sin permiso para editar' };

export default async function WithoutEditorPermission() {
  const t = await translator();
  return (
    <div className="vacio">
      <h1 data-testid="without-permission-editor">{t('chrome.noPermission')}</h1>
      <p className="muted-text">
        Crear y edit modulos esta reservado a los roles Colaborador y Administrador (4.10.1). Su
        rol permite ver los modulos de sus equipos y personalizar su view.
      </p>
      <Link href="/" className="boton-contorno">
        {t('chrome.backToModules')}
      </Link>
    </div>
  );
}
