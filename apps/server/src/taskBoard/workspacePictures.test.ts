import { WorkspacePictureError } from "@t3tools/contracts";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import * as ServerConfig from "../config.ts";
import {
  decodeWorkspacePicture,
  listWorkspacePictures,
  removeWorkspacePicture,
  setWorkspacePicture,
} from "./workspacePictures.ts";

const PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const pngDataUrl = (base64: string) => `data:image/png;base64,${base64}`;

/** The 1 px PNG with its header width set to `width`. */
function widePng(width: number): string {
  const bytes = Buffer.from(PIXEL_PNG, "base64");
  bytes.writeUInt32BE(width, 16);
  return bytes.toString("base64");
}

describe("decodeWorkspacePicture", () => {
  it("accepts a small PNG and reads its format from the bytes", () => {
    const decoded = decodeWorkspacePicture(`data:image/jpeg;base64,${PIXEL_PNG}`);
    assert.notStrictEqual(typeof decoded, "string");
    if (typeof decoded !== "string") assert.strictEqual(decoded.format.extension, "png");
  });

  it("rejects non-images, SVG, oversize files and oversize dimensions", () => {
    assert.match(decodeWorkspacePicture("not a data url") as string, /not a valid/);
    const svg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>").toString("base64");
    assert.match(decodeWorkspacePicture(`data:image/svg+xml;base64,${svg}`) as string, /PNG, JPEG/);
    const huge = Buffer.alloc(300 * 1024, 1).toString("base64");
    assert.match(decodeWorkspacePicture(pngDataUrl(huge)) as string, /256 KB/);
    assert.match(decodeWorkspacePicture(pngDataUrl(widePng(2000))) as string, /1024/);
  });
});

const withBaseDir = <A, E>(
  body: Effect.Effect<A, E, ServerConfig.ServerConfig | FileSystem.FileSystem | Path.Path>,
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "t3code-workspace-pictures-" });
    return yield* body.pipe(Effect.provide(ServerConfig.layerTest(process.cwd(), baseDir)));
  }).pipe(Effect.scoped);

it.layer(NodeServices.layer)("workspace pictures", (it) => {
  it.effect("stores, lists, replaces and removes a picture", () =>
    withBaseDir(
      Effect.gen(function* () {
        assert.deepEqual(yield* listWorkspacePictures(), { pictures: {} });
        yield* setWorkspacePicture({ workspaceId: "leonidas", dataUrl: pngDataUrl(PIXEL_PNG) });
        const listed = yield* listWorkspacePictures();
        assert.strictEqual(listed.pictures.leonidas, pngDataUrl(PIXEL_PNG));
        yield* removeWorkspacePicture({ workspaceId: "leonidas" });
        assert.deepEqual(yield* listWorkspacePictures(), { pictures: {} });
      }),
    ),
  );

  it.effect("fails with a readable error for an invalid upload", () =>
    withBaseDir(
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          setWorkspacePicture({ workspaceId: "leonidas", dataUrl: "data:image/png;base64,AAAA" }),
        );
        assert.instanceOf(error, WorkspacePictureError);
        assert.deepEqual(yield* listWorkspacePictures(), { pictures: {} });
      }),
    ),
  );
});
