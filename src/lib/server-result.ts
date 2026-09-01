export type ServerResult<T> =
  { ok: true; data: T } | { ok: false; message: string }

export function ok<T = void>(data?: T): ServerResult<T> {
  return { ok: true, data: data as T }
}

export function err(message: string): ServerResult<never> {
  return { ok: false, message }
}
