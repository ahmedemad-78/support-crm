-- Starter values for Settings. The admin edits them from Settings; nothing here is final.

insert into public.cities (name, sort_order) values
  ('Cairo', 1), ('Giza', 2), ('Alexandria', 3), ('Qalyubia', 4), ('Sharqia', 5),
  ('Dakahlia', 6), ('Gharbia', 7), ('Monufia', 8), ('Beheira', 9), ('Kafr El Sheikh', 10),
  ('Damietta', 11), ('Port Said', 12), ('Ismailia', 13), ('Suez', 14), ('Faiyum', 15),
  ('Beni Suef', 16), ('Minya', 17), ('Asyut', 18), ('Sohag', 19), ('Qena', 20),
  ('Luxor', 21), ('Aswan', 22), ('Red Sea', 23), ('New Valley', 24), ('Matrouh', 25),
  ('North Sinai', 26), ('South Sinai', 27)
on conflict do nothing;

insert into public.issue_categories (name) values
  ('Login & access'), ('Payments & Fawry'), ('Video playback'),
  ('Exams & results'), ('Account & profile data'), ('App crash')
on conflict do nothing;

insert into public.root_causes (name) values
  ('Wrong password / forgotten login'), ('Fawry payment not synced'), ('Outdated app version'),
  ('Content link broken'), ('Wrong school or grade on profile'), ('Device not supported'),
  ('Server error'), ('User error / guidance given'), ('Duplicate account')
on conflict do nothing;
