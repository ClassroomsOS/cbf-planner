-- Expand question_type CHECK constraint to include matching and writing
-- (added in assessment modes v2 but DB constraint was never updated)
ALTER TABLE dictation_responses
  DROP CONSTRAINT IF EXISTS dictation_responses_question_type_check;

ALTER TABLE dictation_responses
  ADD CONSTRAINT dictation_responses_question_type_check
  CHECK (question_type IN ('listen_type', 'listen_identify', 'fill_blank', 'matching', 'writing'));
