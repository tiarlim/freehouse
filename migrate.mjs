import fs from 'node:fs/promises';
import pg from 'pg';
import F from './core.js';
const connectionUrl = new URL(process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL);
connectionUrl.searchParams.set('sslmode', 'verify-full');
const pool = new pg.Pool({ connectionString: connectionUrl.href, max: 1 });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(await fs.readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
  const seed = F.seed();
  for (const place of seed.places) await client.query('INSERT INTO fh_places(id,data) VALUES($1,$2) ON CONFLICT DO NOTHING', [place.id, place]);
  for (const e of seed.experiences) await client.query('INSERT INTO fh_experiences(id,place_id,data) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [e.id,e.placeId,e]);
  for (const p of seed.points) await client.query('INSERT INTO fh_points(id,place_id,data) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [p.id,p.placeId,p]);
  await client.query('COMMIT');
  console.log('Freehouse development schema and sample places ready.');
} catch (error) {
  await client.query('ROLLBACK');
  console.error('Migration failed:', error.code || error.name);
  process.exitCode = 1;
} finally { client.release(); await pool.end(); }
