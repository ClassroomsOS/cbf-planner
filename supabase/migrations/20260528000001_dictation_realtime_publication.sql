-- Add dictation tables to supabase_realtime publication so postgres_changes events fire
-- Without this, SessionControlPage Realtime subscriptions never receive updates
ALTER PUBLICATION supabase_realtime ADD TABLE dictation_instances;
ALTER PUBLICATION supabase_realtime ADD TABLE dictation_results;
ALTER PUBLICATION supabase_realtime ADD TABLE dictation_sessions;
