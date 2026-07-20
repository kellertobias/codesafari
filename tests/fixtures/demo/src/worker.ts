// @tour onboarding:12.2 Enqueue a job
// The producer pushes work onto the queue. The
// [Queue worker](glossary:queue-worker) drains it later.
export class Worker {
  run() {
    return 42;
  }
}

// @tour onboarding:12.10 Drain loop
// This is the main loop.
function drain() {
  while (true) {
    break;
  }
}

// @tour comment Watch out
// This map is not thread-safe.
const cache = new Map();
