import { useEffect, useState } from "react";

import { fitWidth, validateWallpaperFile, WALLPAPER_MAX_WIDTH } from "./wallpaper.logic";

// Per device, like the other appearance settings: the image stays in this browser's IndexedDB.
const DATABASE_NAME = "leonidas-code:wallpaper";
const STORE_NAME = "images";
const CUSTOM_KEY = "custom";
const CHANGE_EVENT = "leonidas-code:wallpaper-change";

let database: Promise<IDBDatabase> | undefined;

function openDatabase() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.addEventListener("upgradeneeded", () => {
      request.result.createObjectStore(STORE_NAME);
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  }));
}

async function withStore<A>(
  mode: IDBTransactionMode,
  use: (store: IDBObjectStore) => IDBRequest<A>,
): Promise<A> {
  const transaction = (await openDatabase()).transaction(STORE_NAME, mode);
  const request = use(transaction.objectStore(STORE_NAME));
  await new Promise<void>((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("abort", () => reject(transaction.error));
    transaction.addEventListener("error", () => reject(transaction.error));
  });
  return request.result;
}

/** Decodes, downscales to 2560 px wide and re-encodes as WebP, so a 40 MB photo stores small. */
async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const size = fitWidth(bitmap.width, bitmap.height, WALLPAPER_MAX_WIDTH);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable.");
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image."))),
        "image/webp",
        0.86,
      ),
    );
  } finally {
    bitmap.close();
  }
}

/** Saves an uploaded image as the custom wallpaper. Returns an error sentence, or null. */
export async function saveCustomWallpaper(file: File): Promise<string | null> {
  const invalid = validateWallpaperFile(file);
  if (invalid) return invalid;
  let blob: Blob;
  try {
    blob = await shrinkImage(file);
  } catch {
    return "Could not read this image. Try another file.";
  }
  try {
    await withStore("readwrite", (store) => store.put(blob, CUSTOM_KEY));
  } catch {
    return "Could not save the image on this device.";
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return null;
}

export async function removeCustomWallpaper(): Promise<void> {
  await withStore("readwrite", (store) => store.delete(CUSTOM_KEY));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** An object URL for the stored custom wallpaper, or null when there is none. */
export function useCustomWallpaperUrl(): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let current: string | null = null;
    let disposed = false;
    const load = () => {
      withStore<Blob | undefined>("readonly", (store) => store.get(CUSTOM_KEY))
        .then((blob) => {
          if (disposed) return;
          if (current) URL.revokeObjectURL(current);
          current = blob ? URL.createObjectURL(blob) : null;
          setUrl(current);
        })
        .catch(() => {
          if (!disposed) setUrl(null);
        });
    };
    load();
    window.addEventListener(CHANGE_EVENT, load);
    return () => {
      disposed = true;
      window.removeEventListener(CHANGE_EVENT, load);
      if (current) URL.revokeObjectURL(current);
    };
  }, []);
  return url;
}
