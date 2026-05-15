export type ShellExecResult =
  | { ok: true; output: string }
  | { ok: false; error: string }
