const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{6,}$/;

function validYouTubeId(value: string | null | undefined) {
  return value && YOUTUBE_ID_PATTERN.test(value) ? value : null;
}

export function toYouTubeEmbedUrl(value: string) {
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    let videoId: string | null = null;

    if (hostname === "youtu.be") {
      videoId = validYouTubeId(url.pathname.split("/").filter(Boolean)[0]);
    } else if (
      hostname === "youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname === "music.youtube.com" ||
      hostname === "youtube-nocookie.com"
    ) {
      const segments = url.pathname.split("/").filter(Boolean);
      if (url.pathname === "/watch") {
        videoId = validYouTubeId(url.searchParams.get("v"));
      } else if (["shorts", "embed", "live"].includes(segments[0])) {
        videoId = validYouTubeId(segments[1]);
      }
    }

    return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null;
  } catch {
    return null;
  }
}

export function safeExternalVideoUrl(value: string) {
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}
