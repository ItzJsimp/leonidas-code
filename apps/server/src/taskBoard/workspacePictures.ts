import {
  WORKSPACE_PICTURE_MAX_BYTES,
  WORKSPACE_PICTURE_MAX_SIDE,
  WorkspacePictureError,
  type WorkspacePictureRemoveInput,
  type WorkspacePicturesListResult,
  type WorkspacePictureSetInput,
} from "@t3tools/contracts";
import { readImageDimensions } from "@t3tools/shared/imageDimensions";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import * as ServerConfig from "../config.ts";
import { parseBase64DataUrl } from "../imageMime.ts";

/** Pictures live in the server's own data folder, never inside an AIOS folder. */
const PICTURES_FOLDER = "workspace-pictures";
const FILE_PATTERN = /^([a-z0-9][a-z0-9-]{0,63})\.(png|jpg|webp)$/;

type PictureFormat = Readonly<{ extension: "png" | "jpg" | "webp"; mimeType: string }>;

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

/** The format from the file's own magic bytes; the client's claimed type is not trusted. */
function sniffFormat(bytes: Uint8Array): PictureFormat | null {
  if (bytes[0] === 0x89 && ascii(bytes, 1, 4) === "PNG") {
    return { extension: "png", mimeType: "image/png" };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: "jpg", mimeType: "image/jpeg" };
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return { extension: "webp", mimeType: "image/webp" };
  }
  return null;
}

/** Validates an uploaded picture. Returns the bytes and format, or an error sentence. */
export function decodeWorkspacePicture(
  dataUrl: string,
): { readonly bytes: Uint8Array; readonly format: PictureFormat } | string {
  const parsed = parseBase64DataUrl(dataUrl);
  if (!parsed) return "The picture is not a valid image upload.";
  const bytes = new Uint8Array(Buffer.from(parsed.base64, "base64"));
  if (bytes.byteLength === 0) return "The picture is empty.";
  if (bytes.byteLength > WORKSPACE_PICTURE_MAX_BYTES) return "The picture is larger than 256 KB.";
  const format = sniffFormat(bytes);
  if (!format) return "The picture must be a PNG, JPEG or WebP image.";
  const dimensions = readImageDimensions(bytes);
  if (!dimensions) return "The picture could not be read.";
  if (
    dimensions.width > WORKSPACE_PICTURE_MAX_SIDE ||
    dimensions.height > WORKSPACE_PICTURE_MAX_SIDE
  ) {
    return "The picture is larger than 1024 by 1024 pixels.";
  }
  return { bytes, format };
}

const failed = (message: string) => () => new WorkspacePictureError({ message });

const picturesDirectory = Effect.gen(function* () {
  const { stateDir } = yield* ServerConfig.ServerConfig;
  const path = yield* Path.Path;
  return path.join(stateDir, PICTURES_FOLDER);
});

/** Every stored picture as a data URL, keyed by workspace id. */
export const listWorkspacePictures = Effect.fn("workspacePictures.list")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* picturesDirectory;
  const names = yield* fs.readDirectory(directory).pipe(Effect.orElseSucceed(() => []));
  const pictures: Record<string, string> = {};
  for (const name of names) {
    const match = FILE_PATTERN.exec(name);
    if (!match) continue;
    const bytes = yield* fs
      .readFile(path.join(directory, name))
      .pipe(Effect.orElseSucceed(() => null));
    const format = bytes ? sniffFormat(bytes) : null;
    if (!bytes || !format) continue;
    pictures[match[1]!] = `data:${format.mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
  }
  return { pictures } satisfies WorkspacePicturesListResult;
});

/** Removes every stored format of one workspace's picture. */
const removeFiles = Effect.fn("workspacePictures.removeFiles")(function* (workspaceId: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* picturesDirectory;
  for (const extension of ["png", "jpg", "webp"]) {
    yield* fs
      .remove(path.join(directory, `${workspaceId}.${extension}`), { force: true })
      .pipe(Effect.mapError(failed("Could not remove the old picture.")));
  }
});

export const setWorkspacePicture = Effect.fn("workspacePictures.set")(function* (
  input: WorkspacePictureSetInput,
) {
  const decoded = decodeWorkspacePicture(input.dataUrl);
  if (typeof decoded === "string") return yield* new WorkspacePictureError({ message: decoded });
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* picturesDirectory;
  yield* fs
    .makeDirectory(directory, { recursive: true })
    .pipe(Effect.mapError(failed("Could not create the picture folder.")));
  yield* removeFiles(input.workspaceId);
  yield* fs
    .writeFile(
      path.join(directory, `${input.workspaceId}.${decoded.format.extension}`),
      decoded.bytes,
    )
    .pipe(Effect.mapError(failed("Could not save the picture.")));
});

export const removeWorkspacePicture = Effect.fn("workspacePictures.remove")(function* (
  input: WorkspacePictureRemoveInput,
) {
  yield* removeFiles(input.workspaceId);
});
