export function search(nums: number[], target: number): number {
    let lo = 0, hi = nums.length - 1; // @line init
    while (lo <= hi) { // @line loop
        const mid = Math.floor((lo + hi) / 2); // @line mid
        if (nums[mid] === target) return mid; // @line found
        if (nums[mid] < target) lo = mid + 1; // @line go-right
        else hi = mid - 1; // @line go-left
    }
    return -1; // @line not-found
}
