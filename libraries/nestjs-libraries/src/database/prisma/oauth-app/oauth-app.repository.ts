import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

@Injectable()
export class OAuthAppRepository {
  constructor(private _oauthApp: PrismaRepository<'oAuthApp'>) {}

  getOAuthAppsByProvider(orgId: string, providerIdentifier: string) {
    return this._oauthApp.model.oAuthApp.findMany({
      where: { organizationId: orgId, providerIdentifier, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        providerIdentifier: true,
        clientId: true,
        // Never expose clientSecret here
        isDefault: true,
        createdAt: true,
      },
    });
  }

  getOAuthAppById(id: string, orgId: string) {
    return this._oauthApp.model.oAuthApp.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
    });
  }

  createOAuthApp(data: {
    orgId: string;
    providerIdentifier: string;
    name: string;
    clientId: string;
    clientSecret: string;
    isDefault?: boolean;
  }) {
    return this._oauthApp.model.oAuthApp.create({
      data: {
        organizationId: data.orgId,
        providerIdentifier: data.providerIdentifier,
        name: data.name,
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        isDefault: !!data.isDefault,
      },
    });
  }

  updateOAuthApp(
    id: string,
    orgId: string,
    data: Partial<{
      name: string;
      clientId: string;
      clientSecret: string;
      isDefault: boolean;
    }>
  ) {
    return this._oauthApp.model.oAuthApp.update({
      where: { id, organizationId: orgId },
      data,
    });
  }

  deleteOAuthApp(id: string, orgId: string) {
    return this._oauthApp.model.oAuthApp.update({
      where: { id, organizationId: orgId },
      data: { deletedAt: new Date() },
    });
  }

  getDefaultOAuthApp(providerIdentifier: string) {
    return this._oauthApp.model.oAuthApp.findFirst({
      where: { providerIdentifier, isDefault: true, deletedAt: null },
    });
  }

  getOAuthAppByIdAny(id: string) {
    return this._oauthApp.model.oAuthApp.findFirst({
      where: { id, deletedAt: null },
    });
  }
}


