export function numSubarrayProductLessThanK(nums: number[], k: number): number {
    if (k <= 1) return 0; // @line guard
    let left = 0, product = 1, count = 0; // @line init
    for (let right = 0; right < nums.length; right++) { // @line expand
        product *= nums[right]; // @line multiply
        while (product >= k) { // @line too-big
            product /= nums[left]; // @line shrink
            left++;
        }
        count += right - left + 1; // @line count
    }
    return count; // @line return
}
