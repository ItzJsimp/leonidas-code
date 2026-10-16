/**
 * Every outside service that needs the user's own free key. A new provider needs one entry here
 * plus one setting in `packages/contracts/src/settings.ts`.
 */
export interface ApiKeyProvider {
  readonly id: string;
  /** Name of the secret setting that holds the key. */
  readonly settingKey: "artificialAnalysisApiKey" | "groqApiKey";
  readonly label: string;
  /** What the key unlocks, in one plain sentence. */
  readonly purpose: string;
  readonly freeTierNote: string;
  readonly keyUrl: string;
  /** Three to five short steps. Screenshots are added later, one slot per step. */
  readonly steps: readonly string[];
  /** The lightest call that proves the key works. The server makes it. */
  readonly test: {
    readonly url: string;
    readonly headers: (key: string) => Record<string, string>;
  };
}

export const API_KEY_PROVIDERS: readonly ApiKeyProvider[] = [
  {
    id: "groq",
    settingKey: "groqApiKey",
    label: "Groq",
    purpose: "Lets Scribe turn your voice into text.",
    freeTierNote: "Free plan. No card needed.",
    keyUrl: "https://console.groq.com/keys",
    steps: [
      "Click Open page. Sign in or make a free Groq account.",
      "Click Create API Key.",
      "Type a name, for example Leonidas, and click Submit.",
      "Copy the key. It starts with gsk_.",
      "Paste the key here and click Save.",
    ],
    test: {
      url: "https://api.groq.com/openai/v1/models",
      headers: (key) => ({ Authorization: `Bearer ${key}` }),
    },
  },
  {
    id: "artificialAnalysis",
    settingKey: "artificialAnalysisApiKey",
    label: "Artificial Analysis",
    purpose: "Adds a score for each effort level (Low, Medium, High, Max) to the model picker.",
    freeTierNote: "Free plan. No card needed.",
    keyUrl: "https://artificialanalysis.ai/api-key-management-redirect",
    steps: [
      "Click Open page. Sign in or make a free account.",
      "Open the API key page and create a key.",
      "Copy the key.",
      "Paste the key here and click Save.",
    ],
    test: {
      url: "https://artificialanalysis.ai/api/v2/language/models/free",
      headers: (key) => ({ "x-api-key": key }),
    },
  },
];

export function getApiKeyProvider(id: string): ApiKeyProvider | undefined {
  return API_KEY_PROVIDERS.find((provider) => provider.id === id);
}

export interface KeyTestResult {
  readonly ok: boolean;
  readonly message: string;
}

/** Turn the HTTP status of a test call into a plain message. `null` means no answer came back. */
export function describeKeyTestResult(
  provider: ApiKeyProvider,
  response: { readonly status: number | null },
): KeyTestResult {
  const { status } = response;
  if (status !== null && status >= 200 && status < 300) {
    return { ok: true, message: "The key works." };
  }
  if (status === 401 || status === 403) {
    return {
      ok: false,
      message: `${provider.label} did not accept this key. Copy it again and check for missing letters.`,
    };
  }
  if (status === 429) {
    return {
      ok: false,
      message: `${provider.label} says there were too many requests. Wait a minute and try again.`,
    };
  }
  if (status === null) {
    return {
      ok: false,
      message: `Could not reach ${provider.label}. Check your internet and try again.`,
    };
  }
  return {
    ok: false,
    message: `${provider.label} is not available now (error ${status}). Try again later.`,
  };
}
