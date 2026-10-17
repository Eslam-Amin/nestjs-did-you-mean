import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { DID_YOU_MEAN_OPTIONS } from './constants';
import { RouteDiscoveryService } from './discovery/discovery.service';
import { resolveFormattedResponse } from './formatters';
import { cleanPath } from './matcher/normalizer';
import { rankSuggestions } from './matcher/ranker';
import type { DidYouMeanModuleOptions, FormatContext } from './types';

@Injectable()
@Catch(NotFoundException)
export class DidYouMeanFilter implements ExceptionFilter<NotFoundException> {
  private readonly options: DidYouMeanModuleOptions;
  private readonly httpAdapterHost?: HttpAdapterHost;
  private readonly discoveryService?: RouteDiscoveryService;

  constructor(
    @Optional()
    httpAdapterHost?: HttpAdapterHost,
    @Optional()
    discoveryService?: RouteDiscoveryService,
    @Optional()
    @Inject(DID_YOU_MEAN_OPTIONS)
    options?: DidYouMeanModuleOptions,
  ) {
    const rawArgs = [httpAdapterHost, discoveryService, options].filter(
      (a): a is object => Boolean(a && typeof a === 'object'),
    );

    const foundHost = rawArgs.find((a) => 'httpAdapter' in a) as
      | HttpAdapterHost
      | undefined;
    const foundDiscovery = rawArgs.find(
      (a) => 'getRoutes' in a || a instanceof RouteDiscoveryService,
    ) as RouteDiscoveryService | undefined;
    const foundOptions = rawArgs.find(
      (a) =>
        !('httpAdapter' in a) &&
        !('getRoutes' in a) &&
        !(a instanceof RouteDiscoveryService),
    ) as DidYouMeanModuleOptions | undefined;

    this.httpAdapterHost = foundHost;
    this.discoveryService = foundDiscovery;
    this.options = foundOptions ?? {};
  }

  /**
   * Transparently responds with standard 404 response without suggestions.
   */
  private passThrough(exception: NotFoundException, res: any, httpAdapter: any): void {
    const status = exception.getStatus();
    const response = exception.getResponse();

    if (httpAdapter) {
      httpAdapter.reply(res, response, status);
    } else if (typeof res.status === 'function') {
      if (typeof res.json === 'function') {
        res.status(status).json(response);
      } else if (typeof res.send === 'function') {
        res.status(status).send(response);
      }
    }
  }

  /**
   * Determines whether the DidYouMean filter is enabled for the current request.
   */
  private isEnabled(req: any): boolean {
    if (typeof this.options?.enabled === 'boolean') {
      return this.options.enabled;
    }

    if (typeof this.options?.enabled === 'function') {
      try {
        return Boolean(this.options.enabled(req));
      } catch {
        return false;
      }
    }

    if (Array.isArray(this.options?.enabledEnvironments)) {
      const currentEnv = process.env.NODE_ENV || 'development';
      return this.options.enabledEnvironments.includes(currentEnv);
    }

    return process.env.NODE_ENV !== 'production';
  }

  catch(exception: NotFoundException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest();
    const res = ctx.getResponse();

    const httpAdapter = this.httpAdapterHost?.httpAdapter;

    // Check if headers have already been sent
    if (httpAdapter?.isHeadersSent && httpAdapter.isHeadersSent(res)) {
      return;
    }

    // Production safety check: transparent zero-overhead pass-through when disabled
    if (!this.isEnabled(req)) {
      this.passThrough(exception, res, httpAdapter);
      return;
    }

    // Platform-agnostic request extraction
    const url = httpAdapter
      ? httpAdapter.getRequestUrl(req)
      : (req.originalUrl || req.url || '/');
    const rawMethod = httpAdapter
      ? httpAdapter.getRequestMethod(req)
      : (req.method || 'GET');
    const method = String(rawMethod || 'GET').toUpperCase();
    const path = cleanPath(url);

    // Fetch candidate routes
    const candidates = this.discoveryService ? this.discoveryService.getRoutes() : [];

    // Calculate suggestions
    const suggestions = rankSuggestions({ method, path }, candidates, this.options);

    // Extract original exception message
    const exceptionResponse = exception.getResponse();
    let originalMessage = `Cannot ${method} ${path}`;

    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
    ) {
      const msg = (exceptionResponse as any).message;
      if (typeof msg === 'string') {
        originalMessage = msg;
      }
    } else if (typeof exceptionResponse === 'string') {
      originalMessage = exceptionResponse;
    }

    const statusCode = exception.getStatus();

    const context: FormatContext = {
      req,
      res,
      method,
      url,
      path,
      suggestions,
      statusCode,
      error: 'Not Found',
      message: originalMessage,
    };

    const { contentType, body } = resolveFormattedResponse(context, this.options.format);

    if (httpAdapter) {
      httpAdapter.setHeader(res, 'Content-Type', contentType);
      // Fastify reply compatibility
      if (typeof res.type === 'function') {
        res.type(contentType);
      }
      httpAdapter.reply(res, body, statusCode);
    } else {
      // Direct Express/Fastify fallback
      if (typeof res.setHeader === 'function') {
        res.setHeader('Content-Type', contentType);
      }
      if (typeof res.type === 'function') {
        res.type(contentType);
      }
      if (typeof res.status === 'function' && typeof res.send === 'function') {
        res.status(statusCode).send(body);
      }
    }
  }
}
