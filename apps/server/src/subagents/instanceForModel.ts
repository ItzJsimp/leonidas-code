/**
 * A subagent that names a model but no account runs on an account that offers
 * that model. The parent's account wins when it offers it, so a Claude chat
 * still starts a Claude subagent on its own account; a GPT chat falls through
 * to the first runnable account that lists the model.
 */
export function instanceForModel<
  P extends {
    readonly instanceId: string;
    readonly models: ReadonlyArray<{ readonly slug: string }>;
  },
>(
  providers: ReadonlyArray<P>,
  model: string,
  preferredInstanceId: string,
  isRunnable: (provider: P) => boolean,
): P["instanceId"] | undefined {
  const serving = providers.filter(
    (provider) => isRunnable(provider) && provider.models.some((entry) => entry.slug === model),
  );
  return (serving.find((provider) => provider.instanceId === preferredInstanceId) ?? serving[0])
    ?.instanceId;
}
