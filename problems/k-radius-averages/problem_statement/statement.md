You are given an array `nums` of `n` integers and an integer `k`.

The **k-radius average** centered at index `i` is the average of every element of `nums` from index `i − k` to index `i + k`, inclusive. If there are fewer than `k` elements before or after index `i`, the k-radius average is `-1`.

Return an array `avgs` of length `n` where `avgs[i]` is the k-radius average centered at index `i`.

Averages use integer division, which truncates toward zero: the average of 2, 3, 1 and 5 is 11 / 4 = 2.75, which truncates to 2.
