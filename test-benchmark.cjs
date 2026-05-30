const { performance } = require('perf_hooks');

const updateNoteData = async (id, data) => {
  // Simulate network latency (e.g. 50ms)
  return new Promise(resolve => setTimeout(resolve, 50));
};

const updates = Array.from({ length: 50 }, (_, i) => ({
  note: { id: `note-${i}` },
  newContent: `content-${i}`
}));

async function runSequential() {
  const start = performance.now();
  for (const u of updates) {
    await updateNoteData(u.note.id, { content: u.newContent });
  }
  const end = performance.now();
  console.log(`Sequential: ${end - start} ms`);
}

async function runParallel() {
  const start = performance.now();
  await Promise.all(
    updates.map(u => updateNoteData(u.note.id, { content: u.newContent }))
  );
  const end = performance.now();
  console.log(`Parallel: ${end - start} ms`);
}

async function run() {
  await runSequential();
  await runParallel();
}

run();
