-- AlgoLab hub : données d'EXEMPLE entièrement fictives, pour voir l'app remplie après une installation neuve.
-- Facultatif. À lancer après 01-schema.sql. Remplace-les par tes vraies données depuis l'app.

insert into public.sessions (day, title, details, kind, start_time, end_time) values
  ('2026-10-07', 'Séance d''ouverture', 'Salle exemple', 'seance', '12:30', '14:30'),
  ('2026-10-14', 'Rencontre avec un partenaire', 'En visioconférence', 'rdv', '10:00', '11:00'),
  ('2026-10-21', 'Séance AlgoLab', 'Infos à venir', 'seance', '12:30', '14:30');

insert into public.deadlines (title, due, details) values
  ('Rendu d''exemple : compte-rendu et première entrée du journal', '2026-10-28', 'Exemple de deadline avec son breakdown.');

insert into public.tasks (title, owner, due, deadline_id)
select t.title, t.owner, t.due::date, d.id
from public.deadlines d
cross join (values
  ('Rédiger le compte-rendu', 'Camille', '2026-10-26'),
  ('Relire et corriger', 'Alex', '2026-10-27')
) as t(title, owner, due)
where d.title like 'Rendu d''exemple%';

insert into public.people (name, category, role, email, position) values
  ('Camille Exemple', 'Groupe', null, 'camille.exemple@example.org', 10),
  ('Alex Exemple', 'Groupe', null, 'alex.exemple@example.org', 20),
  ('Dominique Exemple', 'Équipe pédagogique', 'Enseignant·e', 'dominique.exemple@example.org', 110),
  ('Sam Exemple', 'Partenaires', 'Chargé·e de projet', null, 210);

insert into public.documents (title, category, kind, url, summary, position) values
  ('Article de référence (exemple)', 'Lectures', 'link', 'https://example.org/article', 'Lecture obligatoire', 10),
  ('Rapport public (exemple)', 'Matériel brut', 'link', 'https://example.org/rapport.pdf', null, 10);

insert into public.documents (title, category, kind, body, position) values
  ('Sigles', 'Informations', 'note', E'- **DSN** : Déclaration sociale nominative\n- **API** : Application Programming Interface', 10);
