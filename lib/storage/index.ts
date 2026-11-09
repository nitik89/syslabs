import { createLocalStorageDriver, type StorageDriver } from "./driver";
import { createRepo, type Repo } from "./repo";

export * from "./driver";
export * from "./repo";
export * from "./backup";
export { createSupabaseDriver, mergeDesigns, mergeProgress, migrateGuestData } from "./cloud";

/*
 * Where data lives right now: the browser (guests) or the signed-in user's cloud storage.
 * The repo talks to a switching driver; every call waits until auth has settled, so nothing is read from
 * the wrong place while a session is being restored.
 */
let local: StorageDriver | null = null;
export const localDriver = (): StorageDriver => (local ??= createLocalStorageDriver());

let target: StorageDriver | null = null;
let ready: Promise<unknown> = Promise.resolve();

const switching: StorageDriver = {
  async get(key) {
    await ready;
    return (target ?? localDriver()).get(key);
  },
  async set(key, value) {
    await ready;
    return (target ?? localDriver()).set(key, value);
  },
  async remove(key) {
    await ready;
    return (target ?? localDriver()).remove(key);
  },
};

/** Hold every storage call until `p` settles (used while restoring a session and migrating guest data). */
export function holdStorageUntil(p: Promise<unknown>): void {
  ready = p.catch(() => undefined);
}

/** Route storage to `driver` (cloud), or back to the browser with null. */
export function setStorageTarget(driver: StorageDriver | null): void {
  target = driver;
}

let repo: Repo | null = null;

/** App-wide repository. */
export function getRepo(): Repo {
  repo ??= createRepo(switching);
  return repo;
}
