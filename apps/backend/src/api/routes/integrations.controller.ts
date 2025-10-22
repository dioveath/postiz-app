import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Post,
  Put,
  Query,
  UseFilters,
} from '@nestjs/common';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import { ConnectIntegrationDto } from '@gitroom/nestjs-libraries/dtos/integrations/connect.integration.dto';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization, User } from '@prisma/client';
import { IntegrationFunctionDto } from '@gitroom/nestjs-libraries/dtos/integrations/integration.function.dto';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
import { ApiTags } from '@nestjs/swagger';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { NotEnoughScopesFilter } from '@gitroom/nestjs-libraries/integrations/integration.missing.scopes';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { IntegrationTimeDto } from '@gitroom/nestjs-libraries/dtos/integrations/integration.time.dto';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { PlugDto } from '@gitroom/nestjs-libraries/dtos/plugs/plug.dto';
import {
  NotEnoughScopes,
  RefreshToken,
} from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { timer } from '@gitroom/helpers/utils/timer';
import { TelegramProvider } from '@gitroom/nestjs-libraries/integrations/social/telegram.provider';
import {
  AuthorizationActions,
  Sections,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';
import { uniqBy } from 'lodash';
import { OAuthAppService } from '@gitroom/nestjs-libraries/database/prisma/oauth-apps/oauth-app.service';
import { providerCredentialConfig } from '@gitroom/helpers/integrations/provider.credentials';

@ApiTags('Integrations')
@Controller('/integrations')
export class IntegrationsController {
  constructor(
    private _integrationManager: IntegrationManager,
    private _integrationService: IntegrationService,
    private _postService: PostsService,
    private _oauthAppService: OAuthAppService
  ) {}
  @Get('/')
  getIntegration() {
    return this._integrationManager.getAllIntegrations();
  }

  @Get('/:identifier/internal-plugs')
  getInternalPlugs(@Param('identifier') identifier: string) {
    return this._integrationManager.getInternalPlugs(identifier);
  }

  @Get('/customers')
  getCustomers(@GetOrgFromRequest() org: Organization) {
    return this._integrationService.customers(org.id);
  }

  @Put('/:id/group')
  async updateIntegrationGroup(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: { group: string }
  ) {
    return this._integrationService.updateIntegrationGroup(
      org.id,
      id,
      body.group
    );
  }

  @Put('/:id/customer-name')
  async updateOnCustomerName(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: { name: string }
  ) {
    return this._integrationService.updateOnCustomerName(org.id, id, body.name);
  }

  @Get('/list')
  async getIntegrationList(@GetOrgFromRequest() org: Organization) {
    return {
      integrations: await Promise.all(
        (
          await this._integrationService.getIntegrationsList(org.id)
        ).map(async (p) => {
          const findIntegration = this._integrationManager.getSocialIntegration(
            p.providerIdentifier
          );
          const credentialFields =
            providerCredentialConfig[p.providerIdentifier] || [];
          const customFields = findIntegration.customFields
            ? await findIntegration.customFields()
            : undefined;
          return {
            name: p.name,
            id: p.id,
            internalId: p.internalId,
            disabled: p.disabled,
            editor: findIntegration.editor,
            picture: p.picture || '/no-picture.jpg',
            identifier: p.providerIdentifier,
            inBetweenSteps: p.inBetweenSteps,
            refreshNeeded: p.refreshNeeded,
            isCustomFields: !!customFields,
            ...(customFields ? { customFields } : {}),
            ...(credentialFields.length
              ? {
                  credentialFields: credentialFields.map((field) => ({
                    key: field.envKey,
                    label: field.label,
                    required: !!field.required,
                    type: field.type,
                  })),
                  oauthApp: p.oauthApp
                    ? { id: p.oauthApp.id, name: p.oauthApp.name }
                    : undefined,
                }
              : {}),
            display: p.profile,
            type: p.type,
            time: JSON.parse(p.postingTimes),
            changeProfilePicture: !!findIntegration?.changeProfilePicture,
            changeNickName: !!findIntegration?.changeNickname,
            customer: p.customer,
            additionalSettings: p.additionalSettings || '[]',
          };
        })
      ),
    };
  }

  @Get('/oauth-apps')
  async listOAuthApps(
    @GetOrgFromRequest() org: Organization,
    @Query('provider') provider: string
  ) {
    if (!provider) {
      throw new HttpException('Missing provider', HttpStatus.BAD_REQUEST);
    }

    if (!providerCredentialConfig[provider]) {
      throw new HttpException('Unsupported provider', HttpStatus.BAD_REQUEST);
    }

    const apps = await this._oauthAppService.list(org.id, provider);

    return {
      apps,
      fields: providerCredentialConfig[provider].map((field) => ({
        key: field.envKey,
        label: field.label,
        required: !!field.required,
        type: field.type,
      })),
    };
  }

  @Post('/oauth-apps')
  async createOAuthApp(
    @GetOrgFromRequest() org: Organization,
    @Body()
    body: {
      providerIdentifier: string;
      name: string;
      credentials: Record<string, string>;
      isDefault?: boolean;
    }
  ) {
    const { providerIdentifier, name, credentials, isDefault } = body;

    if (!providerIdentifier || !name || !credentials) {
      throw new HttpException('Invalid request', HttpStatus.BAD_REQUEST);
    }

    if (!providerCredentialConfig[providerIdentifier]) {
      throw new HttpException('Unsupported provider', HttpStatus.BAD_REQUEST);
    }

    return this._oauthAppService.create(
      org.id,
      providerIdentifier,
      name.trim(),
      credentials,
      isDefault
    );
  }

  @Post('/:id/settings')
  async updateProviderSettings(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body('additionalSettings') body: string
  ) {
    if (typeof body !== 'string') {
      throw new Error('Invalid body');
    }

    await this._integrationService.updateProviderSettings(org.id, id, body);
  }
  @Post('/:id/nickname')
  async setNickname(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: { name: string; picture: string }
  ) {
    const integration = await this._integrationService.getIntegrationById(
      org.id,
      id
    );
    if (!integration) {
      throw new Error('Invalid integration');
    }

    const manager = this._integrationManager.getSocialIntegration(
      integration.providerIdentifier
    );
    if (!manager.changeProfilePicture && !manager.changeNickname) {
      throw new Error('Invalid integration');
    }

    const { url } = manager.changeProfilePicture
      ? await manager.changeProfilePicture(
          integration.internalId,
          integration.token,
          body.picture
        )
      : { url: '' };

    const { name } = manager.changeNickname
      ? await manager.changeNickname(
          integration.internalId,
          integration.token,
          body.name
        )
      : { name: '' };

    return this._integrationService.updateNameAndUrl(id, name, url);
  }

  @Get('/:id')
  getSingleIntegration(
    @Param('id') id: string,
    @Query('order') order: string,
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    return this._integrationService.getIntegrationForOrder(
      id,
      order,
      user.id,
      org.id
    );
  }

  @Get('/social/:integration')
  @CheckPolicies([AuthorizationActions.Create, Sections.CHANNEL])
  async getIntegrationUrl(
    @Param('integration') integration: string,
    @Query('refresh') refresh: string,
    @Query('externalUrl') externalUrl: string,
    @Query('oauthAppId') oauthAppId: string,
    @GetOrgFromRequest() org: Organization
  ) {
    if (
      !this._integrationManager
        .getAllowedSocialsIntegrations()
        .includes(integration)
    ) {
      throw new Error('Integration not allowed');
    }

    const integrationProvider =
      this._integrationManager.getSocialIntegration(integration);

    if (integrationProvider.externalUrl && !externalUrl) {
      throw new Error('Missing external url');
    }

    try {
      const getExternalUrl = integrationProvider.externalUrl
        ? {
            ...(await integrationProvider.externalUrl(externalUrl)),
            instanceUrl: externalUrl,
          }
        : undefined;

      const existingIntegration = refresh
        ? await this._integrationService.getIntegrationByInternalId(
            org.id,
            refresh
          )
        : null;

      const clientInformation = await this._oauthAppService.buildClientInformation(
        org.id,
        integration,
        {
          oauthAppId: oauthAppId || existingIntegration?.oauthAppId,
          instanceUrl: getExternalUrl?.instanceUrl,
          fallbackToEnv: true,
        }
      );

      const providerWithCredentials = this._integrationManager.getSocialIntegration(
        integration,
        clientInformation
      );

      const { codeVerifier, state, url } = await providerWithCredentials.generateAuthUrl(
        clientInformation
      );

      if (refresh) {
        await ioRedis.set(`refresh:${state}`, refresh, 'EX', 300);
      }

      await ioRedis.set(`login:${state}`, codeVerifier, 'EX', 300);
      await ioRedis.set(
        `external:${state}`,
        JSON.stringify(getExternalUrl),
        'EX',
        300
      );

      if (clientInformation?.oauthAppId) {
        await ioRedis.set(
          `oauth-app:${state}`,
          clientInformation.oauthAppId,
          'EX',
          300
        );
      }

      return { url };
    } catch (err) {
      return { err: true };
    }
  }

  @Post('/:id/time')
  async setTime(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: IntegrationTimeDto
  ) {
    return this._integrationService.setTimes(org.id, id, body);
  }

  @Post('/mentions')
  async mentions(
    @GetOrgFromRequest() org: Organization,
    @Body() body: IntegrationFunctionDto
  ) {
    const getIntegration = await this._integrationService.getIntegrationById(
      org.id,
      body.id
    );
    if (!getIntegration) {
      throw new Error('Invalid integration');
    }

    let newList: any[] | { none: true } = [];
    try {
      newList = (await this.functionIntegration(org, body)) || [];
    } catch (err) {
      console.log(err);
    }

    if (!Array.isArray(newList) && newList?.none) {
      return newList;
    }

    const list = await this._integrationService.getMentions(
      getIntegration.providerIdentifier,
      body?.data?.query
    );

    if (Array.isArray(newList) && newList.length) {
      await this._integrationService.insertMentions(
        getIntegration.providerIdentifier,
        newList
          .map((p: any) => ({
            name: p.label || '',
            username: p.id || '',
            image: p.image || '',
            doNotCache: p.doNotCache || false,
          }))
          .filter((f: any) => f.name && !f.doNotCache)
      );
    }

    return uniqBy(
      [
        ...list.map((p) => ({
          id: p.username,
          image: p.image,
          label: p.name,
        })),
        ...(newList as any[]),
      ],
      (p) => p.id
    ).filter((f) => f.label && f.id);
  }

  @Post('/function')
  async functionIntegration(
    @GetOrgFromRequest() org: Organization,
    @Body() body: IntegrationFunctionDto
  ): Promise<any> {
    const getIntegration = await this._integrationService.getIntegrationById(
      org.id,
      body.id
    );
    if (!getIntegration) {
      throw new Error('Invalid integration');
    }

    const integrationWithApp = getIntegration as typeof getIntegration & {
      oauthAppId?: string | null;
      oauthApp?: any;
    };
    let clientInformation =
      await this._integrationService.getClientInformationForIntegration(
        integrationWithApp
      );

    const providerMethod = (
      this._integrationManager.getSocialIntegration(
        getIntegration.providerIdentifier
      ) as any
    )[body.name];

    if (providerMethod) {
      try {
        const providerInstance = this._integrationManager.getSocialIntegration(
          getIntegration.providerIdentifier,
          clientInformation
        );

        // @ts-ignore
        const handler = providerInstance[body.name]?.bind(providerInstance);
        if (!handler) {
          return false;
        }

        const load = await handler(
          getIntegration.token,
          body.data,
          getIntegration.internalId,
          getIntegration
        );

        return load;
      } catch (err) {
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
              undefined,
              integrationWithApp.inBetweenSteps,
              undefined,
              undefined,
              integrationWithApp.customInstanceDetails || undefined,
              integrationWithApp.oauthAppId || undefined
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

            return this.functionIntegration(org, body);
          } else {
            await this._integrationService.disconnectChannel(
              org.id,
              getIntegration
            );
            return false;
          }
        }

        return false;
      }
    }
    throw new Error('Function not found');
  }

  @Post('/social/:integration/connect')
  @CheckPolicies([AuthorizationActions.Create, Sections.CHANNEL])
  @UseFilters(new NotEnoughScopesFilter())
  async connectSocialMedia(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string,
    @Body() body: ConnectIntegrationDto
  ) {
    if (
      !this._integrationManager
        .getAllowedSocialsIntegrations()
        .includes(integration)
    ) {
      throw new Error('Integration not allowed');
    }

    const integrationProvider =
      this._integrationManager.getSocialIntegration(integration);

    const getCodeVerifier = integrationProvider.customFields
      ? 'none'
      : await ioRedis.get(`login:${body.state}`);
    if (!getCodeVerifier) {
      throw new Error('Invalid state');
    }

    if (!integrationProvider.customFields) {
      await ioRedis.del(`login:${body.state}`);
    }

    const details = integrationProvider.externalUrl
      ? await ioRedis.get(`external:${body.state}`)
      : undefined;

    if (details) {
      await ioRedis.del(`external:${body.state}`);
    }

    const refresh = await ioRedis.get(`refresh:${body.state}`);
    if (refresh) {
      await ioRedis.del(`refresh:${body.state}`);
    }

    const cachedOauthAppId = await ioRedis.get(`oauth-app:${body.state}`);
    if (cachedOauthAppId) {
      await ioRedis.del(`oauth-app:${body.state}`);
    }

    const existingIntegration = body.refresh
      ? await this._integrationService.getIntegrationByInternalId(
          org.id,
          body.refresh
        )
      : null;

    const externalDetails = details ? JSON.parse(details) : undefined;

    const resolvedOauthAppId =
      body.oauthAppId || cachedOauthAppId || existingIntegration?.oauthAppId || undefined;

    const clientInformation = await this._oauthAppService.buildClientInformation(
      org.id,
      integration,
      {
        oauthAppId: resolvedOauthAppId,
        instanceUrl: externalDetails?.instanceUrl,
        fallbackToEnv: true,
      }
    );

    const providerWithCredentials = this._integrationManager.getSocialIntegration(
      integration,
      clientInformation
    );

    let auth = await providerWithCredentials.authenticate(
      {
        code: body.code,
        codeVerifier: getCodeVerifier,
        refresh: body.refresh,
      },
      externalDetails,
      clientInformation
    );

    if (typeof auth === 'string') {
      throw new NotEnoughScopes(auth);
    }

    if (refresh && providerWithCredentials.reConnect) {
      auth = await providerWithCredentials.reConnect(
        auth.id,
        refresh,
        auth.accessToken
      );
    }

    const {
      error,
      accessToken,
      expiresIn,
      refreshToken,
      id,
      name,
      picture,
      username,
      additionalSettings,
    } = auth;

    if (error) {
      throw new NotEnoughScopes(error);
    }

    if (!id) {
      throw new NotEnoughScopes('Invalid API key');
    }

    if (refresh && String(id) !== String(refresh)) {
      throw new NotEnoughScopes(
        'Please refresh the channel that needs to be refreshed'
      );
    }

    let validName = name;
    if (!validName) {
      if (username) {
        validName = username.split('.')[0] ?? username;
      } else {
        validName = `Channel_${String(id).slice(0, 8)}`;
      }
    }

    if (
      process.env.STRIPE_PUBLISHABLE_KEY &&
      org.isTrailing &&
      (await this._integrationService.checkPreviousConnections(
        org.id,
        String(id)
      ))
    ) {
      throw new HttpException('', 412);
    }

    return this._integrationService.createOrUpdateIntegration(
      additionalSettings,
      !!integrationProvider.oneTimeToken,
      org.id,
      validName.trim(),
      picture,
      'social',
      String(id),
      integration,
      accessToken,
      refreshToken,
      expiresIn,
      username,
      refresh ? false : integrationProvider.isBetweenSteps,
      body.refresh,
      +body.timezone,
      details
        ? AuthService.fixedEncryption(details)
        : integrationProvider.customFields
        ? AuthService.fixedEncryption(
            Buffer.from(body.code, 'base64').toString()
          )
        : undefined,
      resolvedOauthAppId
    );
  }

  @Post('/disable')
  disableChannel(
    @GetOrgFromRequest() org: Organization,
    @Body('id') id: string
  ) {
    return this._integrationService.disableChannel(org.id, id);
  }

  @Post('/instagram/:id')
  async saveInstagram(
    @Param('id') id: string,
    @Body() body: { pageId: string; id: string },
    @GetOrgFromRequest() org: Organization
  ) {
    return this._integrationService.saveInstagram(org.id, id, body);
  }

  @Post('/facebook/:id')
  async saveFacebook(
    @Param('id') id: string,
    @Body() body: { page: string },
    @GetOrgFromRequest() org: Organization
  ) {
    return this._integrationService.saveFacebook(org.id, id, body.page);
  }

  @Post('/linkedin-page/:id')
  async saveLinkedin(
    @Param('id') id: string,
    @Body() body: { page: string },
    @GetOrgFromRequest() org: Organization
  ) {
    return this._integrationService.saveLinkedin(org.id, id, body.page);
  }

  @Post('/enable')
  enableChannel(
    @GetOrgFromRequest() org: Organization,
    @Body('id') id: string
  ) {
    return this._integrationService.enableChannel(
      org.id,
      // @ts-ignore
      org?.subscription?.totalChannels || pricing.FREE.channel,
      id
    );
  }

  @Delete('/')
  async deleteChannel(
    @GetOrgFromRequest() org: Organization,
    @Body('id') id: string
  ) {
    const isTherePosts = await this._integrationService.getPostsForChannel(
      org.id,
      id
    );
    if (isTherePosts.length) {
      for (const post of isTherePosts) {
        await this._postService.deletePost(org.id, post.group);
      }
    }

    return this._integrationService.deleteChannel(org.id, id);
  }

  @Get('/plug/list')
  async getPlugList() {
    return { plugs: this._integrationManager.getAllPlugs() };
  }

  @Get('/:id/plugs')
  async getPlugsByIntegrationId(
    @Param('id') id: string,
    @GetOrgFromRequest() org: Organization
  ) {
    return this._integrationService.getPlugsByIntegrationId(org.id, id);
  }

  @Post('/:id/plugs')
  async postPlugsByIntegrationId(
    @Param('id') id: string,
    @GetOrgFromRequest() org: Organization,
    @Body() body: PlugDto
  ) {
    return this._integrationService.createOrUpdatePlug(org.id, id, body);
  }

  @Put('/plugs/:id/activate')
  async changePlugActivation(
    @Param('id') id: string,
    @GetOrgFromRequest() org: Organization,
    @Body('status') status: boolean
  ) {
    return this._integrationService.changePlugActivation(org.id, id, status);
  }

  @Get('/telegram/updates')
  async getUpdates(@Query() query: { word: string; id?: number }) {
    return new TelegramProvider().getBotId(query);
  }
}
