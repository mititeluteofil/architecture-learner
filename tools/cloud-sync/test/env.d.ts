export {};

// Types the `env` imported from "cloudflare:test" with the worker's bindings.
declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {}
  }
  type WorkerEnv = import("../src/index").Env;
}
