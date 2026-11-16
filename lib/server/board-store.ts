import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeStorage } from "../storage";
import type { AppState } from "../types";

export type SavedBoard = {
  state: AppState;
  updatedAt: string;
};

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

export async function readBoard(
  filePath: string = boardFilePath(),
): Promise<SavedBoard | null> {
  try {
    const raw = await readFile(/* turbopackIgnore: true */ filePath, "utf8");
    const info = await stat(/* turbopackIgnore: true */ filePath);
    return {
      state: normalizeStorage(raw),
      updatedAt: info.mtime.toISOString(),
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
  filePath: string = boardFilePath(),
): Promise<SavedBoard> {
  const result = writeQueue.then(() => writeAtomic(state, filePath));
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function writeAtomic(
  state: AppState,
  filePath: string,
): Promise<SavedBoard> {
  const directory = path.dirname(filePath);
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;

  await mkdir(/* turbopackIgnore: true */ directory, { recursive: true });
  try {
    await writeFile(
      /* turbopackIgnore: true */ temporary,
      `${JSON.stringify(state, null, 2)}\n`,
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
  };
}
