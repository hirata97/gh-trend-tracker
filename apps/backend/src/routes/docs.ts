import { Hono } from 'hono';
import { swaggerUI } from '@hono/swagger-ui';
import type { AppEnv } from '../types/app';

const docs = new Hono<AppEnv>();

// Swagger UI（OpenAPI仕様は /openapi.yaml として静的アセットで配信）
docs.get('/', swaggerUI({ url: '/openapi.yaml' }));

export default docs;
