'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type { AlertOperator, Cadence } from '@app/alerts';
import { useFiltrosDeUrl } from '../hooks/useFiltrosDeUrl';
import { BotonDeIcono } from './iconos/BotonDeIcono';

/**
 * Crear una alerta o una suscripcion desde el modulo que se esta viendo.
 *
 * Se crean AQUI y no en una pantalla de configuracion aparte porque las dos capturan la vista
 * actual: los filtros que viajan son los de la URL, que segun 4.11 son la representacion
 * completa del estado visible. Es el mismo gesto que guardar un marcador.
 *
 * Lo que NO viaja es el equipo ni el ambito: los pone el servidor desde la sesion, porque son
 * los que deciden con que datos se evalua la regla y que lleva el archivo entregado.
 */

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

export function CrearAviso({
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
  const { searchParams } = useFiltrosDeUrl();
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

  const medidasDe = (instanceId: string) =>
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

  const cerrar = () => dialogo.current?.close();

  const guardar = async () => {
    setError('');
    const comun = {
      nombre,
      modulo: moduleSlug,
      pagina: pageSlug,
      filtros: filtrosActuales(),
    };

    const cuerpo =
      pestana === 'alerta'
        ? { ...comun, objeto, medida, operador, umbral: Number(umbral) }
        : { ...comun, formato, cadencia, hora: Number(hora) };

    const respuesta = await fetch(pestana === 'alerta' ? '/api/alertas' : '/api/suscripciones', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });

    if (!respuesta.ok) {
      const { error: motivo } = (await respuesta.json()) as { error?: string };
      setError(motivo ?? 'No se pudo guardar.');
      return;
    }

    setNombre('');
    cerrar();
    router.push('/avisos');
  };

  if (vigilables.length === 0) return null;

  return (
    <>
      <BotonDeIcono icono="aviso" etiqueta="Avisarme" data-testid="crear-aviso" onClick={abrir} />

      <dialog ref={dialogo} className="emergente" aria-label="Crear un aviso" data-testid="dialogo-aviso">
        <div className="emergente__cabecera">
          <h2>Avisarme de este modulo</h2>
          <button type="button" className="boton-enlace" onClick={cerrar} data-testid="aviso-cerrar">
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
              data-testid={`pestana-${t}`}
              onClick={() => setPestana(t)}
            >
              {t === 'alerta' ? 'Alerta cuando cambie el dato' : 'Envio programado'}
            </button>
          ))}
        </div>

        <p className="texto-atenuado">
          {pestana === 'alerta'
            ? 'Se evalua cada vez que se repueblan los datos, con su ambito de acceso, y avisa solo cuando la condicion empieza o deja de cumplirse.'
            : 'Se genera en segundo plano y llega a su bandeja de avisos.'}
        </p>

        <p className="formulario__campo">
          <label htmlFor="aviso-nombre">Nombre</label>
          <input
            id="aviso-nombre"
            value={nombre}
            data-testid="aviso-nombre"
            onChange={(e) => setNombre(e.target.value)}
          />
        </p>

        {pestana === 'alerta' ? (
          <>
            <p className="formulario__campo">
              <label htmlFor="aviso-objeto">Objeto vigilado</label>
              <select
                id="aviso-objeto"
                value={objeto}
                data-testid="aviso-objeto"
                onChange={(e) => {
                  setObjeto(e.target.value);
                  setMedida(medidasDe(e.target.value)[0] ?? '');
                }}
              >
                {vigilables.map((v) => (
                  <option key={v.instanceId} value={v.instanceId}>
                    {v.titulo}
                  </option>
                ))}
              </select>
            </p>

            <p className="formulario__campo">
              <label htmlFor="aviso-medida">Medida</label>
              <select
                id="aviso-medida"
                value={medida}
                data-testid="aviso-medida"
                onChange={(e) => setMedida(e.target.value)}
              >
                {medidasDe(objeto).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </p>

            <p className="formulario__campo">
              <label htmlFor="aviso-operador">Condicion</label>
              <select
                id="aviso-operador"
                value={operador}
                data-testid="aviso-operador"
                onChange={(e) => setOperador(e.target.value as AlertOperator)}
              >
                {OPERADORES.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>
            </p>

            <p className="formulario__campo">
              <label htmlFor="aviso-umbral">Umbral</label>
              <input
                id="aviso-umbral"
                type="number"
                value={umbral}
                data-testid="aviso-umbral"
                onChange={(e) => setUmbral(e.target.value)}
              />
            </p>
          </>
        ) : (
          <>
            <p className="formulario__campo">
              <label htmlFor="aviso-formato">Formato</label>
              <select
                id="aviso-formato"
                value={formato}
                data-testid="aviso-formato"
                onChange={(e) => setFormato(e.target.value)}
              >
                {['pdf', 'xlsx', 'csv', 'svg'].map((f) => (
                  <option key={f} value={f}>
                    {f.toUpperCase()}
                  </option>
                ))}
              </select>
            </p>

            <p className="formulario__campo">
              <label htmlFor="aviso-cadencia">Cadencia</label>
              <select
                id="aviso-cadencia"
                value={cadencia}
                data-testid="aviso-cadencia"
                onChange={(e) => setCadencia(e.target.value as Cadence)}
              >
                {CADENCIAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </p>

            <p className="formulario__campo">
              <label htmlFor="aviso-hora">Hora</label>
              <input
                id="aviso-hora"
                type="number"
                min={0}
                max={23}
                value={hora}
                data-testid="aviso-hora"
                onChange={(e) => setHora(e.target.value)}
              />
            </p>
          </>
        )}

        {error ? (
          <p className="ambito-activo" role="alert" data-testid="aviso-error">
            {error}
          </p>
        ) : null}

        <button type="button" className="pastilla" data-testid="aviso-guardar" onClick={() => void guardar()}>
          Guardar
        </button>
      </dialog>
    </>
  );
}
