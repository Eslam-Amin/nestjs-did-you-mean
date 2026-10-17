import { Injectable, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { DID_YOU_MEAN_OPTIONS } from '../src/constants';
import { DidYouMeanFilter } from '../src/did-you-mean.filter';
import { DidYouMeanModule } from '../src/did-you-mean.module';
import { RouteDiscoveryService } from '../src/discovery/discovery.service';
import type { DidYouMeanModuleOptions, DidYouMeanOptionsFactory } from '../src/types';

@Injectable()
class ConfigService implements DidYouMeanOptionsFactory {
  createDidYouMeanOptions(): DidYouMeanModuleOptions {
    return {
      maxSuggestions: 5,
      threshold: 0.6,
    };
  }
}

@Module({
  providers: [ConfigService],
  exports: [ConfigService],
})
class ConfigModule {}

describe('DidYouMeanModule', () => {
  it('registers synchronously via forRoot with global filter enabled by default', async () => {
    const dynamicModule = DidYouMeanModule.forRoot({
      maxSuggestions: 2,
      threshold: 0.5,
    });

    expect(
      dynamicModule.providers?.some(
        (p: any) => p && p.provide === APP_FILTER && p.useClass === DidYouMeanFilter,
      ),
    ).toBe(true);

    const moduleRef = await Test.createTestingModule({
      imports: [dynamicModule],
    }).compile();

    const options = moduleRef.get(DID_YOU_MEAN_OPTIONS);
    expect(options).toEqual({ maxSuggestions: 2, threshold: 0.5 });

    const discovery = moduleRef.get(RouteDiscoveryService);
    expect(discovery).toBeDefined();

    const filter = moduleRef.get(DidYouMeanFilter);
    expect(filter).toBeDefined();
  });

  it('allows disabling automatic global filter via isGlobalFilter: false', async () => {
    const dynamicModule = DidYouMeanModule.forRoot({
      isGlobalFilter: false,
    });

    const hasAppFilter = dynamicModule.providers?.some(
      (p: any) => p && p.provide === APP_FILTER,
    );
    expect(hasAppFilter).toBe(false);
  });

  it('registers asynchronously via forRootAsync with useFactory', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        DidYouMeanModule.forRootAsync({
          useFactory: () => ({
            maxSuggestions: 4,
          }),
        }),
      ],
    }).compile();

    const options = moduleRef.get(DID_YOU_MEAN_OPTIONS);
    expect(options).toEqual({ maxSuggestions: 4 });
  });

  it('registers asynchronously via forRootAsync with useClass', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        DidYouMeanModule.forRootAsync({
          useClass: ConfigService,
        }),
      ],
    }).compile();

    const options = moduleRef.get(DID_YOU_MEAN_OPTIONS);
    expect(options).toEqual({ maxSuggestions: 5, threshold: 0.6 });
  });

  it('registers asynchronously via forRootAsync with useExisting', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule,
        DidYouMeanModule.forRootAsync({
          imports: [ConfigModule],
          useExisting: ConfigService,
        }),
      ],
    }).compile();

    const options = moduleRef.get(DID_YOU_MEAN_OPTIONS);
    expect(options).toEqual({ maxSuggestions: 5, threshold: 0.6 });
  });

  it('registers asynchronously via forRootAsync with empty options fallback', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DidYouMeanModule.forRootAsync({})],
    }).compile();

    const options = moduleRef.get(DID_YOU_MEAN_OPTIONS);
    expect(options).toEqual({});
  });
});
