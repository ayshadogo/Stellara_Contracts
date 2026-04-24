import {
  IsDateString,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class RenewPolicyDto {
  @IsDateString()
  @IsOptional()
  effectiveDate?: string;

  @IsDateString()
  @IsOptional()
  expirationDate?: string;

  @IsNumberString()
  @IsOptional()
  premiumAmount?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  modifiedBy?: string;
}
