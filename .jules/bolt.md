## 2024-05-24 - Avoid Large String Concatenations in Deduplication Loops
**Learning:** Concatenating very large strings (e.g. note/document contents) to form unique hashing keys inside loops handling tens of thousands of entries causes huge garbage collection overhead and V8 memory spikes (even crashing with Out of Memory on some cases).
**Action:** Use a nested `Map<string, Set<string>>` where keys are broken down hierarchically (e.g., Map on Title, Set on Content) to rely on internal C++ V8 string interning/hashing rather than forcing expensive string concats in JS.
