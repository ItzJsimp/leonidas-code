/** Browser helpers for the file preview: save a file, copy an image, copy a text excerpt. */

/** Text copy reads at most this much, the same cap the preview uses. */
const COPY_TEXT_MAX_BYTES = 1024 * 1024;

async function fetchOk(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  if (!response.ok && response.status !== 206) throw new Error("The file could not be loaded.");
  return response;
}

/** Saves through a Blob so the desktop client keeps the download inside the app. */
export async function saveFile(url: string, name: string): Promise<void> {
  const blob = await (await fetchOk(url)).blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = name;
    anchor.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  }
}

/** Copies an image as PNG, the one image type every clipboard accepts. */
export async function copyImage(url: string): Promise<void> {
  const bitmap = await createImageBitmap(await (await fetchOk(url)).blob());
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Not an image."))),
        "image/png",
      ),
    );
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
  } finally {
    bitmap.close();
  }
}

export async function copyText(url: string): Promise<void> {
  const response = await fetchOk(url, { headers: { Range: `bytes=0-${COPY_TEXT_MAX_BYTES}` } });
  await navigator.clipboard.writeText(await response.text());
}
