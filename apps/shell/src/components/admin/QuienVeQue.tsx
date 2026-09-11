'use client';

import { useState } from 'react';

/**
 * Vista de "quien ve que" — seccion 4.10.8.
 *
 * "Dado un usuario y un modulo, mostrar el ambito efectivo resuelto de forma legible, INCLUYENDO
 * QUE CARPETA DE LA ORGANIZACION GENERAL LO ORIGINO, para poder auditar y depurar configuraciones
 * ANTES de publicarlas."
 *
 * Sale casi gratis: `resolveEffectiveScope` ya devuelve la traza con la capa, su origen y el
 * ambito acumulado tras cada paso. Se construyo en B.4 exactamente para esto.
 */
interface Paso {
  capa: string;
  origen: string;
  amplio: boolean;
  resultado: { restrictions: { dimension: { table: string; field: string }; allowedValues: string[] }[] };
}

interface Resultado {
  tieneAcceso: boolean;
  existeEnElArbol: boolean;
  noVeNada: boolean;
  usoAmpliacion: boolean;
  scope: Paso['resultado'];
  pasos: Paso[];
}

const ETIQUETAS: Record<string, string> = {
  'ambito-general-del-equipo': 'Ambito general del equipo',
  carpeta: 'Carpeta',
  'override-por-modulo-del-equipo': 'Override por modulo del equipo',
  'ambito-personal': 'Ambito personal',
  'ambito-personal-por-modulo': 'Ambito personal por modulo',
};

const describir = (scope: Paso['resultado']): string =>
  scope.restrictions.length === 0
    ? 'sin restriccion'
    : scope.restrictions
        .map((r) => `${r.dimension.table}.${r.dimension.field} = ${r.allowedValues.join(', ') || '(nada)'}`)
        .join(' · ');

export function QuienVeQue({
  usuarios,
  equipos,
  modulos,
}: {
  usuarios: string[];
  equipos: { id: string; name: string }[];
  modulos: { moduleId: string; name: string }[];
}) {
  const [userId, setUserId] = useState(usuarios[0] ?? '');
  const [teamId, setTeamId] = useState(equipos[0]?.id ?? '');
  const [moduleId, setModuleId] = useState(modulos[0]?.moduleId ?? '');
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const consultar = async () => {
    const r = await fetch(
      `/api/admin/quien-ve-que?userId=${encodeURIComponent(userId)}&teamId=${encodeURIComponent(teamId)}&moduleId=${encodeURIComponent(moduleId)}`,
    );
    setResultado(r.ok ? ((await r.json()) as Resultado) : null);
  };

  return (
    <div className="quien-ve-que">
      <div className="quien-ve-que__filtros">
        <label className="campo">
          <span>Persona</span>
          <select value={userId} data-testid="qvq-usuario" onChange={(e) => setUserId(e.target.value)}>
            {usuarios.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Equipo activo</span>
          <select value={teamId} data-testid="qvq-equipo" onChange={(e) => setTeamId(e.target.value)}>
            {equipos.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Modulo</span>
          <select value={moduleId} data-testid="qvq-modulo" onChange={(e) => setModuleId(e.target.value)}>
            {modulos.map((m) => (
              <option key={m.moduleId} value={m.moduleId}>{m.name}</option>
            ))}
          </select>
        </label>
        <button type="button" data-testid="qvq-consultar" onClick={() => void consultar()}>
          Resolver
        </button>
      </div>

      {resultado ? (
        <div className="quien-ve-que__resultado" data-testid="qvq-resultado">
          {!resultado.tieneAcceso ? (
            <p className="aviso aviso--error" data-testid="qvq-sin-acceso">
              {resultado.existeEnElArbol
                ? 'Este equipo NO tiene concedido este modulo. El ambito es irrelevante: no lo ve.'
                : 'Este modulo no existe en la organizacion general.'}
            </p>
          ) : null}

          {resultado.tieneAcceso ? (
            <>
              <p>
                <strong>Ambito efectivo:</strong>{' '}
                <span data-testid="qvq-ambito">{describir(resultado.scope)}</span>
              </p>
              {resultado.noVeNada ? (
                <p className="aviso aviso--atencion">
                  El ambito resuelto no permite ver ninguna fila.
                </p>
              ) : null}
              {resultado.usoAmpliacion ? (
                <p className="aviso aviso--error" data-testid="qvq-ampliacion">
                  Este ambito proviene de una AMPLIACION autorizada.
                </p>
              ) : null}

              <h3>Como se llego a ese ambito</h3>
              <ol className="quien-ve-que__pasos" data-testid="qvq-pasos">
                {resultado.pasos.map((p, i) => (
                  <li key={i} className={p.amplio ? 'es-ampliacion' : ''}>
                    <strong>{ETIQUETAS[p.capa] ?? p.capa}</strong>
                    {/* El origen es lo que el documento pide destacar: que carpeta lo causo. */}
                    <span className="quien-ve-que__origen"> — {p.origen}</span>
                    <div className="texto-atenuado">{describir(p.resultado)}</div>
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
