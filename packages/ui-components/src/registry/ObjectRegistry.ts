import { classifyBump, compareVersions, isValidVersion, maxVersion } from './semver';
import type {
  DeprecationNotice,
  ObjectInstance,
  ObjectVersion,
  VisualObjectDefinition,
} from './types';

/** Registro de objetos versionados — seccion 4.5. */

export class ObjectRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ObjectRegistryError';
  }
}

export interface PublishInput {
  objectId: string;
  version: ObjectVersion;
}

export interface DeprecationWarning {
  instanceId: string;
  objectId: string;
  version: string;
  removeAfter: string;
  replacedBy?: string;
  reason: string;
  /** Dias que faltan para la fecha limite. Negativo si ya paso. */
  daysRemaining: number;
  /** true si la fecha limite ya paso: la instancia esta usando algo sin soporte. */
  expired: boolean;
}

export class ObjectRegistry {
  private readonly objects = new Map<string, VisualObjectDefinition>();

  constructor(definiciones: VisualObjectDefinition[] = []) {
    for (const def of definiciones) this.register(def);
  }

  /** Da de alta un objeto completo. Valida todas sus versiones. */
  register(definicion: VisualObjectDefinition): void {
    if (definicion.versions.length === 0) {
      throw new ObjectRegistryError(
        `El objeto '${definicion.objectId}' no declara ninguna version.`,
      );
    }
    for (const v of definicion.versions) this.assertVersionIsPublishable(definicion.objectId, v);
    this.objects.set(definicion.objectId, {
      ...definicion,
      versions: [...definicion.versions].sort((a, b) => compareVersions(a.version, b.version)),
    });
  }

  list(): VisualObjectDefinition[] {
    return [...this.objects.values()];
  }

  get(objectId: string): VisualObjectDefinition | undefined {
    return this.objects.get(objectId);
  }

  /**
   * Resuelve la version EXACTA que una instancia fijo.
   *
   * No admite rangos ni "la ultima": un rango reintroduciria justo lo que 4.5 prohibe.
   */
  resolve(objectId: string, version: string): ObjectVersion {
    const objeto = this.objects.get(objectId);
    if (!objeto) throw new ObjectRegistryError(`Objeto desconocido: '${objectId}'.`);

    const encontrada = objeto.versions.find((v) => v.version === version);
    if (!encontrada) {
      throw new ObjectRegistryError(
        `El objeto '${objectId}' no tiene la version '${version}'. ` +
          `Disponibles: ${objeto.versions.map((v) => v.version).join(', ')}.`,
      );
    }
    return encontrada;
  }

  latest(objectId: string): ObjectVersion | undefined {
    const objeto = this.objects.get(objectId);
    if (!objeto) return undefined;
    const ultima = maxVersion(objeto.versions.map((v) => v.version));
    return objeto.versions.find((v) => v.version === ultima);
  }

  /** Publica una version nueva. */
  publish(input: PublishInput): VisualObjectDefinition {
    const { objectId, version } = input;
    const objeto = this.objects.get(objectId);
    if (!objeto) throw new ObjectRegistryError(`Objeto desconocido: '${objectId}'.`);

    this.assertVersionIsPublishable(objectId, version);

    if (objeto.versions.some((v) => v.version === version.version)) {
      throw new ObjectRegistryError(
        `La version '${version.version}' de '${objectId}' ya existe. Nunca se modifica un objeto ` +
          `publicado: se publica una version nueva (principio 8).`,
      );
    }

    const anterior = maxVersion(objeto.versions.map((v) => v.version));
    if (anterior) {
      const salto = classifyBump(anterior, version.version);
      if (salto === 'invalido' || salto === 'ninguno') {
        throw new ObjectRegistryError(
          `La version '${version.version}' no avanza respecto de '${anterior}' en '${objectId}'.`,
        );
      }
    }

    const actualizado: VisualObjectDefinition = {
      ...objeto,
      versions: [...objeto.versions, version].sort((a, b) => compareVersions(a.version, b.version)),
    };
    this.objects.set(objectId, actualizado);
    return actualizado;
  }

  /** Marca una version como deprecada, con fecha limite y sustituto. */
  deprecate(objectId: string, version: string, notice: DeprecationNotice): void {
    const objeto = this.objects.get(objectId);
    if (!objeto) throw new ObjectRegistryError(`Objeto desconocido: '${objectId}'.`);

    if (notice.replacedBy && !objeto.versions.some((v) => v.version === notice.replacedBy)) {
      throw new ObjectRegistryError(
        `La version sustituta '${notice.replacedBy}' no existe en '${objectId}'. Un aviso de ` +
          `deprecacion que apunta a algo inexistente no es accionable.`,
      );
    }

    this.objects.set(objectId, {
      ...objeto,
      versions: objeto.versions.map((v) => (v.version === version ? { ...v, deprecation: notice } : v)),
    });
  }

  /** Aviso ACTIVO a los modulos que usan una version proxima a deprecarse (4.5). */
  findDeprecationWarnings(
    instances: ObjectInstance[],
    now: Date = new Date(),
  ): DeprecationWarning[] {
    const notices: DeprecationWarning[] = [];

    for (const objectInstance of instances) {
      const objeto = this.objects.get(objectInstance.objectId);
      const version = objeto?.versions.find((v) => v.version === objectInstance.version);
      const deprecacion = version?.deprecation;
      if (!objeto || !version || !deprecacion) continue;

      const limite = new Date(deprecacion.removeAfter).getTime();
      const dias = Math.ceil((limite - now.getTime()) / 86_400_000);

      notices.push({
        instanceId: objectInstance.instanceId,
        objectId: objectInstance.objectId,
        version: objectInstance.version,
        removeAfter: deprecacion.removeAfter,
        ...(deprecacion.replacedBy ? { replacedBy: deprecacion.replacedBy } : {}),
        reason: deprecacion.reason,
        daysRemaining: dias,
        expired: dias < 0,
      });
    }

    return notices.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }

  private assertVersionIsPublishable(objectId: string, version: ObjectVersion): void {
    if (!isValidVersion(version.version)) {
      throw new ObjectRegistryError(
        `Version no valida en '${objectId}': '${version.version}'. Debe ser MAYOR.MENOR.PARCHE.`,
      );
    }

    if (!version.changelog?.trim()) {
      throw new ObjectRegistryError(
        `La version '${version.version}' de '${objectId}' no trae changelog. Es obligatorio por ` +
          `version (4.5): sin el, quien mantiene un modulo no puede saber si le afecta.`,
      );
    }

    // Certificacion minima: pruebas automatizadas MAS revision por pares (4.5).
    const cert = version.certification;
    if (!cert?.testsPassed) {
      throw new ObjectRegistryError(
        `La version '${version.version}' de '${objectId}' no tiene las pruebas en verde. La ` +
          `certificacion minima es requisito para publicar (4.5).`,
      );
    }
    if (!cert.reviewedBy?.trim()) {
      throw new ObjectRegistryError(
        `La version '${version.version}' de '${objectId}' no tiene revision por pares. Las ` +
          `pruebas automatizadas no la sustituyen (4.5).`,
      );
    }

    const { dimensions, measures } = version.dataContract;
    if (dimensions.min > dimensions.max || measures.min > measures.max) {
      throw new ObjectRegistryError(
        `Contrato de datos incoherente en '${objectId}@${version.version}': el minimo supera al maximo.`,
      );
    }
  }
}
