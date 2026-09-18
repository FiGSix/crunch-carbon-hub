DO $$
DECLARE
  old_client uuid := '1e3528af-b8d2-4939-82d9-705cdd7e1648';
  new_client uuid;
  titles text[] := ARRAY[
    'Durbanville Primary School','Panorama Primary School','Gene Louw Primary School',
    'ABSA Building (ABSA Forum Building)','Adcock Building','Tessara (Phase 1)',
    'Tessara Expansion (Phase 2)','Grenville High School (school + hostel)','Rooipan (farm)',
    'Kimberley Portfolio - Police Station Kimberley','Kimberley Portfolio - Standard Bank Building Kimberley',
    'Kimberley Portfolio - Stage House','Kimberley Portfolio - George House (battery backup)',
    'Wesbank Building','AH Hotel','Die Watergat','Rabboni Christian School (school + hostel)',
    'Olifantsnek Garage','Spar Jacobsdal','Speedy Dollar (Phase 1)','Cottonwood Guesthouse',
    'Speedy Group - Cecil Nurse Building','Speedy Group - 45 Pres Reitz Str',
    'Speedy Group - 43 Pres Reitz Str','Speedy Group - 51 Pres Reitz Str',
    'Speedy Group - Brill Str Building','Speedy Group - 9 Innes Ave','Eplazini Lifestyle Centre',
    'Tweeling Boerdery','Lannies Hardware','Aliwal Metro & Distribution - Aliwal Distribution Centre',
    'Aliwal Metro & Distribution - Metro Fruit and Veg',
    'Weird Industries - 3 Delfos Ave (Alrode South Distributors)',
    'Weird Industries - 5 Delfos Ave (Alrode South Distributors)',
    'Weird Industries - 10 Wildehond Road','Weird Industries - 15 Hadrian Way',
    'Weird Industries - 259 Barkly Road','Weird Industries - 28 Apian Way',
    'Weird Industries - 59 Petrus Street','Hoogenhoudt (Hoogenhout) High School',
    'Thusano Funerals (Thusano Help U) - multiple sites','Gene Louw Primary - Extension',
    'Homsek - Dairy (Newlands Farm)','Homsek - Donkerhoek (Newlands Farm)','Homsek - Hopefield Farm',
    'Homsek - Uithoek Farm','Aliwal Technical College (ANTOS)','Goldfields Nursing Care'
  ];
  moved int;
BEGIN
  INSERT INTO public.clients (first_name, last_name, email, phone, company_name, registration_number, created_by)
  SELECT first_name, last_name, 'hope@artemiscapital.co.za', phone,
         'Aggregator SA (Pty) Ltd', '2021/969774/07', created_by
  FROM public.clients WHERE id = old_client
  RETURNING id INTO new_client;

  UPDATE public.proposals p
  SET client_reference_id = new_client,
      content = jsonb_set(
        jsonb_set(
          jsonb_set(
            COALESCE(p.content, '{}'::jsonb),
            '{clientInfo}', COALESCE(p.content->'clientInfo', '{}'::jsonb), true),
          '{clientInfo,companyName}', '"Aggregator SA (Pty) Ltd"', true),
        '{clientInfo,email}', '"hope@artemiscapital.co.za"', true)
        || jsonb_build_object('clientInfo',
             COALESCE(p.content->'clientInfo','{}'::jsonb)
             || jsonb_build_object(
                  'companyName','Aggregator SA (Pty) Ltd',
                  'registrationNumber','2021/969774/07',
                  'email','hope@artemiscapital.co.za')),
      updated_at = now()
  WHERE p.client_reference_id = old_client
    AND p.deleted_at IS NULL
    AND p.title = ANY(titles);

  GET DIAGNOSTICS moved = ROW_COUNT;
  IF moved <> 48 THEN
    RAISE EXCEPTION 'Expected 48 projects to move, got %', moved;
  END IF;

  UPDATE public.proposal_clients pc
  SET client_id = new_client
  WHERE pc.client_id = old_client
    AND pc.proposal_id IN (SELECT id FROM public.proposals WHERE client_reference_id = new_client);
END $$;