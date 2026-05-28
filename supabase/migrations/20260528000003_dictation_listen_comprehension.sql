-- 20260528000003 — Add listen_comprehension to dictation_responses.question_type CHECK
-- Needed for the new Listening Comprehension section (~30s audio + 4 MC options)

ALTER TABLE dictation_responses
  DROP CONSTRAINT IF EXISTS dictation_responses_question_type_check;

ALTER TABLE dictation_responses
  ADD CONSTRAINT dictation_responses_question_type_check
    CHECK (question_type IN (
      'listen_type',
      'listen_identify',
      'fill_blank',
      'matching',
      'writing',
      'listen_comprehension'
    ));
