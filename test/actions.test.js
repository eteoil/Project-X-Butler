import { test } from "node:test";
import assert from "node:assert/strict";
import { repost } from "../src/actions/repost.js";
import { like } from "../src/actions/like.js";

// In test mode both actions must short-circuit before touching the page,
// so a page that throws on any call proves no real click happened.
const untouchablePage = new Proxy(
  {},
  {
    get() {
      throw new Error("page should not be touched in test mode");
    },
  }
);

test("repost is a dry run in test mode and never touches the page", async () => {
  const result = await repost(untouchablePage, "12345", { testMode: true });
  assert.deepEqual(result, { postId: "12345", action: "repost", dryRun: true });
});

test("like is a dry run in test mode and never touches the page", async () => {
  const result = await like(untouchablePage, "12345", { testMode: true });
  assert.deepEqual(result, { postId: "12345", action: "like", dryRun: true });
});
