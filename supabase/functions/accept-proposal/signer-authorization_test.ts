import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { authorizeCompanySigner, resolveStoredSignatoryName } from './signer-authorization.ts';

const memberships = [
  { user_id: 'juan', status: 'active', can_sign_agreements: false },
  { user_id: 'naazia', status: 'active', can_sign_agreements: true },
];

Deno.test('authorised active company member can sign', () => {
  assertEquals(authorizeCompanySigner({ companyId: 'rhino', authenticatedUserId: 'naazia', memberships }).allowed, true);
});

Deno.test('member with signing disabled cannot sign', () => {
  const result = authorizeCompanySigner({ companyId: 'rhino', authenticatedUserId: 'juan', memberships });
  assertEquals(result.allowed, false);
  assertEquals(result.requiresAuthentication, false);
});

Deno.test('managed company cannot be signed through an anonymous token', () => {
  const result = authorizeCompanySigner({ companyId: 'rhino', authenticatedUserId: null, memberships });
  assertEquals(result.allowed, false);
  assertEquals(result.requiresAuthentication, true);
});

Deno.test('unmanaged recipient can continue to use direct token signing', () => {
  assertEquals(authorizeCompanySigner({ companyId: 'external', authenticatedUserId: null, memberships: [] }).allowed, true);
});

Deno.test('authenticated profile name overrides caller supplied signer name', () => {
  assertEquals(resolveStoredSignatoryName('Naazia Hassan', 'Juan Mallinson'), 'Naazia Hassan');
});