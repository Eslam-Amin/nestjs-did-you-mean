import { Controller, Get, Param, Post } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DidYouMeanModule } from '../src/did-you-mean.module';

@Controller('api/v1/products')
class ProductsController {
  @Get()
  getProducts() {
    return [{ id: '1', name: 'Widget' }];
  }

  @Get(':id')
  getProduct(@Param('id') id: string) {
    return { id, name: 'Widget' };
  }

  @Post()
  createProduct() {
    return { created: true };
  }
}

describe('E2E: NestJS with Fastify Platform', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'development';

    const moduleRef = await Test.createTestingModule({
      imports: [
        DidYouMeanModule.forRoot({
          threshold: 0.4,
          maxSuggestions: 3,
        }),
      ],
      controllers: [ProductsController],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('suggests closest route on Fastify 404 (GET /api/v1/prod -> GET /api/v1/products)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/prod',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);

    expect(body.statusCode).toBe(404);
    expect(body.error).toBe('Not Found');
    expect(Array.isArray(body.suggestions)).toBe(true);
    expect(body.suggestions.length).toBeGreaterThan(0);

    const first = body.suggestions[0];
    expect(first.method).toBe('GET');
    expect(first.path).toBe('/api/v1/products');
    expect(first.score).toBeGreaterThan(0.7);
    expect(first.isMethodMismatch).toBe(false);
  });

  it('detects method mismatch on Fastify (DELETE /api/v1/products)', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/products',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);

    expect(body.suggestions.length).toBeGreaterThan(0);
    const top = body.suggestions[0];
    expect(top.path).toBe('/api/v1/products');
    expect(top.score).toBe(1.0);
    expect(top.isMethodMismatch).toBe(true);
  });

  it('renders interactive HTML on Fastify when Accept header is text/html', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/prod',
      headers: {
        accept: 'text/html',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('<!DOCTYPE html>');
    expect(response.body).toContain('Did you mean?');
    expect(response.body).toContain('/api/v1/products');
  });

  it('passes through transparently on Fastify when disabled', async () => {
    const prodModuleRef = await Test.createTestingModule({
      imports: [
        DidYouMeanModule.forRoot({
          enabled: false,
        }),
      ],
      controllers: [ProductsController],
    }).compile();

    const prodApp = prodModuleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await prodApp.init();
    await prodApp.getHttpAdapter().getInstance().ready();

    const response = await prodApp.inject({
      method: 'GET',
      url: '/api/v1/prod',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.suggestions).toBeUndefined();

    await prodApp.close();
  });
});
