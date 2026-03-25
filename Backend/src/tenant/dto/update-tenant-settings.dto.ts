import { IsOptional, IsInt, IsBoolean, Min, Max } from 'class-validator';

export class UpdateTenantSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  maxUsers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxProjects?: number;

  @IsOptional()
  @IsBoolean()
  allowPublicProjects?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}
