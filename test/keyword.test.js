import { test } from "node:test";
import assert from "node:assert/strict";
import { matchKeyword, judgePost, judgePosts } from "../src/keyword.js";

test("matchKeyword finds a case-insensitive substring match", () => {
  assert.equal(matchKeyword("Hello World", ["world"]), "world");
});

test("matchKeyword returns null when nothing matches", () => {
  assert.equal(matchKeyword("Hello World", ["foo", "bar"]), null);
});

test("matchKeyword returns null for empty text", () => {
  assert.equal(matchKeyword("", ["foo"]), null);
});

test("judgePost flags repost when repost rule matches and is enabled", () => {
  const rules = { repost: { enabled: true, keywords: ["セール"] } };
  const decisions = judgePost({ id: "1", text: "本日セール開催中" }, rules);
  assert.deepEqual(decisions, { repost: { matched: "セール" } });
});

test("judgePost ignores disabled rules", () => {
  const rules = { repost: { enabled: false, keywords: ["セール"] } };
  const decisions = judgePost({ id: "1", text: "本日セール開催中" }, rules);
  assert.deepEqual(decisions, {});
});

test("judgePost can flag both repost and like for the same post", () => {
  const rules = {
    repost: { enabled: true, keywords: ["キャンペーン"] },
    like: { enabled: true, keywords: ["キャンペーン"] },
  };
  const decisions = judgePost({ id: "1", text: "新キャンペーン開始" }, rules);
  assert.deepEqual(decisions, {
    repost: { matched: "キャンペーン" },
    like: { matched: "キャンペーン" },
  });
});

test("judgePosts only returns posts with at least one match", () => {
  const rules = { like: { enabled: true, keywords: ["猫"] } };
  const posts = [
    { id: "1", text: "今日は晴れ" },
    { id: "2", text: "猫がかわいい" },
  ];
  const results = judgePosts(posts, rules);
  assert.equal(results.length, 1);
  assert.equal(results[0].post.id, "2");
  assert.deepEqual(results[0].decisions, { like: { matched: "猫" } });
});
