import { describe, expect, it } from "vitest";
import { COALESCE_MS, HISTORY_LIMIT, checkpoint, emptyHistory, redo, undo } from "./history";

describe("history", () => {
  it("undoes and redoes in order", () => {
    let h = emptyHistory<number>();
    h = checkpoint(h, 1, null, 0); // 1 -> 2
    h = checkpoint(h, 2, null, 10); // 2 -> 3
    const u1 = undo(h, 3)!;
    expect(u1.state).toBe(2);
    const u2 = undo(u1.history, 2)!;
    expect(u2.state).toBe(1);
    expect(undo(u2.history, 1)).toBeNull();
    const r1 = redo(u2.history, 1)!;
    expect(r1.state).toBe(2);
    expect(redo(r1.history, 2)!.state).toBe(3);
  });

  it("a new change after undo clears the redo stack", () => {
    let h = checkpoint(emptyHistory<string>(), "a", null, 0);
    const u = undo(h, "b")!;
    h = checkpoint(u.history, "a", null, 5);
    expect(redo(h, "c")).toBeNull();
  });

  it("coalesces rapid changes with the same key, but not different keys or slow ones", () => {
    let h = emptyHistory<number>();
    h = checkpoint(h, 0, "field:x", 0);
    h = checkpoint(h, 1, "field:x", 100);
    h = checkpoint(h, 2, "field:x", 200);
    expect(h.past).toEqual([0]);
    h = checkpoint(h, 3, "field:y", 300);
    expect(h.past).toEqual([0, 3]);
    h = checkpoint(h, 4, "field:y", 300 + COALESCE_MS + 1);
    expect(h.past).toEqual([0, 3, 4]);
  });

  it("caps its size", () => {
    let h = emptyHistory<number>();
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) h = checkpoint(h, i, null, i * 1000);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.past[0]).toBe(20);
  });
});
