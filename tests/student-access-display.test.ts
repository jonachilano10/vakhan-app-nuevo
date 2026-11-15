import { describe, expect, it } from "vitest";

import { whatsappAccessUrl } from "../lib/student-access-display";

describe("student access display", () => {
  it("arma el enlace de WhatsApp sin perder el fragmento secreto", () => {
    const accessUrl = "https://app.example.com/acceso#token_secreto";
    const shareUrl = whatsappAccessUrl(accessUrl);
    expect(shareUrl).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(decodeURIComponent(shareUrl.split("text=")[1])).toContain(accessUrl);
  });
});
