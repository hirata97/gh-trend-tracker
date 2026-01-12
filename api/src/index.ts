import { Hono } from 'hono';
import { cors } from 'hono/cors';
import health from './routes/health';
import trends from './routes/trends';
import repositories from './routes/repositories';
import languages from './routes/languages';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS設定（開発用、本番では制限すべき）
app.use('/*', cors());

// ルート登録
app.route('/health', health);
app.route('/api/trends', trends);
app.route('/api/repos', repositories);
app.route('/api/languages', languages);

export default app;
