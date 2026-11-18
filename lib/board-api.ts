import type { AppState } from "./types";

export type BoardResponse = {
  state: AppState;
  updatedAt: string;
  // Token for the exact server copy, echoed back as a save precondition.
  version: string;
};

// Raised when another tab or a teammate saved first. The payload carries the
// server's current copy so the board can offer to load it.
export class BoardConflictError extends Error {
  readonly board: BoardResponse;

  constructor(board: BoardResponse) {
    super("The board changed elsewhere before this save.");
    this.name = "BoardConflictError";
    this.board = board;
  }
}

function toBoard(body: Partial<BoardResponse>): BoardResponse | null {
  if (!body.state) return null;
  return {
    state: body.state,
    updatedAt: String(body.updatedAt ?? ""),
    version: String(body.version ?? ""),
  };
}

export async function fetchBoard(
  signal?: AbortSignal,
): Promise<BoardResponse | null> {
  const response = await fetch("/api/board", {
    cache: "no-store",
    signal,
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Could not load the saved board (${response.status}).`);
  }

  const body = (await response.json()) as Partial<BoardResponse>;
  const board = toBoard(body);
  if (!board) throw new Error("The saved board response is incomplete.");
  return board;
}

// `expectedVersion` asks the server to reject the write if the file changed
// since this tab last read it. Omit it for the first save, which has no base.
export async function saveBoard(
  state: AppState,
  expectedVersion?: string | null,
): Promise<BoardResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (expectedVersion) headers["If-Match"] = `"${expectedVersion}"`;

  const response = await fetch("/api/board", {
    method: "PUT",
    headers,
    body: JSON.stringify(state),
  });

  if (response.status === 409) {
    const body = (await response.json().catch(() => ({}))) as Partial<BoardResponse>;
    const board = toBoard(body);
    if (board) throw new BoardConflictError(board);
    throw new Error("The board changed elsewhere and could not be reloaded.");
  }

  if (!response.ok) {
    throw new Error(`Could not save the board (${response.status}).`);
  }

  const body = (await response.json().catch(() => null)) as
    | Partial<BoardResponse>
    | null;
  const board = body ? toBoard(body) : null;
  if (!board) throw new Error("The saved board response is incomplete.");
  return board;
}
