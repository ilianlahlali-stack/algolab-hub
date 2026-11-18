-- AlgoLab hub : synchro du Drive toutes les 15 minutes (pg_cron + pg_net, dans Supabase).
-- À lancer APRÈS le déploiement sur Vercel. Remplace les deux valeurs en majuscules, SANS les commiter :
-- le secret doit rester entre Supabase et Vercel (variable CRON_SECRET).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'algolab-drive-sync',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := 'https://VOTRE-APP.vercel.app/api/cron/drive-sync',
    headers := jsonb_build_object('Authorization', 'Bearer VOTRE_CRON_SECRET'),
    timeout_milliseconds := 60000
  );
  $$
);

-- Pour vérifier : select * from cron.job_run_details order by start_time desc limit 5;
-- Pour arrêter :   select cron.unschedule('algolab-drive-sync');
