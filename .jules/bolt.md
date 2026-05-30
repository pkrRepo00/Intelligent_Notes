## 2024-05-30 - N+1 Database Update Optimization
**Learning:** Sequential await loops for network/DB requests result in N+1 inefficiencies and degrade performance.
**Action:** Replace `for (const x of arr) await IORoutine(x)` with `await Promise.all(arr.map(x => IORoutine(x)))` for parallel, non-blocking asynchronous calls whenever safe to do so.
