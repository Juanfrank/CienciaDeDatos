'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslator } from '../Locale';
import type { DestinoPosible } from './TreeActions';
import { pedir, motivoDeFallo } from '../pedir';

/**
 * Crear un modulo y crear una carpeta, desde la propia tabla — secciones 4.1 y 4.10.8.
 *
 * Las dos cosas existian y ninguna se podia hacer desde aqui: para un modulo habia que irse al
 * editor, y una carpeta solo nacia editando el seed. La tabla es donde se mira la organizacion,
 * asi que es donde tiene sentido anadirle algo.
 *
 * Son DOS botones y no uno con un desplegable: crear un modulo y crear una carpeta no son
 * variantes de lo mismo. Un modulo nace como BORRADOR de quien lo crea y no lo ve nadie mas hasta
 * que se apruebe (4.1); una carpeta entra en la organizacion general en el acto, y lo que cuelgue
 * de ella heredara su ambito.
 */
export function CrearEnElArbol({
  destinos,
  soloCarpeta = false,
}: {
  destinos: DestinoPosible[];
  /**
   * En la organizacion general solo se crean CARPETAS.
   *
   * Un modulo no nace ahi: nace como borrador de alguien y entra en el arbol al publicarse, asi
   * que un boton de crearlo en esta pantalla prometeria colocarlo donde no se coloca.
   */
  soloCarpeta?: boolean;
}) {
  const t = useTranslator();
  const router = useRouter();
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogoModulo = useRef<HTMLDialogElement>(null);
  const dialogoCarpeta = useRef<HTMLDialogElement>(null);

  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [nombreCarpeta, setNombreCarpeta] = useState('');
  const [padre, setPadre] = useState<string>('__raiz__');

  /*
   * Crear el modulo lleva AL EDITOR, no de vuelta a la tabla.
   *
   * Un borrador recien creado esta vacio: dejar a quien lo crea mirando una fila nueva sin nada
   * dentro le obliga a buscarla y abrirla, que es el paso que de verdad queria dar.
   */
  const crearModulo = async () => {
    setEnCurso(true);
    setError(null);
    const respuesta = await pedir('/api/modules', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nombre, slug }),
    });
    setEnCurso(false);
    if (!respuesta?.ok) {
      setError(await motivoDeFallo(respuesta, t('admin.tree.action.failed')));
      return;
    }

    const cuerpo = (await respuesta.json()) as { modulo: { slug: string } };
    dialogoModulo.current?.close();
    router.push(`/editor/${cuerpo.modulo.slug}`);
  };

  const crearCarpeta = async () => {
    setEnCurso(true);
    setError(null);
    const respuesta = await pedir('/api/admin/tree', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'crear-carpeta',
        parentId: padre === '__raiz__' ? null : padre,
        // El id lo pone el cliente porque la operacion lo exige, y `crypto.randomUUID` esta en el
        // navegador desde hace anos. Lo que NO decide el cliente es si se puede crear: eso lo
        // comprueba `withAdmin` al otro lado, que es donde tiene que estar.
        id: `nodo-${crypto.randomUUID()}`,
        name: nombreCarpeta,
      }),
    });
    setEnCurso(false);
    if (!respuesta?.ok) {
      setError(await motivoDeFallo(respuesta, t('admin.tree.action.failed')));
      return;
    }

    dialogoCarpeta.current?.close();
    setNombreCarpeta('');
    router.refresh();
  };

  return (
    <>
      {error ? (
        <p className="aviso notice-error" role="alert" data-testid="crear-error">
          {error}
        </p>
      ) : null}

      <p className="barra-de-acciones">
        {soloCarpeta ? null : (
        <button
          type="button"
          className="pastilla"
          data-testid="abrir-crear-modulo"
          onClick={() => {
            setError(null);
            setNombre('');
            setSlug('');
            dialogoModulo.current?.showModal();
          }}
        >
          {t('admin.modules.create')}
        </button>
        )}

        <button
          type="button"
          className={soloCarpeta ? 'pastilla' : 'boton-contorno'}
          data-testid="abrir-crear-carpeta"
          onClick={() => {
            setError(null);
            setNombreCarpeta('');
            setPadre('__raiz__');
            dialogoCarpeta.current?.showModal();
          }}
        >
          {t('admin.tree.createFolder')}
        </button>
      </p>

      <dialog className="dialogo" ref={dialogoModulo} data-testid="dialogo-crear-modulo">
        <div className="dialogo__cabecera">
          <h2>{t('admin.modules.create')}</h2>
          <button
            type="button"
            className="boton-contorno"
            data-testid="cerrar-crear-modulo"
            onClick={() => dialogoModulo.current?.close()}
          >
            {t('action.cancel')}
          </button>
        </div>

        <p className="muted-text">{t('admin.modules.create.intro')}</p>

        <label className="form__field">
          <span>{t('list.name')}</span>
          <input
            value={nombre}
            data-testid="nuevo-modulo-nombre"
            onChange={(e) => {
              setNombre(e.target.value);
              // El slug se propone a partir del nombre y se puede cambiar. Escribirlo a mano
              // desde cero es donde salen los slugs con acentos y mayusculas que luego rechaza
              // la validacion, y la propuesta se queda corta en cuanto alguien lo edita.
              setSlug(sugerirSlug(e.target.value));
            }}
          />
        </label>

        <label className="form__field">
          <span>{t('list.slug')}</span>
          <input value={slug} data-testid="nuevo-modulo-slug" onChange={(e) => setSlug(e.target.value)} />
        </label>

        <button
          type="button"
          className="pastilla"
          disabled={enCurso || nombre.trim() === '' || slug.trim() === ''}
          data-testid="crear-modulo"
          onClick={() => void crearModulo()}
        >
          {t('list.createDraft')}
        </button>
      </dialog>

      <dialog className="dialogo" ref={dialogoCarpeta} data-testid="dialogo-crear-carpeta">
        <div className="dialogo__cabecera">
          <h2>{t('admin.tree.createFolder')}</h2>
          <button
            type="button"
            className="boton-contorno"
            data-testid="cerrar-crear-carpeta"
            onClick={() => dialogoCarpeta.current?.close()}
          >
            {t('action.cancel')}
          </button>
        </div>

        <p className="muted-text">{t('admin.tree.createFolder.intro')}</p>

        <label className="form__field">
          <span>{t('list.name')}</span>
          <input
            value={nombreCarpeta}
            data-testid="nueva-carpeta-nombre"
            onChange={(e) => setNombreCarpeta(e.target.value)}
          />
        </label>

        <label className="form__field">
          <span>{t('admin.tree.createFolder.parent')}</span>
          <select
            value={padre}
            data-testid="nueva-carpeta-padre"
            onChange={(e) => setPadre(e.target.value)}
          >
            {destinos.map((destino) => (
              <option key={destino.id ?? '__raiz__'} value={destino.id ?? '__raiz__'}>
                {destino.etiqueta}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="pastilla"
          disabled={enCurso || nombreCarpeta.trim() === ''}
          data-testid="crear-carpeta"
          onClick={() => void crearCarpeta()}
        >
          {t('action.add')}
        </button>
      </dialog>
    </>
  );
}

/** Nombre → slug: sin acentos, en minusculas y con guiones. Es lo que acepta la validacion. */
export function sugerirSlug(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
