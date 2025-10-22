import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { OAuthApp, Prisma } from '@prisma/client';

@Injectable()
export class OAuthAppRepository {
  constructor(private _oauthApp: PrismaRepository<'oAuthApp'>) {}

  listByProvider(orgId: string, providerIdentifier: string) {
    return this._oauthApp.model.oAuthApp.findMany({
      where: {
        organizationId: orgId,
        providerIdentifier,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findById(orgId: string, id: string): Promise<OAuthApp | null> {
    return this._oauthApp.model.oAuthApp.findFirst({
      where: {
        id,
        organizationId: orgId,
        deletedAt: null,
      },
    });
  }

  async create(data: Prisma.OAuthAppUncheckedCreateInput) {
    return this._oauthApp.model.oAuthApp.create({
      data,
    });
  }

  async update(id: string, data: Partial<OAuthApp>) {
    return this._oauthApp.model.oAuthApp.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string) {
    return this._oauthApp.model.oAuthApp.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async unsetDefaults(orgId: string, providerIdentifier: string) {
    await this._oauthApp.model.oAuthApp.updateMany({
      where: {
        organizationId: orgId,
        providerIdentifier,
        deletedAt: null,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });
  }
}
