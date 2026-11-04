/** A single pending user decision; dismissal and duplicate requests never approve an action. */
export function createConfirmationGate() {
  let resolve: ((approved: boolean) => void) | undefined;
  let owner: symbol | undefined;
  function settle(approved: boolean) {
    const done = resolve;
    resolve = undefined;
    owner = undefined;
    done?.(approved);
  }
  return {
    get pending() {
      return resolve !== undefined;
    },
    request(requestOwner?: symbol): Promise<boolean> {
      if (resolve) return Promise.resolve(false);
      owner = requestOwner;
      return new Promise<boolean>((done) => {
        resolve = done;
      });
    },
    settle,
    cancel(requestOwner: symbol): boolean {
      if (owner !== requestOwner) return false;
      settle(false);
      return true;
    },
  };
}
