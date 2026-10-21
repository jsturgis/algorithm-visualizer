// Bug: Math.round instead of truncating, so 2.75 becomes 3 instead of 2.
export function getAverages(nums: number[], k: number): number[] {
  const n = nums.length, size = 2 * k + 1;
  const avgs: number[] = new Array(n).fill(-1);
  if (size > n) return avgs;
  const prefix: number[] = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + nums[i];
  for (let i = k; i < n - k; i++) avgs[i] = Math.round((prefix[i + k + 1] - prefix[i - k]) / size);
  return avgs;
}
