export function reverseString(s: string[]): string[] {
    let left = 0, right = s.length - 1; // @line init
    while (left < right) { // @line loop
        const temp = s[left]; // @line save
        s[left] = s[right]; // @line put-right
        s[right] = temp; // @line put-temp
        left++; // @line move
        right--; // @line move
    }
    return s; // @line return
}
