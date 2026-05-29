import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const CATALOG_DIR = path.join(process.cwd(), "data", "catalog");

const ALLOWED_FILENAME = /^inspect-[a-z0-9-]+\.png$/;

type RouteContext = { params: Promise<{ filename: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { filename } = await context.params;

  if (!ALLOWED_FILENAME.test(filename)) {
    return NextResponse.json({ error: "Sample not found." }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(path.join(CATALOG_DIR, filename));
  } catch {
    return NextResponse.json({ error: "Sample not found." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
