import { ArgumentsHost, NotFoundException } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DidYouMeanFilter } from '../src/did-you-mean.filter';
import { RouteDiscoveryService } from '../src/discovery/discovery.service';

describe('DidYouMeanFilter Unit Tests', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  const createMockHttpAdapterHost = () => {
    const reply = vi.fn();
    const setHeader = vi.fn();
    const isHeadersSent = vi.fn().mockReturnValue(false);
    const getRequestUrl = vi.fn().mockReturnValue('/api/v1/usr');
    const getRequestMethod = vi.fn().mockReturnValue('GET');

    const adapter = {
      reply,
      setHeader,
      isHeadersSent,
      getRequestUrl,
      getRequestMethod,
    };

    return {
      httpAdapter: adapter,
    } as unknown as HttpAdapterHost;
  };

  const createMockHost = (req: any = {}, res: any = {}): ArgumentsHost => {
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ArgumentsHost;
  };

  it('supports DI instantiation', () => {
    const filter = new DidYouMeanFilter(
      { threshold: 0.5 },
      createMockHttpAdapterHost(),
      new RouteDiscoveryService(),
    );
    expect(filter).toBeDefined();
  });

  it('transparently passes through 404 in production environment without suggestions', () => {
    process.env.NODE_ENV = 'production';

    const adapterHost = createMockHttpAdapterHost();
    const discovery = new RouteDiscoveryService();
    const filter = new DidYouMeanFilter({}, adapterHost, discovery);

    const exception = new NotFoundException('Cannot GET /api/v1/usr');
    const host = createMockHost();

    filter.catch(exception, host);

    expect(adapterHost.httpAdapter.reply).toHaveBeenCalledWith(
      expect.anything(),
      exception.getResponse(),
      404,
    );
    expect(adapterHost.httpAdapter.setHeader).not.toHaveBeenCalled();
  });

  it('respects enabled: false option', () => {
    process.env.NODE_ENV = 'development';

    const adapterHost = createMockHttpAdapterHost();
    const filter = new DidYouMeanFilter({ enabled: false }, adapterHost);

    const exception = new NotFoundException('Cannot GET /api/v1/usr');
    const host = createMockHost();

    filter.catch(exception, host);

    expect(adapterHost.httpAdapter.reply).toHaveBeenCalledWith(
      expect.anything(),
      exception.getResponse(),
      404,
    );
  });

  it('supports enabled function predicate per request', () => {
    process.env.NODE_ENV = 'development';

    const adapterHost = createMockHttpAdapterHost();
    const discovery = new RouteDiscoveryService();
    // Register candidate route
    discovery.setSwaggerDoc({
      paths: {
        '/api/v1/users': { get: {} },
      },
    });

    const isEnabledMock = vi.fn((req) => req.allowSuggestions === true);
    const filter = new DidYouMeanFilter({ enabled: isEnabledMock }, adapterHost, discovery);

    const exception = new NotFoundException('Cannot GET /api/v1/usr');

    // Case 1: predicate returns false
    const hostDenied = createMockHost({ allowSuggestions: false });
    filter.catch(exception, hostDenied);
    expect(adapterHost.httpAdapter.reply).toHaveBeenCalledWith(
      expect.anything(),
      exception.getResponse(),
      404,
    );

    // Case 2: predicate returns true
    const hostAllowed = createMockHost({ allowSuggestions: true });
    filter.catch(exception, hostAllowed);
    expect(adapterHost.httpAdapter.setHeader).toHaveBeenCalledWith(
      expect.anything(),
      'Content-Type',
      'application/json; charset=utf-8',
    );
  });

  it('respects enabledEnvironments whitelist', () => {
    process.env.NODE_ENV = 'staging';

    const adapterHost = createMockHttpAdapterHost();
    const filterAllowed = new DidYouMeanFilter(
      { enabledEnvironments: ['development', 'staging'] },
      adapterHost,
    );

    const exception = new NotFoundException();
    const host = createMockHost();

    filterAllowed.catch(exception, host);
    expect(adapterHost.httpAdapter.setHeader).toHaveBeenCalled();

    const filterDenied = new DidYouMeanFilter(
      { enabledEnvironments: ['development'] },
      adapterHost,
    );
    filterDenied.catch(exception, host);
    expect(adapterHost.httpAdapter.reply).toHaveBeenCalledWith(
      expect.anything(),
      exception.getResponse(),
      404,
    );
  });

  it('does nothing if headers have already been sent', () => {
    const adapterHost = createMockHttpAdapterHost();
    (adapterHost.httpAdapter.isHeadersSent as any).mockReturnValue(true);

    const filter = new DidYouMeanFilter({}, adapterHost);
    const host = createMockHost();
    const exception = new NotFoundException();

    filter.catch(exception, host);

    expect(adapterHost.httpAdapter.reply).not.toHaveBeenCalled();
  });

  it('falls back to manual res methods when httpAdapterHost is missing', () => {
    process.env.NODE_ENV = 'development';

    const setHeader = vi.fn();
    const type = vi.fn();
    const status = vi.fn().mockReturnThis();
    const send = vi.fn();
    const res = { setHeader, type, status, send };
    const req = { url: '/api/v1/usr', method: 'GET' };

    const filter = new DidYouMeanFilter({});
    const host = createMockHost(req, res);
    const exception = new NotFoundException('Cannot GET /api/v1/usr');

    filter.catch(exception, host);

    expect(setHeader).toHaveBeenCalledWith('Content-Type', 'application/json; charset=utf-8');
    expect(type).toHaveBeenCalledWith('application/json; charset=utf-8');
    expect(status).toHaveBeenCalledWith(404);
    expect(send).toHaveBeenCalled();
  });

  it('safely handles predicate functions that throw', () => {
    const adapterHost = createMockHttpAdapterHost();
    const filter = new DidYouMeanFilter(
      {
        enabled: () => {
          throw new Error('Predicate failed');
        },
      },
      adapterHost,
    );

    const host = createMockHost();
    const exception = new NotFoundException();

    filter.catch(exception, host);
    expect(adapterHost.httpAdapter.reply).toHaveBeenCalledWith(
      expect.anything(),
      exception.getResponse(),
      404,
    );
  });

  it('handles fallback passThrough when httpAdapter is missing and res has json or send', () => {
    process.env.NODE_ENV = 'production';

    const json = vi.fn();
    const status1 = vi.fn();
    const res1: any = { json };
    res1.status = status1.mockReturnValue(res1);

    const filter = new DidYouMeanFilter({});
    filter.catch(new NotFoundException('Test'), createMockHost({}, res1));
    expect(status1).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalled();

    const send = vi.fn();
    const status2 = vi.fn();
    const res2: any = { send };
    res2.status = status2.mockReturnValue(res2);

    filter.catch(new NotFoundException('Test'), createMockHost({}, res2));
    expect(status2).toHaveBeenCalledWith(404);
    expect(send).toHaveBeenCalled();
  });

  it('extracts string exception response message correctly', () => {
    const adapterHost = createMockHttpAdapterHost();
    const filter = new DidYouMeanFilter({}, adapterHost);
    const host = createMockHost();
    const exception = new NotFoundException();
    vi.spyOn(exception, 'getResponse').mockReturnValue('Custom string not found error');

    filter.catch(exception, host);
    expect(adapterHost.httpAdapter.reply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        message: 'Custom string not found error',
      }),
      404,
    );
  });
});
