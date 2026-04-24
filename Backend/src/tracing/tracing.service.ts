import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { trace, context, SpanStatusCode, Tracer } from '@opentelemetry/api';

@Injectable()
export class TracingService implements OnModuleInit {
  private readonly logger = new Logger(TracingService.name);
  private sdk: NodeSDK;
  private tracer: Tracer;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const endpoint = this.config.get<string>('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4318/v1/traces');
    const serviceName = this.config.get<string>('OTEL_SERVICE_NAME', 'stellara-backend');

    this.sdk = new NodeSDK({
      resource: new Resource({
        [SEMRESATTRS_SERVICE_NAME]: serviceName,
        [SEMRESATTRS_SERVICE_VERSION]: '1.0.0',
      }),
      spanProcessor: new SimpleSpanProcessor(new OTLPTraceExporter({ url: endpoint })),
    });

    try {
      this.sdk.start();
      this.logger.log(`Tracing initialized → ${endpoint}`);
    } catch (err) {
      this.logger.warn(`Tracing init failed: ${(err as Error).message}`);
    }

    this.tracer = trace.getTracer(serviceName);
  }

  startSpan(name: string, attributes?: Record<string, string | number | boolean>) {
    const span = this.tracer.startSpan(name, { attributes });
    return span;
  }

  async trace<T>(name: string, fn: () => Promise<T>, attributes?: Record<string, string | number | boolean>): Promise<T> {
    const span = this.startSpan(name, attributes);
    try {
      const result = await context.with(trace.setSpan(context.active(), span), fn);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  }

  getTracer(): Tracer {
    return this.tracer;
  }
}
