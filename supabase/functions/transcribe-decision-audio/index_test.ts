import { handleTranscribeDecisionAudio } from "./index.ts";

Deno.test("exports an injectable request handler", () => {
  if (typeof handleTranscribeDecisionAudio !== "function") {
    throw new Error("handler missing");
  }
});
