import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RigConfig } from './config.js';
import { parseLine, readNight } from './digest/read-night.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightSummary[];
};

export type Counts = { ok: number; retry: number; fail: number };
export type NightSummary = { night: string; counts: Counts | null };


// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

// Counts run lines by status across the whole log (each valid line once), not per-job last status.
// readNight only gives per-job rows, so the lines are counted here with the same line parser.
function countRunLines(runsDir: string, night: string): Counts | null {
  if (readNight(runsDir, night) === null) return null;
  const counts: Counts = { ok: 0, retry: 0, fail: 0 };
  for (const text of readFileSync(join(runsDir, `${night}.jsonl`), 'utf8').split('\n')) {
    const line = parseLine(text);
    if (line !== null) counts[line.status]++;
  }
  return counts;
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => ({ night, counts: countRunLines(config.runsDir, night) })),
  };
}
