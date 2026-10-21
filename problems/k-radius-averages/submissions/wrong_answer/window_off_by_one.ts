// Bug: prefix[i + k] stops one short, so the window's last number is left out.
export function getAverages(nums: number[], k: number): number[] {
  const n = nums.length, size = 2 * k + 1;
  const avgs: number[] = new Array(n).fill(-1);
  if (size > n) return avgs;
  const prefix: number[] = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + nums[i];
  for (let i = k; i < n - k; i++) avgs[i] = Math.floor((prefix[i + k] - prefix[i - k]) / size);
  return avgs;
}
