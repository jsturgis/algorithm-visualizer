export function longestOnesAfterFlip(s: string): number {
    let left = 0, zeros = 0, best = 0; // @line init
    for (let right = 0; right < s.length; right++) { // @line expand
        if (s[right] === "0") zeros++; // @line add
        while (zeros > 1) { // @line too-many
            if (s[left] === "0") zeros--; // @line shrink
            left++;
        }
        best = Math.max(best, right - left + 1); // @line best
    }
    return best; // @line return
}
