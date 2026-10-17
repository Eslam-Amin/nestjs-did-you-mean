import { DynamicModule, Module, Provider } from '@nestjs/common';
import { APP_FILTER, DiscoveryModule } from '@nestjs/core';
import { DID_YOU_MEAN_OPTIONS } from './constants';
import { DidYouMeanFilter } from './did-you-mean.filter';
import { RouteDiscoveryService } from './discovery/discovery.service';
import type {
  DidYouMeanModuleAsyncOptions,
  DidYouMeanModuleOptions,
  DidYouMeanOptionsFactory,
} from './types';

@Module({})
export class DidYouMeanModule {
  /**
   * Registers the DidYouMeanModule synchronously.
   */
  static forRoot(options: DidYouMeanModuleOptions = {}): DynamicModule {
    const isGlobal = options.isGlobalFilter !== false;

    const providers: Provider[] = [
      {
        provide: DID_YOU_MEAN_OPTIONS,
        useValue: options,
      },
      RouteDiscoveryService,
      DidYouMeanFilter,
    ];

    if (isGlobal) {
      providers.push({
        provide: APP_FILTER,
        useClass: DidYouMeanFilter,
      });
    }

    return {
      module: DidYouMeanModule,
      imports: [DiscoveryModule],
      providers,
      exports: [RouteDiscoveryService, DidYouMeanFilter, DID_YOU_MEAN_OPTIONS],
    };
  }

  /**
   * Registers the DidYouMeanModule asynchronously.
   */
  static forRootAsync(asyncOptions: DidYouMeanModuleAsyncOptions): DynamicModule {
    const asyncProviders = this.createAsyncProviders(asyncOptions);

    const providers: Provider[] = [
      ...asyncProviders,
      RouteDiscoveryService,
      DidYouMeanFilter,
      {
        provide: APP_FILTER,
        useClass: DidYouMeanFilter,
      },
    ];

    return {
      module: DidYouMeanModule,
      imports: [DiscoveryModule, ...(asyncOptions.imports || [])],
      providers,
      exports: [RouteDiscoveryService, DidYouMeanFilter, DID_YOU_MEAN_OPTIONS],
    };
  }

  private static createAsyncProviders(options: DidYouMeanModuleAsyncOptions): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: DID_YOU_MEAN_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ];
    }

    if (options.useClass) {
      return [
        {
          provide: DID_YOU_MEAN_OPTIONS,
          useFactory: async (optionsFactory: DidYouMeanOptionsFactory) =>
            await optionsFactory.createDidYouMeanOptions(),
          inject: [options.useClass],
        },
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
      ];
    }

    if (options.useExisting) {
      return [
        {
          provide: DID_YOU_MEAN_OPTIONS,
          useFactory: async (optionsFactory: DidYouMeanOptionsFactory) =>
            await optionsFactory.createDidYouMeanOptions(),
          inject: [options.useExisting],
        },
      ];
    }

    return [
      {
        provide: DID_YOU_MEAN_OPTIONS,
        useValue: {},
      },
    ];
  }
}
