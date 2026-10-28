declare module "*.sql?raw" {
  const sql: string;
  export default sql;
}

declare module "*/compute.mjs" {
  export function computeState(sessions: unknown[], rules: unknown, opts?: unknown): any;
}
