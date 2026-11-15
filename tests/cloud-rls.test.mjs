// Runs the real PostgreSQL schema in PGlite with a minimal auth.uid() test shim.
// PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node tests/cloud-rls.test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
`);
await db.exec(readFileSync('supabase/schema.sql', 'utf8'));
// Repeatable installation must not duplicate policies or erase data.
await db.exec(readFileSync('supabase/schema.sql', 'utf8'));
const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const snapshot = JSON.stringify({ version: 1, employees: [{ id: 'example', name: 'Test', periods: {} }] });
await db.exec('set role anon');
await assert.rejects(db.query('select * from public.salary_snapshots'), error => error.code === '42501');
await assert.rejects(db.query('select public.save_salary_snapshot($1::jsonb,0)', [snapshot]), error => error.code === '42501');
await db.exec('reset role; set role authenticated');
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userA]);
assert.equal((await db.query('select public.save_salary_snapshot($1::jsonb,0) as saved', [snapshot])).rows[0].saved.revision, 1);
await assert.rejects(db.query('select public.save_salary_snapshot($1::jsonb,0)', [snapshot]), error => error.code === '40001');
assert.equal((await db.query('select public.save_salary_snapshot($1::jsonb,1) as saved', [snapshot])).rows[0].saved.revision, 2);
await assert.rejects(db.query('select public.save_salary_snapshot($1::jsonb,1)', [snapshot]), error => error.code === '40001');
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userB]);
assert.equal((await db.query('select * from public.salary_snapshots')).rows.length, 0);
assert.equal((await db.query('update public.salary_snapshots set revision=100 where user_id=$1 returning user_id', [userA])).rows.length, 0);
await assert.rejects(db.query('insert into public.salary_snapshots(user_id,payload) values($1,$2::jsonb)', [userA,snapshot]), error => error.code === '42501');
assert.equal((await db.query('select public.save_salary_snapshot($1::jsonb,0) as saved', [snapshot])).rows[0].saved.revision, 1);
assert.equal((await db.query('select user_id from public.salary_snapshots')).rows[0].user_id, userB);
await assert.rejects(db.query('select public.save_salary_snapshot($1::jsonb,1)', [JSON.stringify({ version: 1 })]), error => error.code === '22023');
await db.close();
console.log('PostgreSQL schema: repeatable install, anonymous denial, account RLS isolation, revision conflicts and payload validation passed');
