import { describe, expect, it, vi } from "vitest";
import { createPhotoCache, PHOTO_CACHE_KEY } from "./photo-cache";

function setup() {
  let time = 100000;
  const values = new Map<string, string>();
  const storage = {
    getItem: (k: string) => values.get(k) || null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  };
  let revision = 0;
  const sign = vi.fn(async (paths: string[]) =>
    paths.map((path) => ({
      path,
      signedUrl: `https://images.example/${path}?version=${++revision}`,
    })),
  );
  const create = () => createPhotoCache(sign, storage, () => time);
  const cache = create();
  cache.setScope("admin");
  return {
    cache,
    create,
    sign,
    storage,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe("private product photo cache", () => {
  it("batches paths and deduplicates concurrent requests", async () => {
    const { cache, sign } = setup();
    const result = await Promise.all([
      cache.get("a"),
      cache.get("b"),
      cache.get("a"),
    ]);
    expect(sign).toHaveBeenCalledTimes(1);
    expect(sign).toHaveBeenCalledWith(["a", "b"], 3600);
    expect(result[0]).toBe(result[2]);
    expect(await cache.get("a")).toBe(result[0]);
    expect(sign).toHaveBeenCalledTimes(1);
  });
  it("reuses the same signed URL after a page reload", async () => {
    const { cache, create, sign } = setup();
    const original = await cache.get("a");
    const reloaded = create();
    reloaded.setScope("admin");
    expect(await reloaded.get("a")).toBe(original);
    expect(sign).toHaveBeenCalledTimes(1);
  });
  it("renews URLs before their one-hour expiry", async () => {
    const { cache, sign, advance } = setup();
    const original = await cache.get("a");
    advance(55 * 60 * 1000);
    expect(cache.peek("a")).toBe("");
    expect(await cache.get("a")).not.toBe(original);
    expect(sign).toHaveBeenCalledTimes(2);
  });
  it("isolates users and removes persisted URLs on sign-out", async () => {
    const { cache, storage, sign } = setup();
    const original = await cache.get("a");
    cache.setScope("operator");
    expect(cache.peek("a")).toBe("");
    expect(await cache.get("a")).not.toBe(original);
    expect(sign).toHaveBeenCalledTimes(2);
    cache.setScope(null);
    expect(storage.getItem(PHOTO_CACHE_KEY)).toBeNull();
    await expect(cache.get("a")).rejects.toThrow("sesión autorizada");
  });
  it("invalidates replaced files and retries signing failures", async () => {
    const { cache, sign } = setup();
    const original = await cache.get("a");
    cache.invalidate("a");
    expect(await cache.get("a")).not.toBe(original);
    sign.mockRejectedValueOnce(Error("offline"));
    await expect(cache.get("b")).rejects.toThrow("offline");
    await expect(cache.get("b")).resolves.toContain("/b?");
  });
  it("discards an in-flight response after the user changes", async () => {
    let finish!: (value: { path: string; signedUrl: string }[]) => void;
    const cache = createPhotoCache(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    cache.setScope("admin");
    const pending = cache.get("a");
    await Promise.resolve();
    cache.setScope("operator");
    finish([{ path: "a", signedUrl: "https://images.example/admin-only" }]);
    await expect(pending).rejects.toThrow("sesión de fotos cambió");
    expect(cache.peek("a")).toBe("");
  });
  it("works with unavailable or corrupted browser storage", async () => {
    const sign = vi.fn(async (paths: string[]) =>
      paths.map((path) => ({ path, signedUrl: "https://images.example/a" })),
    );
    const storage = {
      getItem: () => "not JSON",
      setItem: () => {
        throw Error("unavailable");
      },
      removeItem: () => {
        throw Error("unavailable");
      },
    };
    const cache = createPhotoCache(sign, storage);
    cache.setScope("admin");
    await expect(cache.get("a")).resolves.toContain("/a");
    await cache.get("a");
    expect(sign).toHaveBeenCalledTimes(1);
  });
});
