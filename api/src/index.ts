import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { drizzle } from 'drizzle-orm/d1';
import { desc, eq, and, sql } from 'drizzle-orm';
import { repositories, repoSnapshots } from './db/schema';

type Bindings = {
	DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS設定（開発用、本番では制限すべき）
app.use('/*', cors());

// ヘルスチェック
app.get('/health', (c) => {
	return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 言語別トレンドランキング
app.get('/api/trends/:language', async (c) => {
	const language = c.req.param('language');
	const db = drizzle(c.env.DB);

	try {
		// 最新のスナップショットと7日前のスナップショットを取得して増加数を計算
		const today = new Date().toISOString().split('T')[0];
		const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
			.toISOString()
			.split('T')[0];

		const trends = await db
			.select({
				repoId: repositories.repoId,
				name: repositories.name,
				fullName: repositories.fullName,
				owner: repositories.owner,
				language: repositories.language,
				description: repositories.description,
				htmlUrl: repositories.htmlUrl,
				currentStars: repoSnapshots.stars,
				snapshotDate: repoSnapshots.snapshotDate,
			})
			.from(repositories)
			.leftJoin(
				repoSnapshots,
				and(
					eq(repositories.repoId, repoSnapshots.repoId),
					eq(repoSnapshots.snapshotDate, today)
				)
			)
			.where(eq(repositories.language, language))
			.orderBy(desc(repoSnapshots.stars))
			.limit(100);

		return c.json({ language, trends });
	} catch (error) {
		console.error('Error fetching trends:', error);
		return c.json({ error: 'Failed to fetch trends' }, 500);
	}
});

// 全言語のトレンド（トップ100）
app.get('/api/trends', async (c) => {
	const db = drizzle(c.env.DB);

	try {
		const today = new Date().toISOString().split('T')[0];

		const trends = await db
			.select({
				repoId: repositories.repoId,
				name: repositories.name,
				fullName: repositories.fullName,
				owner: repositories.owner,
				language: repositories.language,
				description: repositories.description,
				htmlUrl: repositories.htmlUrl,
				currentStars: repoSnapshots.stars,
			})
			.from(repositories)
			.leftJoin(
				repoSnapshots,
				and(
					eq(repositories.repoId, repoSnapshots.repoId),
					eq(repoSnapshots.snapshotDate, today)
				)
			)
			.orderBy(desc(repoSnapshots.stars))
			.limit(100);

		return c.json({ trends });
	} catch (error) {
		console.error('Error fetching trends:', error);
		return c.json({ error: 'Failed to fetch trends' }, 500);
	}
});

// リポジトリの履歴データ
app.get('/api/repos/:repoId/history', async (c) => {
	const repoId = parseInt(c.req.param('repoId'));
	const db = drizzle(c.env.DB);

	try {
		const history = await db
			.select()
			.from(repoSnapshots)
			.where(eq(repoSnapshots.repoId, repoId))
			.orderBy(desc(repoSnapshots.snapshotDate))
			.limit(90); // 過去90日分

		if (history.length === 0) {
			return c.json({ error: 'Repository not found' }, 404);
		}

		return c.json({ history });
	} catch (error) {
		console.error('Error fetching history:', error);
		return c.json({ error: 'Failed to fetch history' }, 500);
	}
});

// 言語一覧
app.get('/api/languages', async (c) => {
	const db = drizzle(c.env.DB);

	try {
		const languages = await db
			.selectDistinct({ language: repositories.language })
			.from(repositories)
			.where(sql`${repositories.language} IS NOT NULL`)
			.orderBy(repositories.language);

		return c.json({ languages: languages.map(l => l.language) });
	} catch (error) {
		console.error('Error fetching languages:', error);
		return c.json({ error: 'Failed to fetch languages' }, 500);
	}
});

export default app;
