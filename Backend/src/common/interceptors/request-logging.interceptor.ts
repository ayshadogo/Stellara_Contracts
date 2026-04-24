import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AppLogger } from '../logger/app.logger';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, url, headers, body } = request;
    const startTime = Date.now();

    // Mask sensitive data
    const maskedBody = this.maskSensitiveData(body);
    const maskedHeaders = this.maskSensitiveData(headers);

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        this.logger.logRequest({
          type: 'request_success',
          method,
          url,
          statusCode,
          duration: `${duration}ms`,
          headers: maskedHeaders,
          body: maskedBody,
        });
      }),
      catchError((err) => {
        const duration = Date.now() - startTime;
        const statusCode = err.status || 500;

        this.logger.logRequest({
          type: 'request_error',
          method,
          url,
          statusCode,
          duration: `${duration}ms`,
          error: err.message,
          stack: err.stack,
        });
        return throwError(() => err);
      }),
    );
  }

  private maskSensitiveData(data: any): any {
    if (!data || typeof data !== 'object') return data;
    
    const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'apiKey', 'privateKey', 'mnemonic'];
    const masked = Array.isArray(data) ? [...data] : { ...data };

    for (const key of Object.keys(masked)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        masked[key] = '***MASKED***';
      } else if (typeof masked[key] === 'object') {
        masked[key] = this.maskSensitiveData(masked[key]);
      }
    }
    return masked;
  }
}
