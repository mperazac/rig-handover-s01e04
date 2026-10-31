import type { Night } from '../digest/types.js';

const dash = '—';

export function DigestPage({ night }: { night: Night }) {
  return (
    <>
      <h1>digest · {night.night}</h1>
      {night.badLines > 0 && <p class="warn">⚠ {night.badLines} unreadable line(s) skipped</p>}
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((r) => (
              <tr>
                <td>{r.job}</td>
                <td>{r.owner ?? dash}</td>
                <td>{r.runs}</td>
                <td class={r.retries >= 3 ? 'warn' : undefined}>{r.retries >= 3 ? `⚠ ${r.retries}` : r.retries}</td>
                <td class={r.lastStatus === 'fail' ? 'warn' : undefined}>
                  {r.lastStatus === 'fail' ? `⚠ ${r.lastStatus}` : r.lastStatus}
                </td>
                <td>{r.lastError ?? dash}</td>
                <td>{r.firstAt}</td>
                <td>{r.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
