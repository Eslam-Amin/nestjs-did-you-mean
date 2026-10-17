import { Controller, Delete, Get, Post, Put, Version } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { RouteDiscoveryService } from '../src/discovery/discovery.service';
import { parseSwaggerDoc } from '../src/discovery/swagger.parser';
import { DID_YOU_MEAN_OPTIONS } from '../src/constants';

@Controller('users')
class UsersController {
  @Get()
  findAll() {
    return [];
  }

  @Get(':id')
  findOne() {
    return {};
  }

  @Post()
  create() {
    return {};
  }

  @Put(':id')
  update() {
    return {};
  }

  @Delete(':id')
  remove() {
    return {};
  }
}

@Controller({ path: 'items', version: '1' })
class VersionedItemsController {
  @Get()
  getItems() {
    return [];
  }

  @Version('2')
  @Get('v2-only')
  getV2Items() {
    return [];
  }
}

@Controller(['cats', 'felines'])
class MultiPathController {
  @Get('sound')
  getSound() {
    return 'meow';
  }
}

describe('Discovery Subsystem', () => {
  describe('Swagger Parser', () => {
    it('extracts routes, methods, summaries, and operation IDs from OpenAPI 3 spec', () => {
      const mockSwaggerDoc = {
        openapi: '3.0.0',
        paths: {
          '/api/v1/auth/login': {
            post: {
              summary: 'User login',
              operationId: 'authLogin',
            },
          },
          '/api/v1/users/{userId}': {
            get: {
              summary: 'Get user profile',
              operationId: 'getUserProfile',
            },
            delete: {
              description: 'Delete user profile',
            },
          },
        },
      };

      const routes = parseSwaggerDoc(mockSwaggerDoc);

      expect(routes).toHaveLength(3);

      const loginRoute = routes.find((r) => r.path === '/api/v1/auth/login');
      expect(loginRoute).toBeDefined();
      expect(loginRoute?.method).toBe('POST');
      expect(loginRoute?.summary).toBe('User login');
      expect(loginRoute?.operationId).toBe('authLogin');

      const getUserRoute = routes.find((r) => r.method === 'GET' && r.path === '/api/v1/users/:userId');
      expect(getUserRoute).toBeDefined();
      expect(getUserRoute?.summary).toBe('Get user profile');

      const deleteUserRoute = routes.find((r) => r.method === 'DELETE' && r.path === '/api/v1/users/:userId');
      expect(deleteUserRoute).toBeDefined();
      expect(deleteUserRoute?.summary).toBe('Delete user profile');
    });

    it('returns empty array when swaggerDoc is invalid or missing', () => {
      expect(parseSwaggerDoc(null)).toEqual([]);
      expect(parseSwaggerDoc({})).toEqual([]);
      expect(parseSwaggerDoc({ paths: null })).toEqual([]);
    });
  });

  describe('RouteDiscoveryService with NestJS Controllers', () => {
    it('harvests routes from registered controllers and caches in memory', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [DiscoveryModule],
        controllers: [UsersController, VersionedItemsController, MultiPathController],
        providers: [
          RouteDiscoveryService,
          {
            provide: DID_YOU_MEAN_OPTIONS,
            useValue: {
              globalPrefix: 'api',
            },
          },
        ],
      }).compile();

      const discoveryService = moduleRef.get(RouteDiscoveryService);
      discoveryService.onModuleInit();

      const routes = discoveryService.getRoutes();
      expect(routes.length).toBeGreaterThan(0);

      // Verify UsersController endpoints with global prefix
      expect(routes.some((r) => r.method === 'GET' && r.path === '/api/users')).toBe(true);
      expect(routes.some((r) => r.method === 'GET' && r.path === '/api/users/:id')).toBe(true);
      expect(routes.some((r) => r.method === 'POST' && r.path === '/api/users')).toBe(true);
      expect(routes.some((r) => r.method === 'PUT' && r.path === '/api/users/:id')).toBe(true);
      expect(routes.some((r) => r.method === 'DELETE' && r.path === '/api/users/:id')).toBe(true);

      // Verify versioning
      expect(routes.some((r) => r.method === 'GET' && r.path === '/api/v1/items')).toBe(true);
      expect(routes.some((r) => r.method === 'GET' && r.path === '/api/v2/items/v2-only')).toBe(true);

      // Verify multi-path controllers
      expect(routes.some((r) => r.path === '/api/cats/sound')).toBe(true);
      expect(routes.some((r) => r.path === '/api/felines/sound')).toBe(true);
    });

    it('prioritizes Swagger document when provided in options', async () => {
      const mockSwaggerDoc = {
        openapi: '3.0.0',
        paths: {
          '/swagger/only/endpoint': {
            get: { summary: 'Swagger endpoint' },
          },
        },
      };

      const moduleRef = await Test.createTestingModule({
        controllers: [UsersController],
        providers: [
          RouteDiscoveryService,
          {
            provide: DID_YOU_MEAN_OPTIONS,
            useValue: {
              swaggerDoc: mockSwaggerDoc,
            },
          },
        ],
      }).compile();

      const discoveryService = moduleRef.get(RouteDiscoveryService);
      discoveryService.onModuleInit();

      const routes = discoveryService.getRoutes();
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/swagger/only/endpoint');
    });

    it('filters out routes matching excludePaths patterns', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [DiscoveryModule],
        controllers: [UsersController],
        providers: [
          RouteDiscoveryService,
          {
            provide: DID_YOU_MEAN_OPTIONS,
            useValue: {
              excludePaths: ['/api/custom', /\/users\/.+/],
            },
          },
        ],
      }).compile();

      const discoveryService = moduleRef.get(RouteDiscoveryService);
      discoveryService.onModuleInit();

      const routes = discoveryService.getRoutes();
      expect(routes.some((r) => r.path === '/users/:id')).toBe(false);
      expect(routes.some((r) => r.path === '/users')).toBe(true);
    });

    it('allows updating Swagger doc dynamically via setSwaggerDoc', async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          RouteDiscoveryService,
          {
            provide: DID_YOU_MEAN_OPTIONS,
            useValue: {},
          },
        ],
      }).compile();

      const discoveryService = moduleRef.get(RouteDiscoveryService);
      discoveryService.onModuleInit();

      expect(discoveryService.getRoutes()).toEqual([]);

      discoveryService.setSwaggerDoc({
        paths: {
          '/dynamic/route': {
            get: { summary: 'Dynamic' },
          },
        },
      });

      expect(discoveryService.getRoutes()).toHaveLength(1);
      expect(discoveryService.getRoutes()[0].path).toBe('/dynamic/route');
    });

    it('falls back to prototype inspection when metadataScanner fails', async () => {
      const mockMetadataScanner = {
        getAllMethodNames: vi.fn().mockImplementation(() => {
          throw new Error('Scanner error');
        }),
      };

      const moduleRef = await Test.createTestingModule({
        imports: [DiscoveryModule],
        controllers: [UsersController],
        providers: [
          RouteDiscoveryService,
          {
            provide: DID_YOU_MEAN_OPTIONS,
            useValue: {
              excludePaths: ['/users/:id'],
            },
          },
        ],
      })
        .overrideProvider('MetadataScanner')
        .useValue(mockMetadataScanner)
        .compile();

      const discoveryService = moduleRef.get(RouteDiscoveryService);
      discoveryService.onModuleInit();

      const routes = discoveryService.getRoutes();
      expect(routes.length).toBeGreaterThan(0);
      expect(routes.some((r) => r.path === '/users')).toBe(true);
    });
  });
});
