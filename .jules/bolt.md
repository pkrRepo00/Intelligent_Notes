## 2023-10-24 - O(N^2) Array Search in Array Iteration
**Learning:** Calling `Array.find` or `Array.filter` inside a `.forEach` or `map` loop creates an O(N^2) time complexity bottleneck, especially when iterating over large datasets.
**Action:** Use a `Map` (or `Set`) to index items by key first in O(N) time, then perform an O(1) lookup inside the loop, reducing overall complexity to O(N).
