export function findMax(nums: number[]): number {
    let best = nums[0]; // @line init
    for (let i = 1; i < nums.length; i++) { // @line read
        if (nums[i] > best) best = nums[i]; // @line compare
    }
    return best; // @line return
}
