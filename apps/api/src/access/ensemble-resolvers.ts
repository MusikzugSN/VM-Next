import { Injectable } from '@nestjs/common';

/** Loads the ensemble id of an element (e.g. a folder); `null` if the element does not exist. */
export type EnsembleResolver = (elementId: string) => Promise<string | null>;

/**
 * Registry for `@RequirePermission(..., { ensembleFrom: { resolver: 'folder', from: 'param:folderId' } })`.
 * Feature modules register their resolvers in `onModuleInit`.
 */
@Injectable()
export class EnsembleResolvers {
  private readonly resolvers = new Map<string, EnsembleResolver>();

  register(name: string, resolver: EnsembleResolver): void {
    if (this.resolvers.has(name)) throw new Error(`Ensemble resolver "${name}" registered twice`);
    this.resolvers.set(name, resolver);
  }

  get(name: string): EnsembleResolver {
    const resolver = this.resolvers.get(name);
    if (!resolver) throw new Error(`Unknown ensemble resolver "${name}"`);
    return resolver;
  }
}
