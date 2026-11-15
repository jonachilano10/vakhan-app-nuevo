import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";

import { config } from "../proxy";

describe("proxy matcher", () => {
  it.each([
    "/acceso",
    "/dashboard",
    "/trainer",
    "/trainer/programs",
    "/student",
    "/student/progress",
  ])("protege o procesa %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(true);
  });

  it.each(["/", "/auth/login", "/api/student-data"])(
    "no intercepta %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(false);
    },
  );
});
