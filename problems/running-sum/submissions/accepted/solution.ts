export function runningSum(nums: number[]): number[] {
    const prefix: number[] = [nums[0]]; // @line init
    for (let i = 1; i < nums.length; i++) { // @line loop
        prefix.push(prefix[i - 1] + nums[i]); // @line add
    }
    return prefix; // @line return
}
