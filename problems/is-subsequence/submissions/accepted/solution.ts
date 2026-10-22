export function isSubsequence(s: string, t: string): boolean {
    let i = 0, j = 0; // @line init
    while (i < s.length && j < t.length) { // @line loop
        if (s[i] === t[j]) i++; // @line match
        j++; // @line next
    }
    return i === s.length; // @line return
}
