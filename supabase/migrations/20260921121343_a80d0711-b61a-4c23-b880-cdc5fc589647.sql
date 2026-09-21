SELECT cron.unschedule('sweep-agreement-documents-hourly');
SELECT cron.schedule(
  'sweep-agreement-documents-hourly',
  '7 * * * *',
  $$SELECT net.http_post(
      url := 'https://uyjryuopuqgmsvayiccl.supabase.co/functions/v1/sweep-agreement-documents',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer b99fcd92b4c6c5f54d460d13a53ff6668c23f820c1c2793eb4cd4ddfa3905558"}'::jsonb,
      body := '{"limit": 25}'::jsonb
    );$$
);