import { Injectable } from '@nestjs/common';
import { OAuthAppRepository } from '@gitroom/nestjs-libraries/database/prisma/oauth-app/oauth-app.repository';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { Logger } from '@nestjs/common';

@Injectable()
export class OAuthAppService {
  constructor(
    private _oauthRepo: OAuthAppRepository
  ) {}

  async createOAuthApp(
    orgId: string,
    providerIdentifier: string,
    name: string,
    clientId: string,
    clientSecret: string
  ) {
    return this._oauthRepo.createOAuthApp({
      orgId,
      providerIdentifier,
      name,
      clientId,
      clientSecret: AuthService.fixedEncryption(clientSecret),
    });
  }

  async getOAuthAppForAuth(oauthAppId: string, orgId?: string) {
    // If orgId provided, restrict to org; otherwise fetch raw by id ignoring org (e.g., default/system)
    const app = orgId
      ? await this._oauthRepo.getOAuthAppById(oauthAppId, orgId)
      : await this._oauthRepo.getOAuthAppByIdAny(oauthAppId);
    return app;
  }

  async getOAuthAppsList(orgId: string, providerIdentifier?: string) {
    if (providerIdentifier) {
      const result = await this._oauthRepo.getOAuthAppsByProvider(orgId, providerIdentifier);
      return result;
    }
    return (this._oauthRepo as any)._oauthApp.model.oAuthApp.findMany({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        providerIdentifier: true,
        clientId: true,
        isDefault: true,
        createdAt: true,
      },
    });
  }

  async getDefaultOAuthApp(providerIdentifier: string) {
    return this._oauthRepo.getDefaultOAuthApp(providerIdentifier);
  }

  async getOrCreateDefaultOAuthApp(providerIdentifier: string) {
    const existing = await this.getDefaultOAuthApp(providerIdentifier);
    if (existing) return existing;

    // Only YouTube for now; extend for other providers later
    if (providerIdentifier === 'youtube' && process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET) {
      return this._oauthRepo.createOAuthApp({
        orgId: 'system',
        providerIdentifier,
        name: 'Default YouTube App',
        clientId: process.env.YOUTUBE_CLIENT_ID,
        clientSecret: AuthService.fixedEncryption(process.env.YOUTUBE_CLIENT_SECRET),
        isDefault: true,
      });
    }
    return null;
  }

  deleteOAuthApp(id: string, orgId: string) {
    return this._oauthRepo.deleteOAuthApp(id, orgId);
  }
}


