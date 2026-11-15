import { describe, expect, it } from "vitest";

import { safeExternalVideoUrl, toYouTubeEmbedUrl } from "../lib/video-url";

describe("URLs de videos", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=15", "dQw4w9WgXcQ"],
    ["https://youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("convierte %s a una URL embebible", (url, id) => {
    expect(toYouTubeEmbedUrl(url)).toBe(`https://www.youtube-nocookie.com/embed/${id}`);
  });

  it("no intenta embeber proveedores externos", () => {
    expect(toYouTubeEmbedUrl("https://www.instagram.com/p/example/")).toBeNull();
    expect(safeExternalVideoUrl("https://www.instagram.com/p/example/")).toBe(
      "https://www.instagram.com/p/example/",
    );
  });

  it("rechaza protocolos inseguros", () => {
    expect(safeExternalVideoUrl("javascript:alert(1)")).toBeNull();
  });
});
