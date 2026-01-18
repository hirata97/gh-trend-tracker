import { Hono } from 'hono';
import { cors } from 'hono/cors';
import health from './routes/health';
import trends from './routes/trends';
import repositories from './routes/repositories';
import languages from './routes/languages';
import { dbMiddleware } from './middleware/database';
import type { AppEnv } from './types/app';

const app = new Hono<AppEnv>();

// CORS設定（開発用、本番では制限すべき）
app.use('/*', cors());

// データベースミドルウェア
app.use('/*', dbMiddleware);

// ルート登録
app.route('/health', health);
app.route('/api/trends', trends);
app.route('/api/repos', repositories);
app.route('/api/languages', languages);

export default app;
