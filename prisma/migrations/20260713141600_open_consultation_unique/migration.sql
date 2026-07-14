CREATE UNIQUE INDEX "unique_open_consultation"
  ON "Consultation" ("patientId", "doctorId")
  WHERE "status" != 'COMPLETED';
