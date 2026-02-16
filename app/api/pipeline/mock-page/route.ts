// Phase 4B: Mock Landing Page Generation
// Generates a mock Future Clinic page for a verified doctor

import { NextResponse } from "next/server";
import { generateMockPage } from "../../../../lib/mock-page-generator";
import { VerifiedDoctor } from "../../../../lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const doctor: VerifiedDoctor = body.doctor;

    if (!doctor) {
      return NextResponse.json({ error: "doctor is required" }, { status: 400 });
    }

    const mockPage = generateMockPage(doctor);

    return NextResponse.json({ mockPage });
  } catch (error) {
    console.error("Mock page generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Mock page generation failed" },
      { status: 500 }
    );
  }
}
