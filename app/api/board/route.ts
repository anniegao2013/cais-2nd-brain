import { normalizeStorage } from "@/lib/storage";
import { readBoard, writeBoard } from "@/lib/server/board-store";
import type { AppState } from "@/lib/types";

const MAX_BODY_BYTES = 2_000_000;

export async function GET() {
  try {
    const board = await readBoard();
    if (!board) {
      return Response.json(
        { state: null, updatedAt: null },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(board, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Could not read the saved board.", error);
    return Response.json(
      { error: "Could not read the saved board." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function PUT(request: Request) {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return Response.json(
      { error: "Could not read the board payload." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!raw || raw.length > MAX_BODY_BYTES) {
    return Response.json(
      { error: "The board payload is empty or too large." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  let state: AppState;
  try {
    state = normalizeStorage(raw);
  } catch {
    return Response.json(
      { error: "The board payload is not valid JSON." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const board = await writeBoard(state);
    return Response.json(board, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Could not save the board.", error);
    return Response.json(
      { error: "Could not save the board." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
