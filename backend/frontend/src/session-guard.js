export function createSessionGuard() {
  let token = null;
  let revision = 0;
  const controllers = new Set();

  return {
    transition(nextToken) {
      if (token === nextToken) return;
      token = nextToken;
      revision += 1;
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
    },
    begin() {
      const requestRevision = revision;
      const controller = new AbortController();
      controllers.add(controller);
      return {
        signal: controller.signal,
        isCurrent: () => requestRevision === revision,
        finish: () => controllers.delete(controller)
      };
    }
  };
}
