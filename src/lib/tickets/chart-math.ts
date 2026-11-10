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
