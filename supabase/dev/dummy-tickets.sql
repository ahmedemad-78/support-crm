-- DEV ONLY: realistic sample tickets for the Moderation and Call Center accounts.
-- Run in Supabase -> SQL Editor AFTER migration 20260926194042_optional_fields_and_huawei.sql.
-- Uses the first Moderation, Call Center and Technical Support users it finds.
-- Triggers are skipped (session_replication_role = replica) so tickets can have past dates,
-- statuses and history; the fields they would normally fill are set explicitly below.

set session_replication_role = replica;

do $$
declare
  mod_id uuid := (select id from public.profiles where role = 'moderation' and is_active order by created_at limit 1);
  cc_id uuid := (select id from public.profiles where role = 'call_center' and is_active order by created_at limit 1);
  agent_id uuid := (select id from public.profiles where role = 'support_agent' and is_active order by created_at limit 1);
  ticket_year int := 2026;
  n int := coalesce((select last_value from public.ticket_counters where year = 2026), 0);
  r record;
  cust uuid;
  tid uuid;
  created timestamptz;
  creator uuid;
begin
  if mod_id is null or cc_id is null or agent_id is null then
    raise exception 'Create at least one Moderation, one Call Center and one Technical Support user first';
  end if;

  for r in
    select * from (values
      -- source, name, email, username, school, city, user type, fawry, platform, latest, version, device, page, steps, description, status, days ago, hours to resolve, category, root cause, action taken
      ('moderation', 'Salma Hany', 'salma.hany@gmail.com', 'salma.h.2014', 'El Nasr Language School', 'Alexandria', 'parent', true, 'android', true, '4.2.1', 'Oppo A57', 'Subscriptions → Payment status', 'Paid the annual plan at a Fawry outlet on Sep 25 (ref 7731 0492). App still shows "Unpaid".', 'Fawry payment done but package not activated', 'new', 0.02, null::numeric, null, null, null),
      ('moderation', 'Nadine Samy', 'nadine.samy@hotmail.com', 'nadine.s', 'Modern Education School', 'Cairo', 'parent', true, 'huawei', true, '4.2.1', 'Huawei Nova 9', 'Login', 'Enter username and password, spinner never stops.', 'Can''t log in on Huawei phone, keeps loading', 'new', 0.08, null, null, null, null),
      ('moderation', 'Youssef Tarek', 'y.tarek@outlook.com', 'youssef.t.parent', 'Manarat Al Giza School', 'Giza', 'parent', false, 'android', false, '4.1.8', 'Samsung Galaxy A32', 'Grade 3 → Math → Unit 2 videos', 'Open child profile → Grade 3 → Math → Unit 2 → play any lesson video.', 'Video lessons freeze on the Grade 3 Math page', 'in_progress', 0.3, null, 'Video playback', 'Content link broken', null),
      ('moderation', 'Hana Mostafa', 'hana.m@yahoo.com', 'hana.mostafa', 'Al Salam Private School', 'Cairo', 'student', false, 'ios', true, '4.2.1', 'iPhone 12', 'Exams → Results', 'Finish the Science exam, then open Results.', 'Exam results page shows a blank screen on iOS', 'in_progress', 0.5, null, 'Exams & results', 'Server error', null),
      ('moderation', 'Adel Sobhy', 'adel.sobhy@nileschool.edu.eg', 'adel.teacher', 'Nile Language School', 'Sharqia', 'teacher', false, 'web', true, '4.2.1', 'Chrome on Windows', 'Homework → Upload', 'Upload a 6 MB PDF to Grade 5 homework.', 'Teacher can''t upload homework PDF', 'awaiting_customer', 1.1, null, 'Account & profile data', 'User error / guidance given', null),
      ('moderation', 'Mona Rashad', 'mona.rashad@gmail.com', 'mona.r', null, 'Alexandria', 'parent', true, 'ios', false, '4.1.9', 'iPhone 11', 'Subscriptions', null, 'Charged twice for the monthly plan', 'awaiting_customer', 2.3, null, 'Payments & Fawry', 'Fawry payment not synced', null),
      ('moderation', 'Malak Hisham', 'malak.h2012@gmail.com', 'malak.hisham', 'Future Language School', 'Dakahlia', 'student', true, 'android', true, '4.2.1', 'Xiaomi Redmi Note 11', 'Profile', null, 'Wrong grade shown on student profile', 'resolved', 2.6, 5.5, 'Account & profile data', 'Wrong school or grade on profile', 'Corrected the grade from Grade 4 to Grade 5.'),
      ('moderation', 'Laila Ibrahim', 'laila.ib@gmail.com', 'laila.ib', 'Cairo English School', 'Cairo', 'parent', false, 'android', true, '4.2.1', 'Samsung Galaxy S21', 'Login → Forgot password', 'Request a reset link, nothing arrives (checked spam).', 'Password reset email never arrives', 'resolved', 3.4, 2.1, 'Login & access', 'Wrong password / forgotten login', 'Reset the password manually and shared it with the parent.'),
      ('moderation', 'Ziad Ashraf', 'ziad.ashraf@gmail.com', 'ziad.ash', null, 'Qalyubia', 'student', false, 'android', false, '4.0.3', 'Samsung Galaxy A12', null, 'Open the app after the Android 14 update.', 'App crashes on launch after Android update', 'closed', 5.2, 3.0, 'App crash', 'Outdated app version', 'Asked to update to 4.2.1 from Play Store; confirmed working.'),
      ('moderation', 'Karim Wael', 'karim.wael10@gmail.com', 'karimwael', 'El Orman School', 'Giza', 'student', false, 'ios', true, '4.2.1', 'iPad (9th gen)', 'Science → Unit 4 quiz', 'Start the quiz, timer stays at 00:00.', 'Quiz timer freezes at 00:00', 'resolved', 7.1, 16.0, 'Exams & results', 'Server error', 'Backend fix deployed; quiz attempt reset for the student.'),
      ('moderation', 'Rania Fouad', 'rania.fouad@gmail.com', 'rania.parent', 'Al Hayah School', 'Monufia', 'parent', true, 'android', true, '4.2.1', 'Oppo Reno 6', 'Subscriptions → Fawry', null, 'Fawry code expired before paying', 'closed', 12.4, 1.5, 'Payments & Fawry', 'Fawry payment not synced', 'Generated a new Fawry code; payment confirmed.'),
      ('moderation', 'Omar Nabil', 'omar.nabil@gmail.com', 'omar.n.2013', null, 'Beheira', 'student', false, 'web', true, '4.2.1', 'Chrome on laptop', 'Login', null, 'Student forgot password and can''t reach the parent''s email', 'closed', 18.2, 4.0, 'Login & access', 'Wrong password / forgotten login', 'Verified the parent by phone and reset the password.'),

      ('call_center', 'Salma Hany', 'salma.hany@gmail.com', 'salma.h.2014', 'El Nasr Language School', 'Alexandria', 'parent', true, 'android', true, '4.2.1', 'Oppo A57', 'Subscriptions', null, 'Called again: package still not active after Fawry payment', 'new', 0.01, null, null, null, null),
      ('call_center', 'Sherif Kamal', 'sherif.kamal@gmail.com', 'sherif.k', 'Al Azhar Institute', 'Sohag', 'parent', true, 'android', true, '4.2.1', 'Samsung Galaxy A13', 'Subscriptions', null, 'Subscription not showing after payment', 'new', 0.15, null, null, null, null),
      ('call_center', 'Nour Hassan', 'nour.hassan@gmail.com', 'nour.h', null, 'Port Said', 'student', false, 'web', true, '4.2.1', 'Chrome', 'Exams → Math final', 'Submit the exam, score shows 0 / 40.', 'Exam submitted but score is zero', 'in_progress', 0.4, null, 'Exams & results', 'Server error', null),
      ('call_center', 'Dina Magdy', 'dina.magdy@yahoo.com', 'dina.magdy', 'Saint Fatima School', 'Cairo', 'teacher', false, 'web', true, '4.2.1', 'Edge on Windows', 'Classes → Students', null, 'Teacher can''t see class list', 'in_progress', 1.0, null, 'Account & profile data', 'Server error', null),
      ('call_center', 'Heba Ramadan', 'heba.ramadan@gmail.com', 'heba.r', 'Al Nahda School', 'Damietta', 'parent', true, 'ios', true, '4.2.1', 'iPhone 14', 'Subscriptions → Checkout', 'Enter promo code SEPT26 at checkout.', 'Promo code not accepted at checkout', 'awaiting_customer', 0.8, null, 'Payments & Fawry', 'User error / guidance given', null),
      ('call_center', 'Ahmed Fathy', 'ahmed.fathy84@gmail.com', 'ahmed.f.parent', 'Al Nour School', 'Cairo', 'parent', false, 'android', true, '4.2.1', 'Samsung Galaxy A52', 'Homework', 'Parent account → child → Homework tab is empty.', 'Parent account can''t see child''s homework', 'awaiting_customer', 1.3, null, 'Account & profile data', 'Wrong school or grade on profile', null),
      ('call_center', 'Mostafa Adel', 'mostafa.adel@gmail.com', 'mostafa.adel', null, 'Giza', 'parent', true, 'android', true, '4.2.1', 'Realme 9', 'Subscriptions', null, 'Duplicate charge on Fawry for the annual plan', 'closed', 3.2, 20.0, 'Payments & Fawry', 'Fawry payment not synced', 'Second charge reversed by Fawry; customer confirmed.'),
      ('call_center', 'Tamer Hosny Ali', 'tamer.hosny@gmail.com', 'tamer.h', 'Al Rowad School', 'Suez', 'parent', false, 'huawei', false, '4.1.5', 'Huawei Y9', 'Login', null, 'Account shows "suspended" after renewal', 'resolved', 4.1, 7.5, 'Login & access', 'Fawry payment not synced', 'Payment matched manually; account reactivated.'),
      ('call_center', 'Hassan Ali', 'hassan.ali77@gmail.com', 'hassan.ali', null, 'Asyut', 'student', false, 'android', false, '3.9.2', 'Oppo A15', 'Videos', null, 'Videos play without sound', 'resolved', 6.3, 26.0, 'Video playback', 'Device not supported', 'Explained the minimum supported version; audio works on 4.2.1.'),
      ('call_center', 'Yara Mohamed', 'yara.moh@gmail.com', 'yara.m2011', 'El Shorouk School', 'Ismailia', 'student', true, 'ios', true, '4.2.1', 'iPhone 13', 'Grade 6 → Arabic → Book PDF', null, 'Can''t download the Arabic book PDF', 'closed', 9.2, 9.0, 'Video playback', 'Content link broken', 'Content team re-uploaded the PDF.'),
      ('call_center', 'Aya Samir', 'aya.samir@gmail.com', 'aya.s', 'Al Fayrouz School', 'Faiyum', 'parent', false, 'android', true, '4.2.1', 'Vivo Y21', 'Login', null, 'Two accounts for the same child', 'resolved', 10.4, 12.0, 'Account & profile data', 'Duplicate account', 'Merged into one account and kept the paid one.'),
      ('call_center', 'Khaled Mansour', 'khaled.mansour@gmail.com', 'khaled.m', null, 'Minya', 'student', false, 'android', false, '4.0.1', 'Samsung Galaxy J7', null, null, 'App closes immediately on an older phone', 'closed', 20.3, 30.0, 'App crash', 'Device not supported', 'Suggested using the web version.')
    ) as v(source, customer_name, email, username, school, city, user_type, fawry, platform, latest, app_version, device, page, steps, description, status, days_ago, resolve_hours, category, root_cause, action_taken)
    order by days_ago desc
  loop
    n := n + 1;
    created := now() - make_interval(secs => (r.days_ago * 86400)::int);
    creator := case when r.source = 'moderation' then mod_id else cc_id end;

    select id into cust from public.customers where lower(email) = lower(r.email) limit 1;
    if cust is null then
      insert into public.customers (name, email, created_at) values (r.customer_name, r.email, created) returning id into cust;
    end if;

    insert into public.tickets (
      ticket_number, source, status, created_by, customer_id, assignee_id,
      customer_name, customer_email, school_name, credentials_username, issue_date, city_id,
      end_user_type, fawry_payment, platform, is_latest_version, app_version, device_type, page_screen, steps,
      issue_description, issue_category_id, root_cause_id, action_taken,
      created_at, updated_at, resolved_at, closed_at
    ) values (
      'TKT-' || ticket_year || '-' || lpad(n::text, 5, '0'),
      r.source::public.ticket_source, r.status::public.ticket_status, creator, cust,
      case when r.status = 'new' then null else agent_id end,
      r.customer_name, r.email, r.school, r.username, (created at time zone 'Africa/Cairo')::date,
      (select id from public.cities where name = r.city),
      r.user_type::public.end_user_type, r.fawry, r.platform::public.app_platform, r.latest, r.app_version, r.device, r.page, r.steps,
      r.description,
      (select id from public.issue_categories where name = r.category),
      (select id from public.root_causes where name = r.root_cause),
      r.action_taken,
      created, created,
      case when r.status in ('resolved', 'closed') then created + make_interval(secs => (r.resolve_hours * 3600)::int) end,
      case when r.status = 'closed' then created + make_interval(secs => ((r.resolve_hours + 24) * 3600)::int) end
    ) returning id into tid;

    insert into public.ticket_status_history (ticket_id, from_status, to_status, changed_by, changed_at)
    values (tid, null, 'new', creator, created);

    if r.status <> 'new' then
      insert into public.ticket_status_history (ticket_id, from_status, to_status, changed_by, changed_at)
      values (tid, 'new', 'in_progress', agent_id, created + interval '40 minutes');
    end if;
    if r.status = 'awaiting_customer' then
      insert into public.ticket_status_history (ticket_id, from_status, to_status, changed_by, changed_at)
      values (tid, 'in_progress', 'awaiting_customer', agent_id, created + interval '3 hours');
    end if;
    if r.status in ('resolved', 'closed') then
      insert into public.ticket_status_history (ticket_id, from_status, to_status, changed_by, changed_at)
      values (tid, 'in_progress', 'resolved', agent_id, created + make_interval(secs => (r.resolve_hours * 3600)::int));
    end if;
    if r.status = 'closed' then
      insert into public.ticket_status_history (ticket_id, from_status, to_status, changed_by, changed_at)
      values (tid, 'resolved', 'closed', agent_id, created + make_interval(secs => ((r.resolve_hours + 24) * 3600)::int));
    end if;
  end loop;

  insert into public.ticket_counters (year, last_value) values (ticket_year, n)
  on conflict (year) do update set last_value = excluded.last_value;
end;
$$;

set session_replication_role = origin;
