import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeStorage } from "../storage";
import type { AppState } from "../types";

export type SavedBoard = {
  state: AppState;
  // ISO timestamp of the write, for display.
  updatedAt: string;
  // A stable token for the exact bytes on disk. Clients send it back as a
  // precondition so a slow tab cannot overwrite a newer copy.
  version: string;
};

export type WriteBoardResult =
  | { written: true; board: SavedBoard }
  | { written: false; current: SavedBoard | null };

// The board is a single-user document, so one JSON file is enough. Set
// BOARD_DATA_FILE to put it on a persistent volume when the app is deployed.
export function boardFilePath(): string {
  return (
    process.env.BOARD_DATA_FILE ??
    path.join(process.cwd(), "data", "board.json")
  );
}

function isNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === "ENOENT";
}

// A content hash identifies a board copy better than a timestamp: two writes in
// the same millisecond still produce different tokens when the board changed.
function versionOf(raw: string): string {
  return createHash("sha256").update(raw).digest("base64url").slice(0, 22);
}

export async function readBoard(
  filePath: string = boardFilePath(),
): Promise<SavedBoard | null> {
  try {
    const raw = await readFile(/* turbopackIgnore: true */ filePath, "utf8");
    const info = await stat(/* turbopackIgnore: true */ filePath);
    return {
      state: normalizeStorage(raw),
      updatedAt: info.mtime.toISOString(),
      version: versionOf(raw),
    };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

// Serialize writes inside this process so two rapid saves cannot interleave.
// The temporary file plus rename keeps a crash from leaving a half-written
// board behind.
let writeQueue: Promise<void> = Promise.resolve();

export function writeBoard(
  state: AppState,
  options: { filePath?: string; expectedVersion?: string } = {},
): Promise<WriteBoardResult> {
  const result = writeQueue.then(() => writeChecked(state, options));
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

// The version check runs inside the write queue, so two requests that read the
// same old copy cannot both pass the precondition.
async function writeChecked(
  state: AppState,
  options: { filePath?: string; expectedVersion?: string },
): Promise<WriteBoardResult> {
  const filePath = options.filePath ?? boardFilePath();

  if (options.expectedVersion !== undefined) {
    const current = await readBoard(filePath);
    if (!current || current.version !== options.expectedVersion) {
      return { written: false, current };
    }
  }

  return { written: true, board: await writeAtomic(state, filePath) };
}

async function writeAtomic(
  state: AppState,
  filePath: string,
): Promise<SavedBoard> {
  const directory = path.dirname(filePath);
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const raw = `${JSON.stringify(state, null, 2)}\n`;

  await mkdir(/* turbopackIgnore: true */ directory, { recursive: true });
  try {
    await writeFile(
      /* turbopackIgnore: true */ temporary,
      raw,
      "utf8",
    );
    await rename(
      /* turbopackIgnore: true */ temporary,
      /* turbopackIgnore: true */ filePath,
    );
  } finally {
    await rm(/* turbopackIgnore: true */ temporary, { force: true }).catch(
      () => undefined,
    );
  }

  const info = await stat(/* turbopackIgnore: true */ filePath);
  return {
    state,
    updatedAt: info.mtime.toISOString(),
    version: versionOf(raw),
  };
}
