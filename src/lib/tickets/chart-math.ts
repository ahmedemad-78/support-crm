/** Largest remainder allocation keeps a 100-cell chart at exactly 100 cells.
 * Zero-count categories never receive a cell. Counts remain the source of truth. */
export function shareCells(counts: number[]): number[] {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (!total) return counts.map(() => 0);
  const exact = counts.map((count) => count / total * 100);
  const cells = exact.map(Math.floor);
  let remaining = 100 - cells.reduce((sum, count) => sum + count, 0);
  exact.map((value, index) => ({ index, remainder: value - cells[index] }))
    .filter(({ index }) => counts[index] > 0)
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .forEach(({ index }) => { if (remaining > 0) { cells[index]++; remaining--; } });
  return cells;
}

export function shareLabel(count: number, total: number): string {
  if (!total || !count) return "0%";
  const percentage = count / total * 100;
  return percentage < 0.1 ? "<0.1%" : `${Number(percentage.toFixed(1))}%`;
}

export type MapRect = { index: number; x: number; y: number; width: number; height: number };
/** Binary partition: area is exactly proportional to count, including small groups. */
export function treemapRects(counts: number[]): MapRect[] {
  const result: MapRect[] = [];
  const items = counts.map((count, index) => ({ count, index })).filter((item) => item.count > 0);
  function split(group: typeof items, x: number, y: number, width: number, height: number) {
    if (!group.length) return;
    if (group.length === 1) { result.push({ index: group[0].index, x, y, width, height }); return; }
    const total = group.reduce((sum, item) => sum + item.count, 0);
    let partial = group[0].count;
    let cut = 1;
    while (cut < group.length - 1 && Math.abs(partial + group[cut].count - total / 2) < Math.abs(partial - total / 2)) partial += group[cut++].count;
    const fraction = partial / total;
    if (width >= height) {
      split(group.slice(0, cut), x, y, width * fraction, height);
      split(group.slice(cut), x + width * fraction, y, width * (1 - fraction), height);
    } else {
      split(group.slice(0, cut), x, y, width, height * fraction);
      split(group.slice(cut), x, y + height * fraction, width, height * (1 - fraction));
    }
  }
  split(items, 0, 0, 100, 60);
  return result;
}

export function cumulativeShares(counts: number[]): number[] {
  const total = counts.reduce((sum, count) => sum + count, 0);
  let running = 0;
  return counts.map((count) => { running += count; return total ? running / total * 100 : 0; });
}

/** Reported date is a calendar date. No inferred arrival time or hourly heatmap. */
export function weekdayCounts(days: string[]): number[] {
  const counts = Array.from({ length: 7 }, () => 0);
  for (const day of days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const stamp = new Date(`${day}T12:00:00Z`);
    if (!Number.isFinite(stamp.getTime()) || stamp.toISOString().slice(0, 10) !== day) continue;
    counts[stamp.getUTCDay()]++;
  }
  return counts;
}
