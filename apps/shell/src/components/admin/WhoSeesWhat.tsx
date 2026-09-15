'use client';

import { useState } from 'react';
import { useTranslator } from '../Locale';

/** Vista de "quien ve que" — seccion 4.10.8. */
interface Paso {
  capa: string;
  source: string;
  amplio: boolean;
  resultado: { restrictions: { dimension: { table: string; field: string }; allowedValues: string[] }[] };
}

interface Result {
  tieneAcceso: boolean;
  treeTheExists: boolean;
  noVeNada: boolean;
  usoAmpliacion: boolean;
  scope: Paso['resultado'];
  pasos: Paso[];
}

const LABELS: Record<string, string> = {
  'ambito-general-del-equipo': 'Ambito general del equipo',
  carpeta: 'Carpeta',
  'override-por-modulo-del-equipo': 'Override por modulo del equipo',
  'ambito-personal': 'Ambito personal',
  'ambito-personal-por-modulo': 'Ambito personal por modulo',
};

const describe = (scope: Paso['resultado']): string =>
  scope.restrictions.length === 0
    ? 'sin restriccion'
    : scope.restrictions
        .map((r) => `${r.dimension.table}.${r.dimension.field} = ${r.allowedValues.join(', ') || '(nada)'}`)
        .join(' · ');

export function SeesWhoWhere({
  usuarios,
  equipos,
  modules,
}: {
  usuarios: string[];
  equipos: { id: string; name: string }[];
  modules: { moduleId: string; name: string }[];
}) {
  const t = useTranslator();
  const [userId, setUserId] = useState(usuarios[0] ?? '');
  const [teamId, setTeamId] = useState(equipos[0]?.id ?? '');
  const [moduleId, setModuleId] = useState(modules[0]?.moduleId ?? '');
  const [resultado, setResultado] = useState<Result | null>(null);

  const consultar = async () => {
    const r = await fetch(
      `/api/admin/who-sees-what?userId=${encodeURIComponent(userId)}&teamId=${encodeURIComponent(teamId)}&moduleId=${encodeURIComponent(moduleId)}`,
    );
    setResultado(r.ok ? ((await r.json()) as Result) : null);
  };

  return (
    <div>
      <div className="sees-who-where__filters">
        <label className="campo">
          <span>{t('whoSees.person')}</span>
          <select value={userId} data-testid="qvq-usuario" onChange={(e) => setUserId(e.target.value)}>
            {usuarios.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>{t('whoSees.activeTeam')}</span>
          <select value={teamId} data-testid="qvq-equipo" onChange={(e) => setTeamId(e.target.value)}>
            {equipos.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>{t('whoSees.module')}</span>
          <select value={moduleId} data-testid="qvq-modulo" onChange={(e) => setModuleId(e.target.value)}>
            {modules.map((m) => (
              <option key={m.moduleId} value={m.moduleId}>{m.name}</option>
            ))}
          </select>
        </label>
        <button type="button" data-testid="qvq-consultar" onClick={() => void consultar()}>
          {t('whoSees.resolve')}
        </button>
      </div>

      {resultado ? (
        <div data-testid="qvq-resultado">
          {!resultado.tieneAcceso ? (
            <p className="aviso notice-error" data-testid="qvq-sin-acceso">
              {resultado.treeTheExists
                ? 'Este equipo NO tiene concedido este modulo. El ambito es irrelevante: no lo ve.'
                : 'Este modulo no existe en la organizacion general.'}
            </p>
          ) : null}

          {resultado.tieneAcceso ? (
            <>
              <p>
                <strong>{t('whoSees.effectiveScope')}</strong>{' '}
                <span data-testid="qvq-ambito">{describe(resultado.scope)}</span>
              </p>
              {resultado.noVeNada ? (
                <p className="aviso notice-atencion">{t('whoSees.noRows')}</p>
              ) : null}
              {resultado.usoAmpliacion ? (
                <p className="aviso notice-error" data-testid="qvq-ampliacion">
                  {t('whoSees.expansion')}
                </p>
              ) : null}

              <h3>{t('whoSees.how')}</h3>
              <ol className="sees-who-where__pasos" data-testid="qvq-pasos">
                {resultado.pasos.map((p, i) => (
                  <li key={i} className={p.amplio ? 'es-ampliacion' : ''}>
                    <strong>{LABELS[p.capa] ?? p.capa}</strong>
                    {/* El origen es lo que el documento pide destacar: que carpeta lo causo. */}
                    <span className="sees-who-where__source"> — {p.source}</span>
                    <div className="muted-text">{describe(p.resultado)}</div>
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
