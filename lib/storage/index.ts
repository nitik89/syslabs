import { createLocalStorageDriver } from "./driver";
import { createRepo, type Repo } from "./repo";

export * from "./driver";
export * from "./repo";
export * from "./backup";

let repo: Repo | null = null;

/** App-wide repository. Swap the driver here to move to Supabase. */
export function getRepo(): Repo {
  repo ??= createRepo(createLocalStorageDriver());
  return repo;
}
