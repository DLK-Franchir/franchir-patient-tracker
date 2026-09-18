-- Modality DICOM (0008,0060) persistée pour libeller les séries (IRM / Scanner…)
alter table public.patient_documents
  add column if not exists modality text;
