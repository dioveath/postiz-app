import { AuthService } from '@gitroom/helpers/auth/auth.service';
import {
  ProviderCredentialField,
  providerCredentialConfig,
} from '@gitroom/helpers/integrations/provider.credentials';
import { Integration } from '@prisma/client';

export type ProviderCredentialMap = Record<string, string>;

export const getCredentialFieldsForProvider = (
  identifier: string
): ProviderCredentialField[] => providerCredentialConfig[identifier] || [];

export const decodeCredentialPayload = (
  encoded?: string
): ProviderCredentialMap | undefined => {
  if (!encoded) {
    return undefined;
  }
  try {
    const json = Buffer.from(encoded, 'base64').toString('utf8');
    const parsed = JSON.parse(json) as Record<string, string>;
    return Object.entries(parsed).reduce<ProviderCredentialMap>((acc, [key, value]) => {
      if (typeof value === 'string') {
        acc[key] = value.trim();
      }
      return acc;
    }, {});
  } catch (err) {
    return undefined;
  }
};

export const encryptAppCredentials = (
  credentials: ProviderCredentialMap
): string => {
  return AuthService.fixedEncryption(JSON.stringify(credentials));
};

export const decryptAppCredentials = (
  encrypted?: string | null
): ProviderCredentialMap | undefined => {
  if (!encrypted) {
    return undefined;
  }
  try {
    return JSON.parse(AuthService.fixedDecryption(encrypted));
  } catch (err) {
    return undefined;
  }
};

export const getIntegrationCredentials = (
  integration?: Integration | null
): ProviderCredentialMap | undefined => {
  if (!integration) {
    return undefined;
  }
  return decryptAppCredentials(integration.appCredentials);
};

type ExecuteOptions = {
  credentials?: ProviderCredentialMap;
  integration?: Integration | null;
};

const buildCredentialMap = (
  identifier: string,
  options: ExecuteOptions
): ProviderCredentialMap | undefined => {
  const fields = getCredentialFieldsForProvider(identifier);
  if (!fields.length) {
    return undefined;
  }
  const provided = options.credentials || {};
  const stored = getIntegrationCredentials(options.integration) || {};
  const map: ProviderCredentialMap = {};

  for (const field of fields) {
    const value = provided[field.envKey] ?? stored[field.envKey];
    if (value) {
      map[field.envKey] = value;
      continue;
    }
    if (field.required && !process.env[field.envKey]) {
      throw new Error(
        `Missing credential for ${identifier}: ${field.envKey}`
      );
    }
  }

  return Object.keys(map).length ? map : undefined;
};

export const executeWithProviderCredentials = async <T>(
  identifier: string,
  options: ExecuteOptions,
  callback: () => Promise<T>
): Promise<T> => {
  const credentialOverrides = buildCredentialMap(identifier, options);
  if (!credentialOverrides) {
    return callback();
  }

  const previousValues: Record<string, string | undefined> = {};
  const fields = getCredentialFieldsForProvider(identifier);

  for (const field of fields) {
    previousValues[field.envKey] = process.env[field.envKey];
    const override = credentialOverrides[field.envKey];
    if (override) {
      process.env[field.envKey] = override;
    }
  }

  try {
    return await callback();
  } finally {
    for (const field of fields) {
      const prev = previousValues[field.envKey];
      if (typeof prev === 'undefined') {
        delete process.env[field.envKey];
      } else {
        process.env[field.envKey] = prev;
      }
    }
  }
};
