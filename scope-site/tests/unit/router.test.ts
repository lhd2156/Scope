import { describe, expect, it } from "vitest";
import { router } from "@/router";

describe("site router", () => {
  it("resolves public routes and redirects unknown paths home", async () => {
    expect(router.resolve("/").matched[0].path).toBe("/");
    expect(router.resolve("/features").matched[0].path).toBe("/features");
    expect(router.resolve("/blog/launch-announcement").matched[0].path).toBe("/blog/:slug");
    expect(router.resolve("/privacy").matched[0].props.default).toEqual({ kind: "privacy" });
    expect(router.resolve("/terms").matched[0].props.default).toEqual({ kind: "terms" });
    expect(router.resolve("/nope").matched[0].redirect).toBe("/");
  });
});
