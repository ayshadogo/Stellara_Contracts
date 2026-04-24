import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagsService } from './feature-flags.service';

export const FEATURE_FLAG_KEY = 'feature_flag';
export const FeatureFlag = (name: string) => SetMetadata(FEATURE_FLAG_KEY, name);

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private featureFlagsService: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flagName = this.reflector.getAllAndOverride<string>(FEATURE_FLAG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!flagName) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user; // Assuming user is attached to request by AuthGuard
    
    const isEnabled = await this.featureFlagsService.isEnabled(flagName, user?.id);

    if (!isEnabled) {
      throw new ForbiddenException(`Feature ${flagName} is not enabled`);
    }

    return true;
  }
}
