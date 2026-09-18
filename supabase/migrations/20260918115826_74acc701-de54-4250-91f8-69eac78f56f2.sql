-- 1. Move signature to the correct client record
UPDATE public.client_cession_signatures
SET client_id = '38b8b547-6513-4f78-a630-8c2ef771e945', updated_at = now()
WHERE id = 'de11b7ef-0728-4603-915a-3a6a58cd6497';

-- 2. Carry signing history onto the kept client
UPDATE public.clients
SET cession_signed_at = '2026-09-18T11:08:17.903522+00',
    first_agreement_id = '2234091b-d622-44e7-9368-498b835982e3',
    updated_at = now()
WHERE id = '38b8b547-6513-4f78-a630-8c2ef771e945';

-- 3. Repoint the proposal and refresh its embedded client snapshot
UPDATE public.proposals
SET client_reference_id = '38b8b547-6513-4f78-a630-8c2ef771e945',
    content = jsonb_set(
      content,
      '{clientInfo}',
      COALESCE(content->'clientInfo', '{}'::jsonb)
        || jsonb_build_object(
             'firstName', 'Dave',
             'lastName', 'Wardle',
             'name', 'Dave Wardle',
             'email', 'dave@thomasriver.com',
             'phone', '0826656515',
             'existingClient', true
           )
    ),
    updated_at = now()
WHERE id = 'f1e0ebf9-9881-4400-bf8a-ba2f32cabe52';

-- 4. Remove the now-duplicate additional-client entry
DELETE FROM public.proposal_clients
WHERE id = '6e1571d3-97be-43dd-ae34-be5cc233daf5';

-- 5. Delete the duplicate contact record
DELETE FROM public.clients
WHERE id = '276df296-0710-4b6b-9ad0-54291b40b75a';