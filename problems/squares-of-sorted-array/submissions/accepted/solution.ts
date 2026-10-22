export function sortedSquares(nums: number[]): number[] {
    const result: number[] = new Array(nums.length); // @line init
    let left = 0, right = nums.length - 1;
    for (let k = nums.length - 1; k >= 0; k--) { // @line fill
        if (Math.abs(nums[left]) > Math.abs(nums[right])) { // @line compare
            result[k] = nums[left] * nums[left]; // @line take-left
            left++;
        } else {
            result[k] = nums[right] * nums[right]; // @line take-right
            right--;
        }
    }
    return result; // @line return
}
