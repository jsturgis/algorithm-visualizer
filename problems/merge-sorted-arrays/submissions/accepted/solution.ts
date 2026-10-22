export function mergeSorted(arr1: number[], arr2: number[]): number[] {
    const merged: number[] = []; // @line init
    let i = 0, j = 0;
    while (i < arr1.length && j < arr2.length) { // @line loop
        if (arr1[i] <= arr2[j]) merged.push(arr1[i++]); // @line take-1
        else merged.push(arr2[j++]); // @line take-2
    }
    while (i < arr1.length) merged.push(arr1[i++]); // @line rest-1
    while (j < arr2.length) merged.push(arr2[j++]); // @line rest-2
    return merged; // @line return
}
