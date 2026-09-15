'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type { AlertOperator, Cadence } from '@app/alerts';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { IconButton } from './icons/IconButton';
import { useTranslator } from './Locale';

/** Crear una alerta o una suscripcion desde el modulo que se esta viendo. */

const OPERADORES: { valor: AlertOperator; etiqueta: string }[] = [
  { valor: 'mayor-que', etiqueta: 'supera' },
  { valor: 'menor-que', etiqueta: 'baja de' },
  { valor: 'cambia-mas-de', etiqueta: 'cambia mas de' },
];

const CADENCIAS: Cadence[] = ['diaria', 'semanal', 'mensual'];

export interface WatchableObject {
  instanceId: string;
  titulo: string;
  measures: string[];
}

export function CreateNotice({
  moduleSlug,
  pageSlug,
  vigilables,
}: {
  moduleSlug: string;
  pageSlug?: string;
  /** Objetos del modulo que mapean alguna medida. Un segmentador no se puede vigilar. */
  vigilables: WatchableObject[];
}) {
  const router = useRouter();
  const { searchParams } = useUrlFilters();
  const dialogo = useRef<HTMLDialogElement>(null);

  const t = useTranslator();
  const [pestana, setPestana] = useState<'alerta' | 'suscripcion'>('alerta');
  const [nombre, setNombre] = useState('');
  const [objeto, setObjeto] = useState(vigilables[0]?.instanceId ?? '');
  const [medida, setMedida] = useState(vigilables[0]?.measures[0] ?? '');
  const [operador, setOperador] = useState<AlertOperator>('mayor-que');
  const [umbral, setUmbral] = useState('0');
  const [formato, setFormato] = useState('pdf');
  const [cadencia, setCadencia] = useState<Cadence>('semanal');
  const [hora, setHora] = useState('8');
  const [error, setError] = useState('');

  const measuresOf = (instanceId: string) =>
    vigilables.find((v) => v.instanceId === instanceId)?.measures ?? [];

  const currentFilters = (): Record<string, string[]> => {
    const filtros: Record<string, string[]> = {};
    for (const clave of new Set(searchParams.keys())) filtros[clave] = searchParams.getAll(clave);
    return filtros;
  };

  const open = () => {
    setError('');
    dialogo.current?.showModal();
  };

  const close = () => dialogo.current?.close();

  const guardar = async () => {
    setError('');
    const common = {
      nombre,
      modulo: moduleSlug,
      pagina: pageSlug,
      filtros: currentFilters(),
    };

    const body =
      pestana === 'alerta'
        ? { ...common, objeto, medida, operador, umbral: Number(umbral) }
        : { ...common, formato, cadencia, hora: Number(hora) };

    const respuesta = await fetch(pestana === 'alerta' ? '/api/alerts' : '/api/subscriptions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!respuesta.ok) {
      const { error: motivo } = (await respuesta.json()) as { error?: string };
      setError(motivo ?? 'No se pudo guardar.');
      return;
    }

    setNombre('');
    close();
    router.push('/notices');
  };

  if (vigilables.length === 0) return null;

  return (
    <>
      <IconButton
        icono="notice"
        etiqueta={t('notice.warnMe')}
        data-testid="create-notice"
        onClick={open}
      />

      <dialog ref={dialogo} className="emergente" aria-label={t('notice.create')} data-testid="dialogo-aviso">
        <div className="popover__header">
          <h2>{t('notice.watchThis')}</h2>
          <button type="button" className="button-link" onClick={close} data-testid="close-notice">
            {t('action.close')}
          </button>
        </div>

        <div className="segmentador" role="tablist" aria-label={t('notice.kind')}>
          {(['alerta', 'suscripcion'] as const).map((tipo) => (
            <button
              key={tipo}
              type="button"
              role="tab"
              aria-selected={pestana === tipo}
              className={`pastilla ${pestana === tipo ? 'pastilla--activa' : ''}`}
              data-testid={`tab-${tipo}`}
              onClick={() => setPestana(tipo)}
            >
              {tipo === 'alerta' ? t('notice.kind.alert') : t('notice.kind.subscription')}
            </button>
          ))}
        </div>

        <p className="muted-text">
          {pestana === 'alerta'
            ? t('notice.kind.alert.desc')
            : t('notice.kind.subscription.desc')}
        </p>

        <p className="form__field">
          <label htmlFor="name-notice">{t('notice.name')}</label>
          <input
            id="name-notice"
            value={nombre}
            data-testid="name-notice"
            onChange={(e) => setNombre(e.target.value)}
          />
        </p>

        {pestana === 'alerta' ? (
          <>
            <p className="form__field">
              <label htmlFor="object-notice">{t('notice.object')}</label>
              <select
                id="object-notice"
                value={objeto}
                data-testid="object-notice"
                onChange={(e) => {
                  setObjeto(e.target.value);
                  setMedida(measuresOf(e.target.value)[0] ?? '');
                }}
              >
                {vigilables.map((v) => (
                  <option key={v.instanceId} value={v.instanceId}>
                    {v.titulo}
                  </option>
                ))}
              </select>
            </p>

            <p className="form__field">
              <label htmlFor="measure-notice">{t('notice.measure')}</label>
              <select
                id="measure-notice"
                value={medida}
                data-testid="measure-notice"
                onChange={(e) => setMedida(e.target.value)}
              >
                {measuresOf(objeto).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </p>

            <p className="form__field">
              <label htmlFor="aviso-operador">{t('notice.condition')}</label>
              <select
                id="aviso-operador"
                value={operador}
                data-testid="notice-operador"
                onChange={(e) => setOperador(e.target.value as AlertOperator)}
              >
                {OPERADORES.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>
            </p>

            <p className="form__field">
              <label htmlFor="threshold-notice">{t('notice.threshold')}</label>
              <input
                id="threshold-notice"
                type="number"
                value={umbral}
                data-testid="threshold-notice"
                onChange={(e) => setUmbral(e.target.value)}
              />
            </p>
          </>
        ) : (
          <>
            <p className="form__field">
              <label htmlFor="format-notice">{t('notice.format')}</label>
              <select
                id="format-notice"
                value={formato}
                data-testid="format-notice"
                onChange={(e) => setFormato(e.target.value)}
              >
                {['pdf', 'xlsx', 'csv', 'svg'].map((f) => (
                  <option key={f} value={f}>
                    {f.toUpperCase()}
                  </option>
                ))}
              </select>
            </p>

            <p className="form__field">
              <label htmlFor="aviso-cadencia">{t('notice.cadence')}</label>
              <select
                id="aviso-cadencia"
                value={cadencia}
                data-testid="notice-cadencia"
                onChange={(e) => setCadencia(e.target.value as Cadence)}
              >
                {CADENCIAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </p>

            <p className="form__field">
              <label htmlFor="aviso-hora">{t('notice.hour')}</label>
              <input
                id="aviso-hora"
                type="number"
                min={0}
                max={23}
                value={hora}
                data-testid="notice-hora"
                onChange={(e) => setHora(e.target.value)}
              />
            </p>
          </>
        )}

        {error ? (
          <p className="active-scope" role="alert" data-testid="notice-error">
            {error}
          </p>
        ) : null}

        <button type="button" className="pastilla" data-testid="save-notice" onClick={() => void guardar()}>
          {t('action.save')}
        </button>
      </dialog>
    </>
  );
}
