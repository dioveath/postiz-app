import { Injectable } from '@nestjs/common';
import { OAuthAppRepository } from './oauth-app.repository';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import {
  ProviderCredentialField,
  providerCredentialConfig,
} from '@gitroom/helpers/integrations/provider.credentials';
import { OAuthApp, Prisma } from '@prisma/client';
import { ClientInformation } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';

type CredentialInput = Record<string, string>;

const decrypt = (value?: string | null) => {
  if (!value) {
    return undefined;
  }
  return AuthService.fixedDecryption(value);
};

const encrypt = (value?: string) => {
  if (!value) {
    return undefined;
  }
  return AuthService.fixedEncryption(value);
};

const sanitizeCredentialValue = (value?: string) => value?.trim() || '';

@Injectable()
export class OAuthAppService {
  constructor(private _repository: OAuthAppRepository) {}

  private getFields(providerIdentifier: string): ProviderCredentialField[] {
    return providerCredentialConfig[providerIdentifier] || [];
  }

  private mapInput(
    providerIdentifier: string,
    credentials: CredentialInput
  ) {
    const fields = this.getFields(providerIdentifier);

    if (!fields.length) {
      throw new Error('Provider does not support OAuth apps');
    }

    const mapped = fields.reduce<CredentialInput>((acc, field) => {
      const value = sanitizeCredentialValue(credentials[field.envKey]);
      if (field.required && !value) {
        throw new Error(`Missing credential: ${field.label}`);
      }
      if (value) {
        acc[field.envKey] = value;
      }
      return acc;
    }, {});

    const [firstField, secondField, ...rest] = fields;

    const clientId = firstField ? mapped[firstField.envKey] || '' : '';
    const clientSecret = secondField
      ? mapped[secondField.envKey] || undefined
      : undefined;

    const additionalData = rest.reduce<Record<string, string>>(
      (acc, field) => {
        if (mapped[field.envKey]) {
          acc[field.envKey] = mapped[field.envKey]!;
        }
        return acc;
      },
      {}
    );

    return {
      clientId,
      clientSecret,
      additionalData,
    };
  }

  private serialize(
    orgId: string,
    providerIdentifier: string,
    name: string,
    credentials: CredentialInput,
    isDefault?: boolean
  ): Prisma.OAuthAppUncheckedCreateInput {
    const mapped = this.mapInput(providerIdentifier, credentials);

    const additionalData = Object.keys(mapped.additionalData).length
      ? Object.entries(mapped.additionalData).reduce<Record<string, string>>(
          (acc, [key, value]) => {
            acc[key] = AuthService.fixedEncryption(value);
            return acc;
          },
          {}
        )
      : undefined;

    return {
      organizationId: orgId,
      providerIdentifier,
      name,
      clientId: mapped.clientId,
      clientSecret: encrypt(mapped.clientSecret),
      ...(additionalData ? { additionalData } : {}),
      isDefault: !!isDefault,
    };
  }

  async list(orgId: string, providerIdentifier: string) {
    const apps = await this._repository.listByProvider(orgId, providerIdentifier);

    return apps.map((app) => ({
      id: app.id,
      name: app.name,
      isDefault: app.isDefault,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    }));
  }

  async create(
    orgId: string,
    providerIdentifier: string,
    name: string,
    credentials: CredentialInput,
    isDefault?: boolean
  ) {
    if (isDefault) {
      await this._repository.unsetDefaults(orgId, providerIdentifier);
    }

    const data = this.serialize(
      orgId,
      providerIdentifier,
      name,
      credentials,
      isDefault
    );

    const created = await this._repository.create(data);

    return {
      id: created.id,
      name: created.name,
      isDefault: created.isDefault,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  private decryptApp(app: OAuthApp | null): (OAuthApp & {
    decryptedSecret?: string;
    decryptedAdditionalData?: Record<string, string>;
  }) | null {
    if (!app) {
      return null;
    }

    const decryptedAdditionalData: Record<string, string> | undefined =
      app.additionalData
        ? Object.entries(app.additionalData as Record<string, string>).reduce(
            (acc, [key, value]) => {
              const decryptedValue = decrypt(value);
              if (decryptedValue) {
                acc[key] = decryptedValue;
              }
              return acc;
            },
            {} as Record<string, string>
          )
        : undefined;

    return {
      ...app,
      decryptedSecret: decrypt(app.clientSecret),
      decryptedAdditionalData,
    };
  }

  async findById(orgId: string, id: string) {
    return this.decryptApp(await this._repository.findById(orgId, id));
  }

  async buildClientInformation(
    orgId: string,
    providerIdentifier: string,
    options: {
      oauthAppId?: string;
      instanceUrl?: string;
      fallbackToEnv?: boolean;
    } = {}
  ): Promise<ClientInformation | undefined> {
    const fields = this.getFields(providerIdentifier);
    if (!fields.length) {
      return undefined;
    }

    const { oauthAppId, fallbackToEnv, instanceUrl } = options;

    const resolvedApp = oauthAppId
      ? await this.findById(orgId, oauthAppId)
      : await this.getDefaultApp(orgId, providerIdentifier);

    if (!resolvedApp) {
      if (!fallbackToEnv) {
        throw new Error('No OAuth application configured for this provider');
      }

      const fromEnv = this.buildFromEnv(providerIdentifier, instanceUrl);
      if (!fromEnv) {
        throw new Error('Missing environment credentials for provider');
      }
      return fromEnv;
    }

    return this.buildFromOAuthApp(providerIdentifier, resolvedApp, instanceUrl);
  }

  private async getDefaultApp(orgId: string, providerIdentifier: string) {
    const apps = await this._repository.listByProvider(orgId, providerIdentifier);
    const defaultApp = apps.find((app) => app.isDefault);
    return this.decryptApp(defaultApp || null);
  }

  private buildFromOAuthApp(
    providerIdentifier: string,
    app: ReturnType<OAuthAppService['decryptApp']>,
    instanceUrl?: string
  ): ClientInformation {
    if (!app) {
      throw new Error('Invalid OAuth app');
    }

    const fields = this.getFields(providerIdentifier);
    const info: ClientInformation = {
      oauthAppId: app.id,
      instanceUrl,
    };

    fields.forEach((field, index) => {
      if (index === 0) {
        info[field.envKey] = app.clientId;
        return;
      }
      if (index === 1) {
        info[field.envKey] = app.decryptedSecret;
        return;
      }
      info[field.envKey] = app.decryptedAdditionalData?.[field.envKey];
    });

    return info;
  }

  private buildFromEnv(
    providerIdentifier: string,
    instanceUrl?: string
  ): ClientInformation | undefined {
    const fields = this.getFields(providerIdentifier);
    if (!fields.length) {
      return undefined;
    }

    const info: ClientInformation = {
      instanceUrl,
    };

    for (const field of fields) {
      const value = process.env[field.envKey];
      if (!value) {
        if (field.required) {
          return undefined;
        }
        continue;
      }
      info[field.envKey] = value;
    }

    return info;
  }
}
