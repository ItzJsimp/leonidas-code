import { assert, describe, it } from "@effect/vitest";

import { FakeMailProvider } from "./fakeProvider.ts";
import { PROVIDER_METHODS } from "./provider.ts";
import { runProviderContract } from "./providerContract.ts";

describe("MailProvider surface", () => {
  it("has no method named send or forward", () => {
    assert.isAbove(PROVIDER_METHODS.length, 0);
    for (const name of PROVIDER_METHODS) assert.notMatch(name, /send|forward/i);
  });

  it("FakeMailProvider exposes only the listed methods plus test helpers", () => {
    const own = Object.getOwnPropertyNames(FakeMailProvider.prototype).filter(
      (n) => n !== "constructor",
    );
    for (const name of own) assert.notMatch(name, /send|forward/i);
    for (const name of PROVIDER_METHODS) assert.include(own, name);
  });
});

runProviderContract("FakeMailProvider", () => {
  const fake = new FakeMailProvider();
  return {
    provider: fake,
    seed: (m) => fake.seed(m),
    editDraft: (id, body) => fake.editDraft(id, body),
  };
});
