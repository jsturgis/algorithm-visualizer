export function getAverages(nums: number[], k: number): number[] {
    const n = nums.length, size = 2 * k + 1; // @line sizes
    const avgs: number[] = new Array(n).fill(-1); // @line fill
    if (size > n) return avgs; // @line too-big
    const prefix: number[] = new Array(n + 1).fill(0); // @line prefix
    for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + nums[i]; // @line build
    for (let i = k; i < n - k; i++) { // @line slide
        const sum = prefix[i + k + 1] - prefix[i - k]; // @line window
        avgs[i] = Math.floor(sum / size); // @line average
    }
    return avgs; // @line return
}
