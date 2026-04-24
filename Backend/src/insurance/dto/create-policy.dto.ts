import {
  IsDateString,
  IsNotEmpty,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreatePolicyDto {
  @IsUUID()
  holderId: string;

  @IsString()
  @IsNotEmpty()
  productName: string;

  @IsString()
  @IsNotEmpty()
  coverageType: string;

  @IsNumberString()
  coverageAmount: string;

  @IsNumberString()
  premiumAmount: string;

  @IsDateString()
  effectiveDate: string;

  @IsDateString()
  expirationDate: string;

  @IsString()
  @IsOptional()
  @MinLength(6)
  policyNumber?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  modifiedBy?: string;
}
