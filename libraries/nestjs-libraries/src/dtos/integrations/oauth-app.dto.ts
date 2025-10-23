import { IsString } from 'class-validator';

export class CreateOAuthAppDto {
  @IsString()
  providerIdentifier!: string;

  @IsString()
  name!: string;

  @IsString()
  clientId!: string;

  @IsString()
  clientSecret!: string;
}


