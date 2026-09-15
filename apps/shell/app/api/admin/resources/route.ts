import type { ObjectPresentation } from '@app/ui-components';
import { withAdmin } from '../guardia';
import {
  CatalogError,
  decideProposal,
  listProposals,
  proposeResource,
  setDefaultPresentation,
  setResourceDisabled,
} from '../../../../src/server/catalogo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Propuestas sobre el catalogo y objetos deshabilitados — seccion 4.5. */
export async function GET() {
  return withAdmin(async () => ({ propuestas: await listProposals() }));
}

interface Cuerpo {
  accion: 'proponer' | 'decidir' | 'deshabilitar' | 'predeterminar';
  objectId?: string;
  version?: string;
  summary?: string;
  id?: string;
  decision?: 'aprobar' | 'devolver';
  motivo?: string;
  disabled?: boolean;
  presentacion?: ObjectPresentation;
}

export async function POST(request: Request) {
  let body: Cuerpo;
  try {
    body = (await request.json()) as Cuerpo;
  } catch {
    return withAdmin(() => {
      throw new CatalogError('Cuerpo invalido.', 400);
    });
  }

  return withAdmin(async (actor) => {
    if (body.accion === 'proponer') {
      if (!body.objectId || !body.version || body.summary === undefined) {
        throw new CatalogError('Se requieren el objeto, la version y que cambia.', 400);
      }
      return {
        propuesta: await proposeResource(actor, {
          objectId: body.objectId,
          version: body.version,
          summary: body.summary,
        }),
      };
    }

    if (body.accion === 'decidir') {
      if (!body.id || (body.decision !== 'aprobar' && body.decision !== 'devolver')) {
        throw new CatalogError("Se requieren el identificador y 'aprobar' o 'devolver'.", 400);
      }
      return { propuesta: await decideProposal(actor, body.id, body.decision, body.motivo) };
    }

    if (body.accion === 'deshabilitar') {
      if (!body.objectId || typeof body.disabled !== 'boolean') {
        throw new CatalogError('Se requieren el objeto y si se deshabilita.', 400);
      }
      await setResourceDisabled(actor, body.objectId, body.disabled);
      return { objectId: body.objectId, disabled: body.disabled };
    }

    if (body.accion === 'predeterminar') {
      if (!body.objectId || typeof body.presentacion !== 'object' || body.presentacion === null) {
        throw new CatalogError('Se requieren el objeto y la presentacion.', 400);
      }
      return {
        presentacion: await setDefaultPresentation(actor, body.objectId, body.presentacion),
      };
    }

    throw new CatalogError(
      "Accion no admitida. Use 'proponer', 'decidir', 'deshabilitar' o 'predeterminar'.",
      400,
    );
  });
}
