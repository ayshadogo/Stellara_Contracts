import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { TracingService } from './tracing.service';
import { SpanStatusCode } from '@opentelemetry/api';

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  constructor(private readonly tracing: TracingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const span = this.tracing.startSpan(`HTTP ${req.method} ${req.route?.path ?? req.url}`, {
      'http.method': req.method,
      'http.url': req.url,
      'http.route': req.route?.path ?? req.url,
    });

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse();
        span.setAttribute('http.status_code', res.statusCode);
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
      }),
      catchError((err) => {
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        span.recordException(err);
        span.end();
        return throwError(() => err);
      }),
    );
  }
}
