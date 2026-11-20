import { notFound, ruleViolation } from '../domain/errors.js';
import type { ProfessionalRow, ServiceRow } from '../domain/types.js';
import {
  CatalogRepository,
  toPublicService,
  type PublicProfessional,
  type PublicService,
} from '../repositories/catalog.repository.js';

export interface BookableEntities {
  service: ServiceRow;
  professional: ProfessionalRow;
}

export class CatalogService {
  constructor(private readonly catalog: CatalogRepository) {}

  async listServices(): Promise<PublicService[]> {
    return (await this.catalog.listActiveServices()).map(toPublicService);
  }

  async listProfessionals(serviceId?: string): Promise<PublicProfessional[]> {
    if (serviceId) {
      const service = await this.catalog.findService(serviceId);
      if (!service || !service.active) return [];
    }
    return this.catalog.listActiveProfessionals(serviceId);
  }

  /** RN-10 y RN-11: entidades activas y profesional habilitado para el servicio. */
  async ensureBookable(serviceId: string, professionalId: string): Promise<BookableEntities> {
    const service = await this.catalog.findService(serviceId);
    if (!service || !service.active) {
      throw ruleViolation('El servicio no está disponible para reservar.');
    }
    const professional = await this.catalog.findProfessional(professionalId);
    if (!professional || !professional.active) {
      throw ruleViolation('El profesional no está disponible para reservar.');
    }
    const offers = await this.catalog.offersService(professionalId, serviceId);
    if (!offers) {
      throw ruleViolation('El profesional elegido no realiza ese servicio.');
    }
    return { service, professional };
  }

  async getServiceOrFail(serviceId: string): Promise<ServiceRow> {
    const service = await this.catalog.findService(serviceId);
    if (!service) throw notFound('El servicio no existe.');
    return service;
  }
}
