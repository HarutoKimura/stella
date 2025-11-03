-- Migration: Add pronunciation assessment fields to fluency_snapshots
-- Run this migration to add support for Azure pronunciation assessment

-- Add pronunciation assessment fields to fluency_snapshots table
alter table public.fluency_snapshots
  add column if not exists pronunciation_score numeric,
  add column if not exists accuracy_score numeric,
  add column if not exists fluency_score numeric,
  add column if not exists prosody_score numeric,
  add column if not exists completeness_score numeric;

-- Add comment to document the fields
comment on column public.fluency_snapshots.pronunciation_score is 'Overall pronunciation score (0-100) from Azure pronunciation assessment';
comment on column public.fluency_snapshots.accuracy_score is 'Pronunciation accuracy score (0-100) - how closely phonemes match native pronunciation';
comment on column public.fluency_snapshots.fluency_score is 'Pronunciation fluency score (0-100) - smoothness and flow of speech';
comment on column public.fluency_snapshots.prosody_score is 'Prosody score (0-100) - naturalness, stress, intonation, rhythm';
comment on column public.fluency_snapshots.completeness_score is 'Completeness score (0-100) - ratio of pronounced words to reference text';
