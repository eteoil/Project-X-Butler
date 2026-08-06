import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createLogger } from "../src/logger.js";

test("logger appends a structured JSON line to today's log file", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "pxb-logs-"));
  const logger = createLogger({ dir });

  try {
    await logger.info("hello", { foo: "bar" });

    const date = new Date().toISOString().slice(0, 10);
    const content = await readFile(path.join(dir, `${date}.log`), "utf8");
    const lines = content.trim().split("\n");
    assert.equal(lines.length, 1);

    const entry = JSON.parse(lines[0]);
    assert.equal(entry.level, "info");
    assert.equal(entry.message, "hello");
    assert.equal(entry.foo, "bar");
    assert.ok(entry.timestamp);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("logger appends multiple entries across calls", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "pxb-logs-"));
  const logger = createLogger({ dir });

  try {
    await logger.warn("first");
    await logger.error("second");

    const date = new Date().toISOString().slice(0, 10);
    const content = await readFile(path.join(dir, `${date}.log`), "utf8");
    const lines = content.trim().split("\n");
    assert.equal(lines.length, 2);
    assert.equal(JSON.parse(lines[0]).level, "warn");
    assert.equal(JSON.parse(lines[1]).level, "error");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
