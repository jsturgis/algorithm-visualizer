export function minStartValue(nums: number[]): number {
    let total = 0, minVal = 0; // @line init
    for (const num of nums) { // @line read
        total += num; // @line add
        minVal = Math.min(minVal, total); // @line min
    }
    return 1 - minVal; // @line return
}
