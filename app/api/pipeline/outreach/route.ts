// Phase 4: On-Demand Outreach Generation
// Called per-doctor when user clicks "Generate Outreach" button

import { NextResponse } from "next/server";
import { generateOutreach } from "../../../../lib/outreach-generator";
import { VerifiedDoctor } from "../../../../lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const doctor: VerifiedDoctor = body.doctor;

    if (!doctor) {
      return NextResponse.json({ error: "doctor is required" }, { status: 400 });
    }

    const { assets, cost } = await generateOutreach(doctor);

    if (!assets) {
      return NextResponse.json(
        { error: "Failed to generate outreach" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      assets,
      costs: { sonnet: cost },
    });
  } catch (error) {
    console.error("Outreach generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Outreach generation failed" },
      { status: 500 }
    );
  }
}
