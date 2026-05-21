## 2024-05-18 - Optimize note updates on rename by running in parallel
**Learning:** Sequential `for...await` loops when making multiple, independent API calls (like updating Firebase documents when backlinks change) can cause significant N+1 latency compounding.
**Action:** When making multiple independent updates or queries, accumulate the Promises using `Array.prototype.map()` and resolve them concurrently with `Promise.all()` to vastly reduce latency.
