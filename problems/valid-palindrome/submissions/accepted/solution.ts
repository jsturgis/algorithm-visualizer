export function isPalindrome(s: string): boolean {
    let left = 0, right = s.length - 1; // @line init
    while (left < right) { // @line loop
        if (s[left] !== s[right]) return false; // @line compare
        left++; // @line move
        right--; // @line move
    }
    return true; // @line return
}
