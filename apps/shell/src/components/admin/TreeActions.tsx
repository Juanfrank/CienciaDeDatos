'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import type { ModuleStatus } from '@app/module-model';
import { useTranslator } from '../Locale';
import { Icon } from '../icons/Icon';
import { pedir, motivoDeFallo } from '../pedir';

/**
 * Las acciones de una fila del arbol — secciones 4.1 y 4.10.8.
 *
 * Van como icono y no como texto porque son seis por fila y en un arbol de veinte filas eso son
 * ciento veinte palabras. Cada una lleva su nombre en `title` y en `aria-label`, que es lo que
 * 4.9 exige: un lector de pantalla las anuncia enteras y el raton las ensena al pasar por encima.
 *
 * Subir, bajar y mover a escriben por `/api/admin/tree`, que es el MISMO camino que el editor del
 * arbol. Mover no es cosmetico —si la carpeta de destino tiene otro ambito, lo que se mueve
 * hereda ese ambito de inmediato (4.1.2)— y por eso el destino se elige y se confirma, no se
 * arrastra sin mas.
 */
export interface DestinoPosible {
  id: string | null;
  /** Con la sangria ya puesta, para que se lea como el arbol que es. */
  etiqueta: string;
}

/**
 * Lo que una fila de MODULO puede hacer con su estado. Una carpeta no lo lleva.
 *
 * Va como un objeto y no como tres banderas sueltas porque las tres salen del mismo sitio —el
 * estado del modulo y el papel de quien mira— y separarlas habria dejado dibujar a la vez
 * «retirar» y «restablecer», que es una fila diciendo dos cosas incompatibles.
 */
export interface CicloDeModulo {
  slug: string;
  status: ModuleStatus;
  /** Si quien mira puede ABRIR el modulo. Un borrador ajeno no lo ve ni un Administrador. */
  verPuede: boolean;
  /** Retirar y restablecer son de Administrador; eliminar, de quien puede borrar. */
  retirarPuede: boolean;
  borrarPuede: boolean;
}

export function TreeActions({
  nodeId,
  hidden,
  indice,
  puedeSubir,
  puedeBajar,
  destinos,
  hrefConfigurar,
  hrefPermisos,
  editable,
  ciclo,
  nombre,
}: {
  nodeId: string;
  hidden: boolean;
  /*
   * Posicion actual entre sus hermanos.
   *
   * Viaja desde el servidor porque `reordenar` toma un indice ABSOLUTO, y el cliente no conoce el
   * arbol. Inventar aqui una operacion relativa habria dado un segundo camino para lo mismo, que
   * es como acaban dos comportamientos distintos para el mismo gesto.
   */
  indice: number;
  /** El primero de su carpeta no sube, el ultimo no baja: el boton se apaga, no falla al pulsarlo. */
  puedeSubir: boolean;
  puedeBajar: boolean;
  destinos: DestinoPosible[];
  hrefConfigurar: string;
  hrefPermisos: string;
  /**
   * El slug del modulo PUBLICADO de esta fila, si lo es. Las carpetas no lo llevan.
   *
   * Editar no aplica a una carpeta —no tiene contenido que editar, tiene hijos— ni a un borrador,
   * que ya se abre en el editor directamente. Sin esto el boton se APAGA, no desaparece: cuando
   * desaparecia, toda la fila de iconos se corria un sitio y dos filas contiguas dejaban de tener
   * sus acciones en la misma columna.
   */
  editable?: string;
  /** El estado del modulo de esta fila. Las carpetas no lo llevan: no tienen ciclo de vida. */
  ciclo?: CicloDeModulo;
  /** Para los rotulos accesibles: «Subir: Distrito Norte» dice mas que «Subir». */
  nombre: string;
}) {
  const t = useTranslator();
  const router = useRouter();
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moviendo, setMoviendo] = useState(false);
  const [retirando, setRetirando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [borrando, setBorrando] = useState(false);

  /*
   * El destino elegido ESPERA a que alguien vea lo que implica.
   *
   * Mover no es cosmetico: si la carpeta de destino tiene otro ambito, lo que se mueve hereda ese
   * ambito de inmediato y cambia quien lo ve (4.1.2). Esto lo avisaba el editor de arbol anterior
   * y la tabla no, asi que al sustituirlo se habria perdido la unica pantalla donde constaba el
   * cambio de acceso ANTES de aplicarlo — y lo que se pierde ahi no se nota hasta que alguien ve
   * datos que no le tocan.
   */
  const [confirmar, setConfirmar] = useState<Confirmacion | null>(null);

  const enviar = async (operacion: Record<string, unknown>) => {
    setEnCurso(true);
    setError(null);
    const respuesta = await pedir('/api/admin/tree', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(operacion),
    });
    setEnCurso(false);
    if (!respuesta?.ok) {
      setError(await motivoDeFallo(respuesta, t('admin.tree.action.failed')));
      return;
    }
    setMoviendo(false);
    setConfirmar(null);
    router.refresh();
  };

  /**
   * Transiciones del ciclo de vida. Mismo camino que el editor: `/api/modules/{slug}/status`.
   *
   * Ni retirar ni restablecer tocan el arbol, asi que no pasan por `enviar`: lo que cambia es el
   * ESTADO del modulo, y el nodo se queda donde esta — la poda por estado ya lo quita de la
   * navegacion de quien no deba verlo.
   */
  const estado = async (slug: string, cuerpo: Record<string, unknown>) => {
    setEnCurso(true);
    setError(null);
    const respuesta = await pedir(`/api/modules/${slug}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    setEnCurso(false);
    if (!respuesta?.ok) {
      setError(await motivoDeFallo(respuesta, t('admin.tree.action.failed')));
      return;
    }
    setRetirando(false);
    setMotivo('');
    router.refresh();
  };

  /** Borrado definitivo del modulo. Se lleva por delante su nodo del arbol, del lado servidor. */
  const eliminar = async (slug: string) => {
    setEnCurso(true);
    setError(null);
    const respuesta = await pedir(`/api/modules/${slug}/edit`, { method: 'DELETE' });
    setEnCurso(false);
    if (!respuesta?.ok) {
      setError(await motivoDeFallo(respuesta, t('admin.tree.action.failed')));
      return;
    }
    setBorrando(false);
    router.refresh();
  };

  /** Pregunta al servidor que cambia, y solo mueve directamente si no cambia nada. */
  const pedirMovimiento = async (destino: DestinoPosible) => {
    setEnCurso(true);
    setError(null);
    const respuesta = await pedir('/api/admin/tree?previsualizar=1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'mover', nodeId, newParentId: destino.id }),
    });
    setEnCurso(false);
    if (!respuesta?.ok) {
      setError(await motivoDeFallo(respuesta, t('admin.tree.action.failed')));
      return;
    }

    const previo = (await respuesta.json()) as {
      cambiaElAmbito: boolean;
      moduleIds: string[];
    };
    if (!previo.cambiaElAmbito) {
      await enviar({ type: 'mover', nodeId, newParentId: destino.id });
      return;
    }
    setConfirmar({ destino, moduleIds: previo.moduleIds });
  };

  const rotuloVisible = hidden ? t('admin.tree.action.show') : t('admin.tree.action.hide');

  /*
   * Editar NO edita: abre una revision, que es un borrador aparte.
   *
   * Lo que se sirve sigue sirviendose mientras tanto, y el cambio pasa por la misma aprobacion
   * que cualquier propuesta. Antes la unica forma de tocar algo publicado era devolverlo a
   * borrador, y eso lo retiraba de la navegacion de toda la institucion mientras se editaba.
   */
  const editar = async () => {
    setEnCurso(true);
    setError(null);
    const respuesta = await pedir(`/api/modules/${editable}/revision`, { method: 'POST' });
    setEnCurso(false);
    // Sin respuesta no hay cuerpo que leer: se sale por el mismo camino de error, diciendo que
    // no hubo conexion en vez de intentar interpretar una respuesta que no existe.
    if (!respuesta) {
      setError(await motivoDeFallo(null, t('admin.tree.action.failed')));
      return;
    }
    const cuerpo = (await respuesta.json().catch(() => ({}))) as {
      error?: string;
      modulo?: { slug: string };
    };
    if (!respuesta.ok || !cuerpo.modulo) {
      setError(cuerpo.error ?? t('admin.tree.action.failed'));
      return;
    }
    router.push(`/editor/${cuerpo.modulo.slug}`);
  };

  return (
    <>
      <span className="fila-acciones">
        <button
          type="button"
          className="button-link"
          disabled={enCurso || !puedeSubir}
          title={t('admin.tree.action.up')}
          aria-label={`${t('admin.tree.action.up')}: ${nombre}`}
          data-testid={`subir-${nodeId}`}
          onClick={() => void enviar({ type: 'reordenar', nodeId, index: indice - 1 })}
        >
          <Icon nombre="flecha-arriba" tamano={18} />
        </button>

        <button
          type="button"
          className="button-link"
          disabled={enCurso || !puedeBajar}
          title={t('admin.tree.action.down')}
          aria-label={`${t('admin.tree.action.down')}: ${nombre}`}
          data-testid={`bajar-${nodeId}`}
          onClick={() => void enviar({ type: 'reordenar', nodeId, index: indice + 1 })}
        >
          <Icon nombre="flecha-abajo" tamano={18} />
        </button>

        <button
          type="button"
          className="button-link"
          disabled={enCurso}
          title={t('admin.tree.action.moveTo')}
          aria-label={`${t('admin.tree.action.moveTo')}: ${nombre}`}
          aria-expanded={moviendo}
          data-testid={`mover-${nodeId}`}
          onClick={() => setMoviendo((previo) => !previo)}
        >
          <Icon nombre="mover" tamano={18} />
        </button>

        <button
          type="button"
          className="button-link"
          disabled={enCurso}
          title={rotuloVisible}
          aria-label={`${rotuloVisible}: ${nombre}`}
          aria-pressed={hidden}
          data-testid={`ocultar-${nodeId}`}
          onClick={() => void enviar({ type: 'ocultar', nodeId, hidden: !hidden })}
        >
          <Icon nombre={hidden ? 'ojo-tachado' : 'ojo'} tamano={18} />
        </button>

        {/*
          El lapiz esta SIEMPRE, apagado cuando no aplica.
          Antes desaparecia en las carpetas y en los borradores, y con el desaparecia la columna
          entera un icono hacia la izquierda: las acciones de dos filas contiguas dejaban de
          quedar alineadas, y encontrar «configurar» pasaba a ser leer los dibujos uno a uno.
        */}
        <button
          type="button"
          className="button-link"
          disabled={enCurso || !editable}
          title={editable ? t('admin.tree.action.edit') : t('admin.tree.action.edit.disabled')}
          aria-label={`${t('admin.tree.action.edit')}: ${nombre}`}
          data-testid={`editar-${nodeId}`}
          onClick={() => void editar()}
        >
          <Icon nombre="editar" tamano={18} />
        </button>

        <Link
          href={hrefConfigurar}
          className="button-link"
          title={t('admin.tree.action.configure')}
          aria-label={`${t('admin.tree.action.configure')}: ${nombre}`}
          data-testid={`configurar-${nodeId}`}
        >
          <Icon nombre="tuerca" tamano={18} />
        </Link>

        <Link
          href={hrefPermisos}
          className="button-link"
          title={t('admin.tree.action.permissions')}
          aria-label={`${t('admin.tree.action.permissions')}: ${nombre}`}
          data-testid={`permisos-${nodeId}`}
        >
          <Icon nombre="persona-ojo" tamano={18} />
        </Link>

        {/*
          Las acciones del ESTADO, al final y solo las que caben en este estado.
          Un modulo publicado se retira; uno retirado se restablece o se borra; un borrador y una
          propuesta se ven. Ninguna de las cuatro se dibuja apagada cuando no aplica, al reves
          que el lapiz: aquella es la misma accion sin objeto, y estas son acciones distintas.
        */}
        {ciclo?.status === 'borrador' || ciclo?.status === 'pendiente-de-aprobacion' ? (
          <Link
            href={`/m/${ciclo.slug}`}
            className={`button-link${ciclo.verPuede ? '' : ' button-link--disabled'}`}
            title={
              ciclo.verPuede ? t('admin.tree.action.view') : t('admin.tree.action.view.disabled')
            }
            aria-label={`${t('admin.tree.action.view')}: ${nombre}`}
            // Un borrador ajeno no lo ve ni un Administrador (4.1), asi que el enlace se apaga
            // en vez de llevar a un 404 que se leeria como que el modulo no existe.
            aria-disabled={!ciclo.verPuede}
            {...(ciclo.verPuede ? {} : { tabIndex: -1 })}
            data-testid={`ver-${nodeId}`}
          >
            <Icon nombre="view" tamano={18} />
          </Link>
        ) : null}

        {ciclo?.status === 'publicado' && ciclo.retirarPuede ? (
          <button
            type="button"
            className="button-link"
            disabled={enCurso}
            title={t('admin.tree.action.withdraw')}
            aria-label={`${t('admin.tree.action.withdraw')}: ${nombre}`}
            aria-expanded={retirando}
            data-testid={`retirar-${nodeId}`}
            onClick={() => setRetirando((previo) => !previo)}
          >
            <Icon nombre="retirar" tamano={18} />
          </button>
        ) : null}

        {ciclo?.status === 'retirado' && ciclo.retirarPuede ? (
          <button
            type="button"
            className="button-link"
            disabled={enCurso}
            title={t('admin.tree.action.restore')}
            aria-label={`${t('admin.tree.action.restore')}: ${nombre}`}
            data-testid={`restablecer-${nodeId}`}
            onClick={() => void estado(ciclo.slug, { transition: 'restablecer' })}
          >
            <Icon nombre="restablecer" tamano={18} />
          </button>
        ) : null}

        {ciclo?.status === 'retirado' && ciclo.borrarPuede ? (
          <button
            type="button"
            className="button-link"
            disabled={enCurso}
            title={t('admin.tree.action.delete')}
            aria-label={`${t('admin.tree.action.delete')}: ${nombre}`}
            aria-expanded={borrando}
            data-testid={`eliminar-${nodeId}`}
            onClick={() => setBorrando((previo) => !previo)}
          >
            <Icon nombre="papelera" tamano={18} />
          </button>
        ) : null}
      </span>

      {/*
        El destino se ELIGE de una lista del arbol, no se escribe.
        Y se avisa de lo que implica: mover algo a una carpeta con otro ambito cambia quien lo ve,
        de inmediato y sin volver a preguntar.
      */}
      {moviendo ? (
        <div className="mover-a" role="group" aria-label={`${t('admin.tree.action.moveTo')}: ${nombre}`}>
          <p className="muted-text">{t('admin.tree.move.warn')}</p>
          <ul className="simple-list">
            {destinos.map((destino) => (
              <li key={destino.id ?? '__raiz__'}>
                <button
                  type="button"
                  className="boton-contorno"
                  disabled={enCurso}
                  data-testid={`mover-${nodeId}-a-${destino.id ?? 'raiz'}`}
                  onClick={() => void pedirMovimiento(destino)}
                >
                  {destino.etiqueta}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {confirmar ? (
        <div
          className="aviso notice-atencion"
          role="alert"
          data-testid={`confirmar-movimiento-${nodeId}`}
        >
          <p>
            {t('admin.tree.move.changesScope', {
              destino: confirmar.destino.etiqueta.replace(/^(?:— )+/, ''),
              n: confirmar.moduleIds.length,
              cuales: t.lista(confirmar.moduleIds),
            })}
          </p>
          <button
            type="button"
            className="pastilla"
            disabled={enCurso}
            data-testid={`confirmar-movimiento-si-${nodeId}`}
            onClick={() =>
              void enviar({ type: 'mover', nodeId, newParentId: confirmar.destino.id })
            }
          >
            {t('admin.tree.move.confirm')}
          </button>
          <button
            type="button"
            className="boton-contorno"
            disabled={enCurso}
            data-testid={`confirmar-movimiento-no-${nodeId}`}
            onClick={() => setConfirmar(null)}
          >
            {t('action.cancel')}
          </button>
        </div>
      ) : null}

      {/*
        Retirar PIDE UN MOTIVO, y el servidor lo exige igualmente.
        No es un tramite: es lo unico que les dice a los equipos que usaban el modulo por que un
        dia dejo de estar. Se pide en un campo y no en un `window.prompt` porque el dialogo del
        navegador no se puede leer con lector de pantalla ni conserva lo escrito si algo falla.
      */}
      {retirando && ciclo ? (
        <div
          className="mover-a"
          role="group"
          aria-label={`${t('admin.tree.action.withdraw')}: ${nombre}`}
        >
          <label className="form__field" htmlFor={`motivo-retirada-${nodeId}`}>
            {t('admin.tree.action.withdraw.reason')}
          </label>
          <input
            id={`motivo-retirada-${nodeId}`}
            type="text"
            value={motivo}
            disabled={enCurso}
            data-testid={`retirar-motivo-${nodeId}`}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <button
            type="button"
            className="pastilla"
            disabled={enCurso || !motivo.trim()}
            data-testid={`retirar-confirmar-${nodeId}`}
            onClick={() => void estado(ciclo.slug, { transition: 'retirar', motivo })}
          >
            {t('admin.tree.action.withdraw.confirm')}
          </button>
          <button
            type="button"
            className="boton-contorno"
            disabled={enCurso}
            data-testid={`retirar-cancelar-${nodeId}`}
            onClick={() => setRetirando(false)}
          >
            {t('action.cancel')}
          </button>
        </div>
      ) : null}

      {borrando && ciclo ? (
        <div className="aviso notice-atencion" role="alert" data-testid={`eliminar-aviso-${nodeId}`}>
          <p>{t('admin.tree.action.delete.confirm')}</p>
          <button
            type="button"
            className="pastilla"
            disabled={enCurso}
            data-testid={`eliminar-confirmar-${nodeId}`}
            onClick={() => void eliminar(ciclo.slug)}
          >
            {t('admin.tree.action.delete')}
          </button>
          <button
            type="button"
            className="boton-contorno"
            disabled={enCurso}
            data-testid={`eliminar-cancelar-${nodeId}`}
            onClick={() => setBorrando(false)}
          >
            {t('action.cancel')}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="aviso notice-error" role="alert" data-testid={`error-arbol-${nodeId}`}>
          {error}
        </p>
      ) : null}
    </>
  );
}

/** Un movimiento elegido y pendiente de confirmar, con lo que se lleva por delante. */
interface Confirmacion {
  destino: DestinoPosible;
  /** Los modulos cuyo ambito cambia. Son los que hay que mirar antes de decir que si. */
  moduleIds: string[];
}
