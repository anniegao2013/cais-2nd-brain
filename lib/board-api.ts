import type { AppState } from "./types";

export type BoardResponse = {
  state: AppState;
  updatedAt: string;
};

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
  if (!body.state) throw new Error("The saved board response is incomplete.");
  return {
    state: body.state,
    updatedAt: String(body.updatedAt ?? ""),
  };
}

export async function saveBoard(state: AppState): Promise<void> {
  const response = await fetch("/api/board", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });

  if (!response.ok) {
    throw new Error(`Could not save the board (${response.status}).`);
  }
}
