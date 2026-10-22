export function reverseString(s: string[]): string[] {
    let left = 0, right = s.length - 1; // @line init
    while (left < right) { // @line loop
        const temp = s[left]; // @line swap
        s[left] = s[right];
        s[right] = temp;
        left++; // @line move
        right--;
    }
    return s; // @line return
}
