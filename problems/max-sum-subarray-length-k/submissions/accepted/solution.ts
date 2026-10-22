export function maxSumOfLengthK(nums: number[], k: number): number {
    let sum = 0; // @line init
    for (let i = 0; i < k; i++) sum += nums[i]; // @line first
    let best = sum; // @line best-first
    for (let i = k; i < nums.length; i++) { // @line slide
        sum += nums[i] - nums[i - k]; // @line move
        best = Math.max(best, sum); // @line best
    }
    return best; // @line return
}
