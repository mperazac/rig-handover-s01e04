import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

let dir: string;
let app: ReturnType<typeof createApp>;

const line = (at: string, job: string, status: string, owner: string, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error === undefined ? {} : { error }) });

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  const write = (night: string, lines: string[]) =>
    writeFileSync(join(dir, `${night}.jsonl`), lines.length === 0 ? '' : lines.join('\n') + '\n');

  // Normal night: two jobs, one failing.
  write('2026-02-01', [
    line('2026-02-01T01:00:00+01:00', 'backup/notes', 'fail', 'lane-07', 'quota exceeded'),
    line('2026-02-01T02:00:00+01:00', 'sync/lane', 'ok', 'rook'),
  ]);
  // Empty night.
  write('2026-02-02', []);
  // One bad line among good ones.
  write('2026-02-03', [
    line('2026-02-03T01:00:00+01:00', 'sync/lane', 'ok', 'rook'),
    'this is not json',
    line('2026-02-03T02:00:00+01:00', 'backup/notes', 'ok', 'lane-07'),
  ]);
  // Three jobs written out of alphabetical order.
  write('2026-02-04', [
    line('2026-02-04T01:00:00+01:00', 'z/zulu', 'ok', 'rook'),
    line('2026-02-04T02:00:00+01:00', 'a/alpha', 'ok', 'rook'),
    line('2026-02-04T03:00:00+01:00', 'm/middle', 'ok', 'rook'),
  ]);

  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('GET /digest/:night (page)', () => {
  it('200 for a normal night, with the jobs and the kept offset', async () => {
    const res = await app.request('/digest/2026-02-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest · 2026-02-01');
    expect(html).toContain('backup/notes');
    expect(html).toContain('quota exceeded');
    expect(html).toContain('2026-02-01T02:00:00+01:00');
  });

  it('404 for a night with no file', async () => {
    const res = await app.request('/digest/2026-02-09');
    expect(res.status).toBe(404);
  });

  it('404 for a malformed night name', async () => {
    const res = await app.request('/digest/not-a-night');
    expect(res.status).toBe(404);
  });

  it('says "nothing ran" for the empty night', async () => {
    const res = await app.request('/digest/2026-02-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('mentions the skipped line and still shows the good rows', async () => {
    const res = await app.request('/digest/2026-02-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('1 unreadable line(s) skipped');
    expect(html).toContain('sync/lane');
    expect(html).toContain('backup/notes');
  });
});

describe('GET /api/digest/:night (JSON)', () => {
  it('200 for a normal night, with the rows', async () => {
    const res = await app.request('/api/digest/2026-02-01');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.night).toBe('2026-02-01');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => [r.job, r.lastStatus, r.lastError])).toEqual([
      ['backup/notes', 'fail', 'quota exceeded'],
      ['sync/lane', 'ok', null],
    ]);
  });

  it('404 for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-02-09');
    expect(res.status).toBe(404);
  });

  it('404 for a malformed night name', async () => {
    const res = await app.request('/api/digest/not-a-night');
    expect(res.status).toBe(404);
  });

  it('has rows [] for the empty night', async () => {
    const res = await app.request('/api/digest/2026-02-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-02-02', rows: [], badLines: 0 });
  });

  it('has badLines 1 and still the good rows for a night with a bad line', async () => {
    const res = await app.request('/api/digest/2026-02-03');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['backup/notes', 'sync/lane']);
  });
});

describe('page and JSON agree (ADR 0001)', () => {
  it('list the same jobs in the same order', async () => {
    const json = (await (await app.request('/api/digest/2026-02-04')).json()) as Night;
    const html = await (await app.request('/digest/2026-02-04')).text();

    const fromJson = json.rows.map((r) => r.job);
    expect(fromJson).toEqual(['a/alpha', 'm/middle', 'z/zulu']);

    const fromPage = [...html.matchAll(/<td>([a-z]\/[a-z]+)<\/td>/g)].map((m) => m[1]);
    expect(fromPage).toEqual(fromJson);
  });
});
