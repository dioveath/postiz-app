import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { RefreshToken } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { timer } from '@gitroom/helpers/utils/timer';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';

@Injectable()
export class IntegrationTriggerTool implements AgentToolInterface {
  constructor(
    private _integrationManager: IntegrationManager,
    private _integrationService: IntegrationService
  ) {}
  name = 'triggerTool';

  run() {
    return createTool({
      id: 'triggerTool',
      description: `After using the integrationSchema, we sometimes miss details we can\'t ask from the user, like ids.
      Sometimes this tool requires to user prompt for some settings, like a word to search for. methodName is required [input:callable-tools]`,
      inputSchema: z.object({
        integrationId: z.string().describe('The id of the integration'),
        methodName: z
          .string()
          .describe(
            'The methodName from the `integrationSchema` functions in the tools array, required'
          ),
        dataSchema: z.array(
          z.object({
            key: z.string().describe('Name of the settings key to pass'),
            value: z.string().describe('Value of the key'),
          })
        ),
      }),
      outputSchema: z.object({
        output: z.array(z.record(z.string(), z.any())),
      }),
      execute: async (args, options) => {
        const { context, runtimeContext } = args;
        checkAuth(args, options);
        console.log('triggerTool', context);
        const organizationId = JSON.parse(
          // @ts-ignore
          runtimeContext.get('organization') as string
        ).id;

        const getIntegration =
          await this._integrationService.getIntegrationById(
            organizationId,
            context.integrationId
          );

        if (!getIntegration) {
          return {
            output: 'Integration not found',
          };
        }

        const tools = this._integrationManager.getAllTools();
        if (
          // @ts-ignore
          !tools[getIntegration.providerIdentifier].some(
            (p) => p.methodName === context.methodName
          ) ||
          // @ts-ignore
          !this._integrationManager
            .getSocialIntegration(getIntegration.providerIdentifier)[
            context.methodName
          ]
        ) {
          return { output: 'tool not found' };
        }

        const integrationWithApp = getIntegration as typeof getIntegration & {
          oauthAppId?: string | null;
          oauthApp?: any;
        };
        let clientInformation =
          await this._integrationService.getClientInformationForIntegration(
            integrationWithApp
          );

        while (true) {
          try {
            const providerInstance = this._integrationManager.getSocialIntegration(
              getIntegration.providerIdentifier,
              clientInformation
            );

            const handler =
              // @ts-ignore
              providerInstance[context.methodName]?.bind(providerInstance);

            if (!handler) {
              return { output: 'tool not found' };
            }

            const payload = context.dataSchema.reduce(
              (all, current) => ({
                ...all,
                [current.key]: current.value,
              }),
              {}
            );

            // @ts-ignore
            const load = await handler(
              getIntegration.token,
              payload,
              getIntegration.internalId,
              getIntegration
            );

            return { output: load };
          } catch (err) {
            console.log(err);
            if (err instanceof RefreshToken) {
              const refreshed = await this._integrationService.refreshToken(
                integrationWithApp
              );

              if (refreshed) {
                const { accessToken, refreshToken, expiresIn, additionalSettings } =
                  refreshed;
                await this._integrationService.createOrUpdateIntegration(
                  additionalSettings,
                  !!this._integrationManager.getSocialIntegration(
                    getIntegration.providerIdentifier
                  ).oneTimeToken,
                  getIntegration.organizationId,
                  getIntegration.name,
                  getIntegration.picture!,
                  'social',
                  getIntegration.internalId,
                  getIntegration.providerIdentifier,
                  accessToken,
                  refreshToken,
                  expiresIn,
                  getIntegration.profile || undefined,
                  getIntegration.inBetweenSteps,
                  undefined,
                  undefined,
                  getIntegration.customInstanceDetails || undefined,
                  getIntegration.oauthAppId || undefined
                );

                getIntegration.token = accessToken;

                const refreshedProvider = this._integrationManager.getSocialIntegration(
                  getIntegration.providerIdentifier
                );

                if (refreshedProvider.refreshWait) {
                  await timer(10000);
                }

                clientInformation =
                  await this._integrationService.getClientInformationForIntegration(
                    integrationWithApp
                  );

                continue;
              } else {
                await this._integrationService.disconnectChannel(
                  organizationId,
                  getIntegration
                );
                return {
                  output:
                    'We had to disconnect the channel as the token expired',
                };
              }
            }
            return { output: 'Unexpected error' };
          }
        }
      },
    });
  }
}
