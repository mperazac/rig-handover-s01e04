import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read-night.js';

function tempRuns(night: string, lines: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  writeFileSync(join(dir, `${night}.jsonl`), lines.join('\n') + '\n');
  return dir;
}

describe('readNight', () => {
  it('reads runs/2026-10-28.jsonl: 5 jobs, 1 bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    expect(night?.badLines).toBe(1);
    expect(night?.rows).toEqual([
      {
        job: 'digest/render',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-29T05:41:09+01:00',
        lastAt: '2026-10-29T05:41:09+01:00',
      },
      {
        job: 'fixtures/refresh',
        owner: 'rook',
        runs: 4,
        retries: 3,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-29T01:30:00+01:00',
        lastAt: '2026-10-29T01:37:00+01:00',
      },
      {
        job: 'lane/sync',
        owner: 'rook',
        runs: 8,
        retries: 1,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-28T23:00:06+01:00',
        lastAt: '2026-10-29T05:00:04+01:00',
      },
      {
        job: 'notes/backup',
        owner: 'lane-07',
        runs: 1,
        retries: 0,
        lastStatus: 'fail',
        lastError: 'quota exceeded',
        firstAt: '2026-10-29T04:00:01+01:00',
        lastAt: '2026-10-29T04:00:01+01:00',
      },
      {
        job: 'rig/rotate-logs',
        owner: 'lane-07',
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-28T23:00:02+01:00',
        lastAt: '2026-10-28T23:00:02+01:00',
      },
    ]);
  });

  it('keeps a row whose owner is null', () => {
    const dir = tempRuns('2026-01-01', [
      '{"at":"2026-01-01T01:00:00+01:00","job":"a/job","status":"ok","owner":null}',
    ]);
    const night = readNight(dir, '2026-01-01');
    expect(night?.rows).toHaveLength(1);
    expect(night?.rows[0]?.owner).toBeNull();
  });

  it('counts lines missing job, status or at as bad', () => {
    const dir = tempRuns('2026-01-02', [
      '{"job":"a/job","status":"ok","owner":"x"}',
      '{"at":"2026-01-02T01:00:00+01:00","status":"ok","owner":"x"}',
      '{"at":"2026-01-02T01:00:00+01:00","job":"a/job","owner":"x"}',
      'not json',
    ]);
    const night = readNight(dir, '2026-01-02');
    expect(night).toEqual({ night: '2026-01-02', rows: [], badLines: 4 });
  });

  it('compares times as dates when the file is out of order', () => {
    const dir = tempRuns('2026-01-03', [
      '{"at":"2026-01-03T03:00:00+01:00","job":"a/job","status":"fail","owner":"x","error":"boom"}',
      '{"at":"2026-01-03T01:00:00+01:00","job":"a/job","status":"retry","owner":"x","error":"early"}',
    ]);
    const row = readNight(dir, '2026-01-03')?.rows[0];
    expect(row?.firstAt).toBe('2026-01-03T01:00:00+01:00');
    expect(row?.lastAt).toBe('2026-01-03T03:00:00+01:00');
    expect(row?.lastStatus).toBe('fail');
    expect(row?.lastError).toBe('boom');
  });

  it('returns null when the night has no file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    expect(readNight(dir, '2026-01-04')).toBeNull();
  });
});
