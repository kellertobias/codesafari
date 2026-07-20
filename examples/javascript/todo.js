// A minimal in-memory todo list in plain JavaScript.
//
// Each step below uses a different comment style: a regular line comment, a
// doc-block comment, and a ranged block comment.

// @tour todo:1 The store
// A single array holds every task. Each task is a small object with a stable
// id and a done flag — enough to add, complete, and list.
//
// (Anchored with regular `//` line comments.)
const tasks = [];
let nextId = 1;

/**
 * @tour todo:2 Adding a task
 * New tasks start out not done. We hand back the id so a caller can refer to
 * the task later (for example, to complete it).
 *
 * (Anchored with a doc-block `/** ... *\/` comment.)
 */
function add(title) {
  const task = { id: nextId++, title, done: false };
  tasks.push(task);
  return task.id;
}

/*
 * @tour todo:3 Completing a task
 * Look the task up by id and flip its flag. Returns false when the id is
 * unknown, so callers can tell a no-op from a real change.
 *
 * (Anchored with a ranged block `/* ... *\/` comment.)
 */
function complete(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return false;
  task.done = true;
  return true;
}

/**
 * @tour comment Callouts are a `@tour comment` feature
 * A callout is a non-navigable note pinned to a spot in the file. It comes from
 * the `@tour comment` header — not from the surrounding comment style. This one
 * lives in a doc block (the preferred style), but the same header works in `//`
 * line comments or `/* ... *\/` blocks too.
 */

const groceries = add('Buy groceries');
add('Walk the dog');
complete(groceries);

for (const t of tasks) {
  console.log(`[${t.done ? 'x' : ' '}] ${t.title}`);
}
