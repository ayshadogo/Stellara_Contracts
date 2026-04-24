import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

const DEPRECATED_VERSIONS = new Set(['v1']);
const CURRENT_VERSION = 'v2';
const SUNSET_DATE = '2026-12-31';

@Injectable()
export class VersioningMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const match = req.path.match(/^\/api\/(v\d+)\//);
    const version = match?.[1];

    if (version) {
      res.setHeader('X-API-Version', version);

      if (DEPRECATED_VERSIONS.has(version)) {
        res.setHeader('Deprecation', 'true');
        res.setHeader('Sunset', SUNSET_DATE);
        res.setHeader(
          'Link',
          `</api/${CURRENT_VERSION}>; rel="successor-version"`,
        );
      }
    }

    next();
  }
}
