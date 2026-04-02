import { beforeEach, describe, expect, it, vi } from "vitest";
import { gmailService } from "./gmailService.js";

function createStorageMock() {
  const state = {};
  return {
    state,
    local: {
      get: vi.fn((key, callback) => {
        if (typeof key === "string") {
          callback({ [key]: state[key] });
          return;
        }
        callback({});
      }),
      set: vi.fn((items, callback) => {
        Object.assign(state, items);
        if (callback) callback();
      })
    }
  };
}

describe("gmailService backend sync guards", () => {
  beforeEach(() => {
    const storage = createStorageMock();
    global.chrome = { storage };
  });

  it("detects job-related email content", () => {
    const shouldAnalyze = gmailService.shouldAnalyzeEmail(
      "Interview invitation - Backend Engineer",
      "We would like to schedule a phone screen next week.",
      "Recruiter <jobs@company.com>"
    );
    expect(shouldAnalyze).toBe(true);
  });

  it("skips non-job marketing-like content", () => {
    const shouldAnalyze = gmailService.shouldAnalyzeEmail(
      "Weekly newsletter",
      "Top productivity trends and creator tips",
      "news@digest.com"
    );
    expect(shouldAnalyze).toBe(false);
  });

  it("skips job-board blast style subjects without recruiter outcome language", () => {
    expect(
      gmailService.shouldAnalyzeEmail(
        "12 new jobs for you",
        "Click to view roles matching your profile.",
        "jobalerts@indeed.com"
      )
    ).toBe(false);
  });

  it("prunes processed cache by TTL and max size", () => {
    const now = Date.now();
    gmailService.PROCESSED_CACHE_TTL_DAYS = 30;
    gmailService.PROCESSED_CACHE_MAX = 2;

    const cache = {
      a: { ts: now - 10 * 24 * 60 * 60 * 1000, result: "saved" },
      b: { ts: now - 5 * 24 * 60 * 60 * 1000, result: "saved" },
      c: { ts: now - 40 * 24 * 60 * 60 * 1000, result: "saved" }
    };

    const pruned = gmailService.pruneProcessedCache(cache);
    expect(Object.keys(pruned)).toEqual(["b", "a"]);
    expect(pruned.c).toBeUndefined();
  });

  it("marks message as processed and detects it later", async () => {
    await gmailService.markEmailProcessed("msg-123", "saved");
    const seen = await gmailService.wasEmailProcessed("msg-123");
    expect(seen).toBe(true);
  });
});
