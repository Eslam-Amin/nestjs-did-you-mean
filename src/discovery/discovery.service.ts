import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { ApplicationConfig } from '@nestjs/core/application-config';
import { DID_YOU_MEAN_OPTIONS } from '../constants';
import { cleanPath, normalizeRoutePattern, splitSegments } from '../matcher/normalizer';
import type { DidYouMeanModuleOptions, RouteDefinition } from '../types';
import { parseSwaggerDoc } from './swagger.parser';

// NestJS internal metadata keys
const PATH_METADATA = 'path';
const METHOD_METADATA = 'method';
const VERSION_METADATA = '__version__';

const METHOD_NAME_MAP: Record<number | string, string> = {
  0: 'GET',
  1: 'POST',
  2: 'PUT',
  3: 'DELETE',
  4: 'PATCH',
  5: 'ALL',
  6: 'OPTIONS',
  7: 'HEAD',
  8: 'SEARCH',
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
  ALL: 'ALL',
  OPTIONS: 'OPTIONS',
  HEAD: 'HEAD',
  SEARCH: 'SEARCH',
};

@Injectable()
export class RouteDiscoveryService implements OnModuleInit, OnApplicationBootstrap {
  private cachedRoutes: RouteDefinition[] = [];

  constructor(
    @Optional() private readonly discoveryService?: DiscoveryService,
    @Optional() private readonly metadataScanner?: MetadataScanner,
    @Optional() private readonly reflector?: Reflector,
    @Optional() private readonly applicationConfig?: ApplicationConfig,
    @Optional()
    @Inject(DID_YOU_MEAN_OPTIONS)
    private readonly options: DidYouMeanModuleOptions = {},
  ) {}

  onModuleInit(): void {
    this.refreshRoutes();
  }

  onApplicationBootstrap(): void {
    // Re-harvest on bootstrap in case routes were registered or Swagger generated after module init
    this.refreshRoutes();
  }

  /**
   * Returns currently cached route definitions.
   */
  getRoutes(): RouteDefinition[] {
    return this.cachedRoutes;
  }

  /**
   * Dynamically sets or updates the Swagger OpenAPI document and refreshes routes.
   */
  setSwaggerDoc(swaggerDoc: any): void {
    this.options.swaggerDoc = swaggerDoc;
    this.refreshRoutes();
  }

  /**
   * Scans and rebuilds route cache from Swagger doc or controller discovery.
   */
  refreshRoutes(): RouteDefinition[] {
    // Priority 1: @nestjs/swagger OpenAPI document
    if (this.options?.swaggerDoc) {
      const swaggerRoutes = parseSwaggerDoc(this.options.swaggerDoc);
      if (swaggerRoutes.length > 0) {
        this.cachedRoutes = this.filterExcluded(swaggerRoutes);
        return this.cachedRoutes;
      }
    }

    // Priority 2: NestJS DiscoveryService & Reflector
    if (this.discoveryService && this.metadataScanner && this.reflector) {
      const discoveredRoutes = this.harvestFromControllers();
      this.cachedRoutes = this.filterExcluded(discoveredRoutes);
      return this.cachedRoutes;
    }

    return this.cachedRoutes;
  }

  /**
   * Harvests route definitions from NestJS controllers via DiscoveryService and Reflector.
   */
  private harvestFromControllers(): RouteDefinition[] {
    const controllers = this.discoveryService!.getControllers();
    const discovered: RouteDefinition[] = [];
    const globalPrefix = this.resolveGlobalPrefix();

    for (const wrapper of controllers) {
      const { instance, metatype } = wrapper;
      if (!instance || !metatype) continue;

      // Extract controller path prefixes
      const rawControllerPaths = this.reflector!.get<string | string[]>(PATH_METADATA, metatype);
      const controllerPaths: string[] = this.normalizePathsArray(rawControllerPaths);

      // Extract controller-level versioning
      const controllerVersion = this.reflector!.get<string | string[]>(
        VERSION_METADATA,
        metatype,
      );

      // Scan methods on instance prototype
      const prototype = Object.getPrototypeOf(instance);
      if (!prototype) continue;

      const methodNames = this.getPrototypeMethodNames(prototype);

      for (const methodName of methodNames) {
        const methodHandler = instance[methodName];
        if (typeof methodHandler !== 'function') continue;

        const rawMethodPaths = this.reflector!.get<string | string[]>(
          PATH_METADATA,
          methodHandler,
        );
        const methodCode = this.reflector!.get<number | string>(
          METHOD_METADATA,
          methodHandler,
        );

        if (methodCode === undefined && rawMethodPaths === undefined) {
          // Not a route handler
          continue;
        }

        const httpMethod = this.resolveHttpMethod(methodCode);
        const methodPaths = this.normalizePathsArray(rawMethodPaths);

        // Method-level versioning overrides controller-level
        const methodVersion =
          this.reflector!.get<string | string[]>(VERSION_METADATA, methodHandler) ??
          controllerVersion;
        const versions = this.normalizeVersionsArray(methodVersion);

        // Build Cartesian product of [globalPrefix] x [versions] x [controllerPaths] x [methodPaths]
        for (const ctrlPath of controllerPaths) {
          for (const mPath of methodPaths) {
            for (const ver of versions) {
              const fullPath = this.combineRoutePath(globalPrefix, ver, ctrlPath, mPath);
              const cleaned = cleanPath(fullPath);
              const segments = splitSegments(cleaned);
              const normalizedPattern = normalizeRoutePattern(cleaned);

              discovered.push({
                method: httpMethod,
                path: cleaned,
                normalizedPattern,
                segments,
                controllerName: metatype.name,
                methodName,
              });
            }
          }
        }
      }
    }

    return discovered;
  }

  /**
   * Resolves the global prefix from options or ApplicationConfig.
   */
  private resolveGlobalPrefix(): string {
    if (this.options?.globalPrefix !== undefined) {
      return this.options.globalPrefix;
    }

    if (this.applicationConfig && typeof this.applicationConfig.getGlobalPrefix === 'function') {
      return this.applicationConfig.getGlobalPrefix() || '';
    }

    return '';
  }

  /**
   * Resolves HTTP method string from NestJS RequestMethod enum or string.
   */
  private resolveHttpMethod(methodCode: number | string | undefined): string {
    if (methodCode === undefined) return 'GET';
    return METHOD_NAME_MAP[methodCode] ?? String(methodCode).toUpperCase();
  }

  /**
   * Normalizes string or array of paths into a non-empty string array.
   */
  private normalizePathsArray(paths: string | string[] | undefined): string[] {
    if (!paths) return [''];
    if (Array.isArray(paths)) {
      return paths.length === 0 ? [''] : paths;
    }
    return [paths];
  }

  /**
   * Normalizes versions metadata into an array of version prefixes.
   */
  private normalizeVersionsArray(version: string | string[] | undefined): (string | null)[] {
    if (!version) return [null];
    if (Array.isArray(version)) {
      return version.length === 0 ? [null] : version;
    }
    return [version];
  }

  /**
   * Combines route segments into a final path.
   */
  private combineRoutePath(
    globalPrefix: string,
    version: string | null,
    controllerPath: string,
    methodPath: string,
  ): string {
    const parts: string[] = [];

    if (globalPrefix) {
      parts.push(globalPrefix);
    }

    if (version) {
      // NestJS URI versioning default prefix is 'v'
      const verPrefix = version.startsWith('v') ? version : `v${version}`;
      parts.push(verPrefix);
    }

    if (controllerPath) {
      parts.push(controllerPath);
    }

    if (methodPath) {
      parts.push(methodPath);
    }

    const joined = parts.join('/');
    return cleanPath(joined);
  }

  /**
   * Extracts method names from prototype across different NestJS / MetadataScanner versions.
   */
  private getPrototypeMethodNames(prototype: any): string[] {
    try {
      if (this.metadataScanner && typeof this.metadataScanner.getAllMethodNames === 'function') {
        const result = this.metadataScanner.getAllMethodNames(prototype);
        return Array.isArray(result) ? result : Array.from(result);
      }
    } catch {
      // Fallback to manual prototype inspection
    }

    return Object.getOwnPropertyNames(prototype).filter(
      (prop) => prop !== 'constructor' && typeof prototype[prop] === 'function',
    );
  }

  /**
   * Filters out routes matching user-defined exclusion patterns.
   */
  private filterExcluded(routes: RouteDefinition[]): RouteDefinition[] {
    const excludePatterns = this.options?.excludePaths;
    if (!excludePatterns || excludePatterns.length === 0) {
      return routes;
    }

    return routes.filter((route) => {
      for (const pattern of excludePatterns) {
        if (typeof pattern === 'string' && route.path === cleanPath(pattern)) {
          return false;
        }
        if (pattern instanceof RegExp && pattern.test(route.path)) {
          return false;
        }
      }
      return true;
    });
  }
}
