'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ModulePackage } from '@app/access-control';
import { useTranslator } from '../Locale';
import { Icon } from '../icons/Icon';
import { pedir, motivoDeFallo } from '../pedir';

/**
 * Los paquetes visuales, en tabla y EDITABLES — secciones 4.1.3 y 4.10.6.
 *
 * La pantalla era de solo lectura: listaba lo que hubiera sembrado el seed y no habia forma de
 * crear uno. La API ya existia entera —`savePackage` con su validacion y su auditoria, y el
 * borrado que ademas despega el paquete de los equipos que lo tuvieran— y no la llamaba ninguna
 * pantalla. Esto es lo que faltaba: los botones.
 *
 * Un paquete es una VISTA, no un permiso. Reagrupa, renombra y reordena lo que una audiencia ya
 * puede ver; la resolucion de ambito no consulta paquetes. Por eso aqui se elige que modulos
 * entran y no a quien se le concede nada: lo segundo se hace en el equipo.
 */
export interface PackageRow {
  pkg: ModulePackage;
  /** Equipos a los que esta asignado, por nombre. */
  equipos: string[];
  /** Nodos que el paquete referencia y la audiencia no puede ver. */
  problemas: { equipo: string; moduleId: string; reason: string }[];
  /** Cuantos modulos referencia, contando subcarpetas. */
  modulos: number;
}

/** Un modulo que se puede meter en un paquete. */
export interface PackageCandidate {
  moduleId: string;
  slug: string;
  name: string;
}

export function PackageTable({
  filas,
  candidatos,
}: {
  filas: PackageRow[];
  candidatos: PackageCandidate[];
}) {
  const t = useTranslator();
  const router = useRouter();
  const [editando, setEditando] = useState<ModulePackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, setEnCurso] = useState(false);

  const enviar = async (cuerpo: { paquete?: ModulePackage; borrar?: string }) => {
    setEnCurso(true);
    setError(null);
    const respuesta = await pedir('/api/admin/packages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    setEnCurso(false);
    if (!respuesta?.ok) {
      setError(await motivoDeFallo(respuesta, t('admin.packages.failed')));
      return false;
    }
    setEditando(null);
    router.refresh();
    return true;
  };

  return (
    <>
      <p>
        <button
          type="button"
          className="pastilla"
          data-testid="add-package"
          onClick={() =>
            setEditando({
              // El identificador se genera y no se pide: nadie deberia tener que inventar uno, y
              // dejarlo a mano es como acaban dos paquetes compartiendo el mismo.
              id: `pkg-${crypto.randomUUID().slice(0, 8)}`,
              name: '',
              visualTree: [],
            })
          }
        >
          {t('admin.packages.add')}
        </button>
      </p>

      {error ? (
        <p className="aviso notice-error" role="alert" data-testid="package-error">
          {error}
        </p>
      ) : null}

      {editando ? (
        <PackageForm
          paquete={editando}
          candidatos={candidatos}
          enCurso={enCurso}
          onGuardar={(paquete) => void enviar({ paquete })}
          onCancelar={() => setEditando(null)}
        />
      ) : null}

      {filas.length === 0 ? (
        <p className="muted-text" data-testid="without-packages">
          {t('admin.packages.empty')}
        </p>
      ) : (
        <div className="container-table">
          <table className="tabla" data-testid="tabla-paquetes">
            <thead>
              <tr>
                <th scope="col">{t('admin.packages.column.package')}</th>
                <th scope="col">{t('admin.packages.column.modules')}</th>
                <th scope="col">{t('admin.packages.column.teams')}</th>
                <th scope="col">{t('admin.resources.column.state')}</th>
                <th scope="col">{t('admin.resources.column.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.pkg.id} data-testid={`package-${fila.pkg.id}`}>
                  <th scope="row">{fila.pkg.name}</th>
                  <td>{t('admin.packages.moduleCount', { n: fila.modulos })}</td>
                  <td>
                    {fila.equipos.length === 0 ? (
                      <span className="muted-text">{t('admin.packages.noTeams')}</span>
                    ) : (
                      t.lista(fila.equipos)
                    )}
                  </td>
                  <td data-testid={`package-estado-${fila.pkg.id}`}>
                    {fila.problemas.length === 0 ? (
                      <span className="muted-text">{t('admin.packages.ok')}</span>
                    ) : (
                      <span className="insignia badge--error">
                        {t('admin.packages.dangling', { n: fila.problemas.length })}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="fila-acciones">
                      <button
                        type="button"
                        className="button-link"
                        title={t('admin.packages.edit')}
                        aria-label={`${t('admin.packages.edit')}: ${fila.pkg.name}`}
                        data-testid={`editar-package-${fila.pkg.id}`}
                        onClick={() => setEditando(structuredClone(fila.pkg))}
                      >
                        <Icon nombre="editar" tamano={18} />
                      </button>
                      <button
                        type="button"
                        className="button-link"
                        disabled={enCurso}
                        title={t('admin.packages.delete')}
                        aria-label={`${t('admin.packages.delete')}: ${fila.pkg.name}`}
                        data-testid={`borrar-package-${fila.pkg.id}`}
                        onClick={() => void enviar({ borrar: fila.pkg.id })}
                      >
                        <Icon nombre="close" tamano={18} />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/*
        Los nodos que no se muestran, con el motivo y para que equipo.

        Es la validacion automatica que pide 4.10.6, y tiene que estar donde se edita: un paquete
        que referencia algo no concedido no falla, simplemente no lo ensena, y sin este aviso nadie
        se entera hasta que alguien pregunta por que no ve un modulo.

        Un bloque POR PAQUETE y no uno comun. Con quince paquetes, una lista unica obliga a leer
        los quince nombres para saber cual es el que esta mal.
      */}
      {filas
        .filter((f) => f.problemas.length > 0)
        .map((f) => (
          <div
            key={f.pkg.id}
            className="aviso notice-atencion"
            data-testid={`package-problemas-${f.pkg.id}`}
          >
            <p>
              <strong>{f.pkg.name}</strong> · {t('admin.packages.dangling.intro')}
            </p>
            <ul>
              {f.problemas.map((p, i) => (
                <li key={`${f.pkg.id}-${i}`}>
                  <code>{p.moduleId}</code> · {t('admin.packages.dangling.for', { equipo: p.equipo })}{' '}
                  · {p.reason}
                </li>
              ))}
            </ul>
          </div>
        ))}
    </>
  );
}

/**
 * Alta y edicion de un paquete.
 *
 * El arbol visual se edita como una LISTA de modulos, no como un arbol. Reagrupar en carpetas
 * propias es lo siguiente y necesita su propio gesto; elegir que entra y en que orden es lo que
 * hace falta para que el paquete sirva de algo hoy, y es lo que no se podia hacer de ninguna
 * manera. Lo que ya tuviera un paquete en carpetas no se toca al guardar desde aqui.
 */
function PackageForm({
  paquete,
  candidatos,
  enCurso,
  onGuardar,
  onCancelar,
}: {
  paquete: ModulePackage;
  candidatos: PackageCandidate[];
  enCurso: boolean;
  onGuardar: (paquete: ModulePackage) => void;
  onCancelar: () => void;
}) {
  const t = useTranslator();
  const [nombre, setNombre] = useState(paquete.name);
  const [elegidos, setElegidos] = useState<string[]>(
    paquete.visualTree.flatMap((n) => (n.type === 'module' ? [n.moduleRef.moduleId] : [])),
  );

  const alternar = (moduleId: string) =>
    setElegidos((previos) =>
      previos.includes(moduleId)
        ? previos.filter((id) => id !== moduleId)
        : [...previos, moduleId],
    );

  const guardar = () => {
    // Las carpetas propias del paquete se conservan tal cual; solo se reescriben las hojas.
    const carpetas = paquete.visualTree.filter((n) => n.type !== 'module');
    onGuardar({
      ...paquete,
      name: nombre.trim(),
      visualTree: [
        ...carpetas,
        ...elegidos.flatMap((moduleId) => {
          const candidato = candidatos.find((c) => c.moduleId === moduleId);
          if (!candidato) return [];
          return [
            {
              id: `${paquete.id}-${moduleId}`,
              type: 'module' as const,
              moduleRef: {
                moduleId,
                slug: candidato.slug,
                name: candidato.name,
              },
            },
          ];
        }),
      ],
    });
  };

  return (
    <form
      className="formulario-paquete"
      data-testid="package-form"
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
    >
      <label className="form__field">
        <span>{t('admin.packages.field.name')}</span>
        <input
          type="text"
          required
          value={nombre}
          data-testid="package-name"
          onChange={(e) => setNombre(e.target.value)}
        />
      </label>

      <fieldset>
        <legend>{t('admin.packages.field.modules')}</legend>
        {candidatos.length === 0 ? (
          <p className="muted-text">{t('admin.packages.noCandidates')}</p>
        ) : (
          <ul className="simple-list">
            {candidatos.map((c) => (
              <li key={c.moduleId}>
                <label>
                  <input
                    type="checkbox"
                    checked={elegidos.includes(c.moduleId)}
                    data-testid={`package-modulo-${c.slug}`}
                    onChange={() => alternar(c.moduleId)}
                  />{' '}
                  {c.name} <span className="muted-text">/m/{c.slug}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <p>
        <button type="submit" className="pastilla" disabled={enCurso || nombre.trim() === ''} data-testid="guardar-package">
          {t('action.save')}
        </button>{' '}
        <button type="button" className="boton-contorno" data-testid="cancelar-package" onClick={onCancelar}>
          {t('action.cancel')}
        </button>
      </p>
    </form>
  );
}
