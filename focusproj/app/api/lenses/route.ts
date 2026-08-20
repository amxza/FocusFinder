import { NextResponse } from "next/server";
import { listLenses } from "../../../lib/services/lensQuery";

// GET /api/lenses
// Returns the full lens catalog. Mainly useful for the frontend lens
// database views (Week 4-5) and for sanity-checking seed data now.
export async function GET() {
  const lenses = await listLenses();
  return NextResponse.json(lenses);
}
