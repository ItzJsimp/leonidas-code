// Lists the visible top-level Windows windows, top of the z-order first, for the snip overlay hit test.
import type { SnipRect, SnipWindow } from "./SnipGeometry.ts";

export interface WindowListApi {
  readonly getTopWindow: () => bigint;
  readonly getNextWindow: (windowHandle: bigint) => bigint;
  readonly isVisible: (windowHandle: bigint) => boolean;
  readonly isMinimized: (windowHandle: bigint) => boolean;
  /** True for windows on another virtual desktop and for hidden UWP shells. */
  readonly isCloaked: (windowHandle: bigint) => boolean;
  /** Visible frame in physical pixels, without the invisible resize shadow. */
  readonly getRect: (windowHandle: bigint) => SnipRect | undefined;
  readonly getTitle: (windowHandle: bigint) => string;
  readonly getClassName: (windowHandle: bigint) => string;
}

export type ListVisibleWindowsOptions = {
  /** Window ids to leave out, such as the snip overlay windows. */
  readonly excludeIds?: ReadonlySet<number>;
  readonly maxWindows?: number;
};

const DEFAULT_MAX_WINDOWS = 400;
/** Untitled windows are mostly helper windows. The taskbar is the useful exception. */
const UNTITLED_ALLOWED_CLASSES = new Set(["Shell_TrayWnd", "Shell_SecondaryTrayWnd"]);

export function listVisibleWindows(
  api: WindowListApi,
  options: ListVisibleWindowsOptions = {},
): ReadonlyArray<SnipWindow> {
  const maxWindows = options.maxWindows ?? DEFAULT_MAX_WINDOWS;
  const windows: SnipWindow[] = [];
  const seen = new Set<bigint>();
  try {
    let handle = api.getTopWindow();
    while (handle !== 0n && !seen.has(handle) && seen.size < maxWindows) {
      seen.add(handle);
      const id = Number(handle);
      if (
        !options.excludeIds?.has(id) &&
        api.isVisible(handle) &&
        !api.isMinimized(handle) &&
        !api.isCloaked(handle)
      ) {
        const bounds = api.getRect(handle);
        if (bounds && bounds.width > 0 && bounds.height > 0) {
          const title = api.getTitle(handle);
          if (title.length > 0 || UNTITLED_ALLOWED_CLASSES.has(api.getClassName(handle))) {
            windows.push({ id, title, bounds });
          }
        }
      }
      handle = api.getNextWindow(handle);
    }
  } catch {
    // A window can vanish mid-walk. Keep what we have.
  }
  return windows;
}

const DWMWA_CLOAKED = 14;
const DWMWA_EXTENDED_FRAME_BOUNDS = 9;
const GW_HWNDNEXT = 2;

let windowListApiPromise: Promise<WindowListApi> | undefined;

/** Loads the Win32 calls. Windows only: throws on other systems. */
export function loadWindowListApi(): Promise<WindowListApi> {
  windowListApiPromise ??= import("ffi-rs").then(({ DataType, load, open }) => {
    const user32 = "leonidas-snip-user32";
    const dwm = "leonidas-snip-dwmapi";
    open({ library: user32, path: "user32.dll" });
    open({ library: dwm, path: "dwmapi.dll" });

    const dwmAttribute = (windowHandle: bigint, attribute: number, out: Buffer): boolean =>
      load({
        library: dwm,
        funcName: "DwmGetWindowAttribute",
        retType: DataType.I32,
        paramsType: [DataType.BigInt, DataType.U32, DataType.U8Array, DataType.U32],
        paramsValue: [windowHandle, attribute, out, out.byteLength],
      }) === 0;

    const rectFrom = (buffer: Buffer): SnipRect => {
      const left = buffer.readInt32LE(0);
      const top = buffer.readInt32LE(4);
      return {
        x: left,
        y: top,
        width: Math.max(0, buffer.readInt32LE(8) - left),
        height: Math.max(0, buffer.readInt32LE(12) - top),
      };
    };

    const text = (funcName: "GetWindowTextW" | "GetClassNameW", windowHandle: bigint): string => {
      const buffer = Buffer.alloc(1024);
      const length = load({
        library: user32,
        funcName,
        retType: DataType.I32,
        paramsType: [DataType.BigInt, DataType.U8Array, DataType.I32],
        paramsValue: [windowHandle, buffer, buffer.byteLength / 2],
      });
      return length > 0 ? buffer.subarray(0, length * 2).toString("utf16le") : "";
    };

    const flag = (funcName: "IsWindowVisible" | "IsIconic", windowHandle: bigint): boolean =>
      load({
        library: user32,
        funcName,
        retType: DataType.Boolean,
        paramsType: [DataType.BigInt],
        paramsValue: [windowHandle],
      });

    return {
      getTopWindow: () =>
        load({
          library: user32,
          funcName: "GetTopWindow",
          retType: DataType.BigInt,
          paramsType: [DataType.BigInt],
          paramsValue: [0n],
        }) as bigint,
      getNextWindow: (windowHandle) =>
        load({
          library: user32,
          funcName: "GetWindow",
          retType: DataType.BigInt,
          paramsType: [DataType.BigInt, DataType.U32],
          paramsValue: [windowHandle, GW_HWNDNEXT],
        }) as bigint,
      isVisible: (windowHandle) => flag("IsWindowVisible", windowHandle),
      isMinimized: (windowHandle) => flag("IsIconic", windowHandle),
      isCloaked: (windowHandle) => {
        const out = Buffer.alloc(4);
        return dwmAttribute(windowHandle, DWMWA_CLOAKED, out) && out.readUInt32LE(0) !== 0;
      },
      getRect: (windowHandle) => {
        const frame = Buffer.alloc(16);
        if (dwmAttribute(windowHandle, DWMWA_EXTENDED_FRAME_BOUNDS, frame)) return rectFrom(frame);
        const rect = Buffer.alloc(16);
        const ok = load({
          library: user32,
          funcName: "GetWindowRect",
          retType: DataType.Boolean,
          paramsType: [DataType.BigInt, DataType.U8Array],
          paramsValue: [windowHandle, rect],
        });
        return ok ? rectFrom(rect) : undefined;
      },
      getTitle: (windowHandle) => text("GetWindowTextW", windowHandle),
      getClassName: (windowHandle) => text("GetClassNameW", windowHandle),
    } satisfies WindowListApi;
  });
  return windowListApiPromise;
}
