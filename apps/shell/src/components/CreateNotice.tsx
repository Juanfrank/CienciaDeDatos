'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type { AlertOperator, Cadence } from '@app/alerts';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { IconButton } from './icons/IconButton';

/** Crear una alerta o una suscripcion desde el modulo que se esta viendo. */

const OPERADORES: { valor: AlertOperator; etiqueta: string }[] = [
  { valor: 'mayor-que', etiqueta: 'supera' },
  { valor: 'menor-que', etiqueta: 'baja de' },
  { valor: 'cambia-mas-de', etiqueta: 'cambia mas de' },
];

const CADENCIAS: Cadence[] = ['diaria', 'semanal', 'mensual'];

export interface ObjetoVigilable {
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
  vigilables: ObjetoVigilable[];
}) {
  const router = useRouter();
  const { searchParams } = useUrlFilters();
  const dialogo = useRef<HTMLDialogElement>(null);

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

  const filtrosActuales = (): Record<string, string[]> => {
    const filtros: Record<string, string[]> = {};
    for (const clave of new Set(searchParams.keys())) filtros[clave] = searchParams.getAll(clave);
    return filtros;
  };

  const abrir = () => {
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
      filtros: filtrosActuales(),
    };

    const body =
      pestana === 'alerta'
        ? { ...common, objeto, medida, operador, umbral: Number(umbral) }
        : { ...common, formato, cadencia, hora: Number(hora) };

    const respuesta = await fetch(pestana === 'alerta' ? '/api/alertas' : '/api/suscripciones', {
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
    router.push('/avisos');
  };

  if (vigilables.length === 0) return null;

  return (
    <>
      <IconButton icono="notice" etiqueta="Avisarme" data-testid="create-notice" onClick={abrir} />

      <dialog ref={dialogo} className="emergente" aria-label="Crear un aviso" data-testid="dialogo-aviso">
        <div className="popover__header">
          <h2>Avisarme de este modulo</h2>
          <button type="button" className="boton-enlace" onClick={close} data-testid="close-notice">
            Cerrar
          </button>
        </div>

        <div className="segmentador" role="tablist" aria-label="Tipo de aviso">
          {(['alerta', 'suscripcion'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={pestana === t}
              className={`pastilla ${pestana === t ? 'pastilla--activa' : ''}`}
              data-testid={`tab-${t}`}
              onClick={() => setPestana(t)}
            >
              {t === 'alerta' ? 'Alerta cuando cambie el dato' : 'Envio programado'}
            </button>
          ))}
        </div>

        <p className="muted-text">
          {pestana === 'alerta'
            ? 'Se evalua cada vez que se repueblan los datos, con su ambito de acceso, y avisa solo cuando la condicion empieza o deja de cumplirse.'
            : 'Se genera en segundo plano y llega a su bandeja de avisos.'}
        </p>

        <p className="form__field">
          <label htmlFor="name-notice">Nombre</label>
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
              <label htmlFor="object-notice">Objeto vigilado</label>
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
              <label htmlFor="measure-notice">Medida</label>
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
              <label htmlFor="aviso-operador">Condicion</label>
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
              <label htmlFor="threshold-notice">Umbral</label>
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
              <label htmlFor="format-notice">Formato</label>
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
              <label htmlFor="aviso-cadencia">Cadencia</label>
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
              <label htmlFor="aviso-hora">Hora</label>
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
          Guardar
        </button>
      </dialog>
    </>
  );
}
