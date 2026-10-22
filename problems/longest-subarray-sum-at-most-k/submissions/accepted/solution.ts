export function longestSubarray(nums: number[], k: number): number {
    let left = 0, sum = 0, best = 0; // @line init
    for (let right = 0; right < nums.length; right++) { // @line expand
        sum += nums[right]; // @line add
        while (sum > k) { // @line too-big
            sum -= nums[left]; // @line shrink
            left++; // @line shrink
        }
        best = Math.max(best, right - left + 1); // @line best
    }
    return best; // @line return
}
