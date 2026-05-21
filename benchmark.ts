import { parseTakeoutJson, ParsedTakeoutEntry } from "./src/lib/takeoutParser.ts";

function generateMockData(count: number) {
  const data: any[] = [];
  for (let i = 0; i < count; i++) {
    const isDuplicate = i % 5 === 0 && i > 0;
    const index = isDuplicate ? i - 1 : i;
    data.push({
      textContent: `This is some mock content for note number ${index}. It is a bit long to simulate real content. Adding more text here to make the hashing/concatenation work harder.`.repeat(10),
      title: `Note Title ${index}`,
      createdTimestampUsec: Date.now() * 1000 + i,
      labels: [{ name: "Test" }, { name: "Mock" }],
    });
  }
  return data;
}

const mockData = generateMockData(100000); // 100k entries

const start = performance.now();
const result = parseTakeoutJson(mockData, "benchmark.json");
const end = performance.now();

console.log(`Parsed ${result.length} unique entries.`);
console.log(`Execution time: ${(end - start).toFixed(2)} ms`);
