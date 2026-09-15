import { translator } from '../../src/server/locale';

/** Pagina de acceso denegado al panel. */
export default async function WithoutPermission() {
  const t = await translator();
  return (
    <div className="vacio" data-testid="without-permission">
      <h1>{t('chrome.noPermission')}</h1>
      <p className="muted-text">
        {t('chrome.noPermission.admin')}
      </p>
    </div>
  );
}
