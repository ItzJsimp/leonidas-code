/**
 * Models we picked from the Artificial Analysis and BenchLM lists (read 2026-10-16).
 * Slice 2 replaces this list with a JSON file that also holds the date and the last measured speed.
 * Sizes are file sizes in bytes. An installed model shows its real size from Ollama.
 */
const GB = 1024 ** 3;

export interface StarterModel {
  readonly id: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly benchLm: number | null;
}

export const STARTER_MODELS: ReadonlyArray<StarterModel> = [
  { id: "qwen3.8:27b-q4_K_M", name: "Qwen3.8 27B", sizeBytes: 17 * GB, benchLm: 59.6 },
  { id: "gemma4:26b-a4b-it-q4_K_M", name: "Gemma 4 26B A4B", sizeBytes: 18 * GB, benchLm: 45.6 },
  { id: "gemma4:12b-it-q4_K_M", name: "Gemma 4 12B", sizeBytes: 8 * GB, benchLm: 36.4 },
  { id: "granite4.2:8b-q4_K_M", name: "Granite 4.2 8B", sizeBytes: 5 * GB, benchLm: 33.1 },
];
