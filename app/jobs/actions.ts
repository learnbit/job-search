"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "../../src/db/prisma";
import { parseApplicationStatus } from "../../src/domain/applicationStatus";
import { JobRepository } from "../../src/repositories/JobRepository";

export async function saveJobTracking(formData: FormData): Promise<void> {
  const identity = {
    source: requireFormString(formData, "source"),
    externalId: requireFormString(formData, "externalId"),
  };
  const status = parseApplicationStatus(formData.get("applicationStatus"));
  const notes = formData.get("notes");

  if (typeof notes !== "string") {
    throw new Error("Invalid notes value");
  }

  await new JobRepository(prisma).updateApplicationTracking(
    identity,
    status,
    notes,
  );
  revalidatePath("/jobs");
}

function requireFormString(formData: FormData, field: string): string {
  const value = formData.get(field);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${field}`);
  }

  return value.trim();
}
