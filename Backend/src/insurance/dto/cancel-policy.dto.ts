import { IsOptional, IsString } from 'class-validator';

export class CancelPolicyDto {
  @IsString()
  reason: string;

  @IsString()
  @IsOptional()
  modifiedBy?: string;
}
