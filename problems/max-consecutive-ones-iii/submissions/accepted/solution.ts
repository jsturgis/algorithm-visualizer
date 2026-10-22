export function longestOnes(nums: number[], k: number): number {
    let left = 0, zeros = 0, best = 0; // @line init
    for (let right = 0; right < nums.length; right++) { // @line expand
        if (nums[right] === 0) zeros++; // @line add
        while (zeros > k) { // @line too-many
            if (nums[left] === 0) zeros--; // @line shrink
            left++; // @line shrink
        }
        best = Math.max(best, right - left + 1); // @line best
    }
    return best; // @line return
}
