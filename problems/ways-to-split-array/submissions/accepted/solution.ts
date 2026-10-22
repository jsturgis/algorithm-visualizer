export function waysToSplitArray(nums: number[]): number {
    const total = nums.reduce((a, b) => a + b, 0); // @line total
    let left = 0, ways = 0; // @line init
    for (let i = 0; i < nums.length - 1; i++) { // @line loop
        left += nums[i]; // @line add
        const right = total - left; // @line right
        if (left >= right) ways++; // @line compare
    }
    return ways; // @line return
}
