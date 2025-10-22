import 'reflect-metadata';

import { Injectable } from '@nestjs/common';
import { XProvider } from '@gitroom/nestjs-libraries/integrations/social/x.provider';
import { SocialProvider } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { LinkedinProvider } from '@gitroom/nestjs-libraries/integrations/social/linkedin.provider';
import { RedditProvider } from '@gitroom/nestjs-libraries/integrations/social/reddit.provider';
import { DevToProvider } from '@gitroom/nestjs-libraries/integrations/social/dev.to.provider';
import { HashnodeProvider } from '@gitroom/nestjs-libraries/integrations/social/hashnode.provider';
import { MediumProvider } from '@gitroom/nestjs-libraries/integrations/social/medium.provider';
import { FacebookProvider } from '@gitroom/nestjs-libraries/integrations/social/facebook.provider';
import { InstagramProvider } from '@gitroom/nestjs-libraries/integrations/social/instagram.provider';
import { YoutubeProvider } from '@gitroom/nestjs-libraries/integrations/social/youtube.provider';
import { TiktokProvider } from '@gitroom/nestjs-libraries/integrations/social/tiktok.provider';
import { PinterestProvider } from '@gitroom/nestjs-libraries/integrations/social/pinterest.provider';
import { DribbbleProvider } from '@gitroom/nestjs-libraries/integrations/social/dribbble.provider';
import { LinkedinPageProvider } from '@gitroom/nestjs-libraries/integrations/social/linkedin.page.provider';
import { ThreadsProvider } from '@gitroom/nestjs-libraries/integrations/social/threads.provider';
import { DiscordProvider } from '@gitroom/nestjs-libraries/integrations/social/discord.provider';
import { SlackProvider } from '@gitroom/nestjs-libraries/integrations/social/slack.provider';
import { MastodonProvider } from '@gitroom/nestjs-libraries/integrations/social/mastodon.provider';
import { BlueskyProvider } from '@gitroom/nestjs-libraries/integrations/social/bluesky.provider';
import { LemmyProvider } from '@gitroom/nestjs-libraries/integrations/social/lemmy.provider';
import { InstagramStandaloneProvider } from '@gitroom/nestjs-libraries/integrations/social/instagram.standalone.provider';
import { FarcasterProvider } from '@gitroom/nestjs-libraries/integrations/social/farcaster.provider';
import { TelegramProvider } from '@gitroom/nestjs-libraries/integrations/social/telegram.provider';
import { NostrProvider } from '@gitroom/nestjs-libraries/integrations/social/nostr.provider';
import { VkProvider } from '@gitroom/nestjs-libraries/integrations/social/vk.provider';
import { WordpressProvider } from '@gitroom/nestjs-libraries/integrations/social/wordpress.provider';
import { ListmonkProvider } from '@gitroom/nestjs-libraries/integrations/social/listmonk.provider';
import { providerCredentialConfig } from '@gitroom/helpers/integrations/provider.credentials';
import { ClientInformation } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { SocialAbstract } from '@gitroom/nestjs-libraries/integrations/social.abstract';

type ProviderConstructor = new () => SocialProvider;

const socialIntegrationConstructors: ProviderConstructor[] = [
  XProvider,
  LinkedinProvider,
  LinkedinPageProvider,
  RedditProvider,
  InstagramProvider,
  InstagramStandaloneProvider,
  FacebookProvider,
  ThreadsProvider,
  YoutubeProvider,
  TiktokProvider,
  PinterestProvider,
  DribbbleProvider,
  DiscordProvider,
  SlackProvider,
  MastodonProvider,
  BlueskyProvider,
  LemmyProvider,
  FarcasterProvider,
  TelegramProvider,
  NostrProvider,
  VkProvider,
  MediumProvider,
  DevToProvider,
  HashnodeProvider,
  WordpressProvider,
  ListmonkProvider,
];

type ProviderRegistryEntry = {
  ctor: ProviderConstructor;
  instance: SocialProvider;
};

const socialIntegrationRegistry: ProviderRegistryEntry[] =
  socialIntegrationConstructors.map((Ctor) => ({
    ctor: Ctor,
    instance: new Ctor(),
  }));

const socialIntegrationMap = new Map<string, ProviderRegistryEntry>(
  socialIntegrationRegistry.map((entry) => [entry.instance.identifier, entry])
);

@Injectable()
export class IntegrationManager {
  async getAllIntegrations() {
    return {
      social: await Promise.all(
        socialIntegrationRegistry.map(async ({ instance }) => {
          const credentialFields = providerCredentialConfig[instance.identifier] || [];

          const customFields = instance.customFields
            ? await instance.customFields()
            : undefined;

          return {
            name: instance.name,
            identifier: instance.identifier,
            toolTip: instance.toolTip,
            editor: instance.editor,
            isExternal: !!instance.externalUrl,
            isWeb3: !!instance.isWeb3,
            ...(customFields ? { customFields } : {}),
            ...(credentialFields.length
              ? {
                  credentialFields: credentialFields.map((field) => ({
                    key: field.envKey,
                    label: field.label,
                    required: !!field.required,
                    type: field.type,
                  })),
                }
              : {}),
          };
        })
      ),
      article: [] as any[],
    };
  }

  getAllTools(): {
    [key: string]: {
      description: string;
      dataSchema: any;
      methodName: string;
    }[];
  } {
    return socialIntegrationRegistry.reduce(
      (all, { instance }) => ({
        ...all,
        [instance.identifier]:
          Reflect.getMetadata('custom:tool', instance.constructor.prototype) ||
          [],
      }),
      {}
    );
  }

  getAllRulesDescription(): {
    [key: string]: string;
  } {
    return socialIntegrationRegistry.reduce(
      (all, { instance }) => ({
        ...all,
        [instance.identifier]:
          Reflect.getMetadata(
            'custom:rules:description',
            instance.constructor
          ) || '',
      }),
      {}
    );
  }

  getAllPlugs() {
    return socialIntegrationRegistry
      .map(({ instance }) => {
        return {
          name: instance.name,
          identifier: instance.identifier,
          plugs: (
            Reflect.getMetadata('custom:plug', instance.constructor.prototype) ||
            []
          )
            .filter((f: any) => !f.disabled)
            .map((p: any) => ({
              ...p,
              fields: p.fields.map((c: any) => ({
                ...c,
                validation: c?.validation?.toString(),
              })),
            })),
        };
      })
      .filter((f) => f.plugs.length);
  }

  getInternalPlugs(providerName: string) {
    const entry = socialIntegrationMap.get(providerName);
    if (!entry) {
      throw new Error('Integration not found');
    }
    const { instance } = entry;
    return {
      internalPlugs:
        (
          Reflect.getMetadata(
            'custom:internal_plug',
            instance.constructor.prototype
          ) || []
        ).filter((f: any) => !f.disabled) || [],
    };
  }

  getAllowedSocialsIntegrations() {
    return socialIntegrationRegistry.map(({ instance }) => instance.identifier);
  }
  getSocialIntegration(
    integration: string,
    clientInformation?: ClientInformation
  ): SocialProvider {
    const entry = socialIntegrationMap.get(integration);
    if (!entry) {
      throw new Error('Integration not found');
    }
    const provider = new entry.ctor();
    if (provider instanceof SocialAbstract) {
      provider.setClientInformation(clientInformation);
    }
    return provider;
  }
}
