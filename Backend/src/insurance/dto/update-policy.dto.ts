import {
  IsDateString,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdatePolicyDto {
  @IsString()
  @IsOptional()
  productName?: string;

  @IsString()
  @IsOptional()
  coverageType?: string;

  @IsNumberString()
  @IsOptional()
  coverageAmount?: string;

  @IsNumberString()
  @IsOptional()
  premiumAmount?: string;

  @IsDateString()
  @IsOptional()
  effectiveDate?: string;

  @IsDateString()
  @IsOptional()
  expirationDate?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  modifiedBy?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
