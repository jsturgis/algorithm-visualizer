export function answerQueries(nums: number[], queries: number[][], limit: number): boolean[] {
    const prefix: number[] = [nums[0]]; // @line init
    for (let i = 1; i < nums.length; i++) prefix.push(prefix[i - 1] + nums[i]); // @line build
    const answers: boolean[] = []; // @line answers
    for (const [x, y] of queries) { // @line query
        const sum = prefix[y] - prefix[x] + nums[x]; // @line sum
        answers.push(sum < limit); // @line compare
    }
    return answers; // @line return
}
