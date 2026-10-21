/*
 * The list of algorithms shown on the home page.
 * Add an entry here after creating algorithms/<slug>/index.html.
 */
window.ALGORITHMS = [
  {
    slug: "binary-search",
    title: "Binary Search",
    summary: "Find a value in a sorted array by halving the search range on every comparison.",
    tags: ["Arrays", "Searching"],
    complexity: "O(log n)",
  },
  {
    slug: "k-radius-averages",
    title: "K Radius Subarray Averages",
    summary: "Average every window of 2k + 1 numbers with one prefix-sum subtraction each.",
    tags: ["Arrays", "Prefix sum"],
    complexity: "O(n)",
  },
  {
    slug: "min-start-value",
    title: "Minimum Start Value",
    summary: "Track the lowest running sum to find the smallest start that keeps every total at least 1.",
    tags: ["Arrays", "Prefix sum"],
    complexity: "O(n)",
  },
];
