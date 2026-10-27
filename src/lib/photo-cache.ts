type Entry = { url: string; expiresAt: number };
type SignedPhoto = {
  path?: string | null;
  signedUrl?: string | null;
  error?: unknown;
};
type Request = {
  promise: Promise<string>;
  resolve: (url: string) => void;
  reject: (error: unknown) => void;
};
type CacheStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export const PHOTO_CACHE_KEY = "umbra:product-photos:v1";
const SIGNED_SECONDS = 3600;
const REUSE_MS = 55 * 60 * 1000;

export function createPhotoCache(
  sign: (paths: string[], expiresIn: number) => Promise<SignedPhoto[]>,
  storage?: CacheStorage,
  now = Date.now,
) {
  let scope: string | null = null;
  let generation = 0;
  let queued = false;
  const entries = new Map<string, Entry>();
  const pending = new Map<string, Request>();
  const inFlight = new Map<string, Request>();

  function persist() {
    try {
      if (!scope) storage?.removeItem(PHOTO_CACHE_KEY);
      else
        storage?.setItem(
          PHOTO_CACHE_KEY,
          JSON.stringify({
            scope,
            entries: [...entries]
              .filter(([, e]) => e.expiresAt > now())
              .slice(-256),
          }),
        );
    } catch {
      /* Restricted browser storage must not prevent image loading. */
    }
  }

  function setScope(next: string | null) {
    if (scope === next) return;
    generation++;
    for (const request of pending.values())
      request.reject(Error("La sesión de fotos cambió."));
    pending.clear();
    inFlight.clear();
    entries.clear();
    scope = next;
    try {
      const saved = JSON.parse(storage?.getItem(PHOTO_CACHE_KEY) || "null");
      if (scope && saved?.scope === scope && Array.isArray(saved.entries)) {
        for (const [path, entry] of saved.entries) {
          if (
            typeof path === "string" &&
            typeof entry?.url === "string" &&
            entry.expiresAt > now() &&
            entry.expiresAt <= now() + REUSE_MS
          )
            entries.set(path, entry);
        }
      } else storage?.removeItem(PHOTO_CACHE_KEY);
    } catch {
      /* Start with an empty cache if saved data is unavailable. */
    }
  }

  function peek(path: string) {
    const entry = entries.get(path);
    if (scope && entry && entry.expiresAt > now()) return entry.url;
    entries.delete(path);
    return "";
  }

  async function flush() {
    queued = false;
    const batch = [...pending];
    pending.clear();
    if (!batch.length) return;
    const version = generation;
    const expiresAt = now() + REUSE_MS;
    try {
      const signed = await sign(
        batch.map(([path]) => path),
        SIGNED_SECONDS,
      );
      if (generation !== version) throw Error("La sesión de fotos cambió.");
      for (const [path, request] of batch) {
        inFlight.delete(path);
        const result = signed.find((item) => item.path === path);
        if (!result?.signedUrl || result.error)
          request.reject(Error("No se pudo cargar la foto."));
        else {
          entries.set(path, { url: result.signedUrl, expiresAt });
          request.resolve(result.signedUrl);
        }
      }
      persist();
    } catch (error) {
      for (const [path, request] of batch) {
        if (inFlight.get(path) === request) inFlight.delete(path);
        request.reject(error);
      }
    }
  }

  function get(path: string): Promise<string> {
    if (!scope) return Promise.reject(Error("No hay una sesión autorizada."));
    const cached = peek(path);
    if (cached) return Promise.resolve(cached);
    const existing = inFlight.get(path);
    if (existing) return existing.promise;
    let resolve!: Request["resolve"];
    let reject!: Request["reject"];
    const promise = new Promise<string>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    const request = { promise, resolve, reject };
    inFlight.set(path, request);
    pending.set(path, request);
    if (!queued) {
      queued = true;
      queueMicrotask(() => void flush());
    }
    return promise;
  }

  return {
    setScope,
    peek,
    get,
    invalidate(path: string) {
      entries.delete(path);
      persist();
    },
    async prefetch(paths: string[]) {
      await Promise.all([...new Set(paths)].map(get));
    },
  };
}
