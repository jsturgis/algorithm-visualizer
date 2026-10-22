export function hasPairWithSum(nums: number[], target: number): boolean {
    let left = 0, right = nums.length - 1; // @line init
    while (left < right) { // @line loop
        const sum = nums[left] + nums[right]; // @line sum
        if (sum === target) return true; // @line found
        if (sum < target) left++; // @line go-right
        else right--; // @line go-left
    }
    return false; // @line return
}
