import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isPrimaryRecipient, isRetryableBounce } from './bounce-classification.ts';

Deno.test('matches primary recipients without case or whitespace sensitivity', () => {
  assertEquals(isPrimaryRecipient(' Client@Example.com ', 'client@example.com'), true);
  assertEquals(isPrimaryRecipient('agent@example.com', 'client@example.com'), false);
});

Deno.test('only transient bounces are retryable', () => {
  assertEquals(isRetryableBounce({ type: 'Transient', subType: 'MailboxFull' }), true);
  assertEquals(isRetryableBounce({ type: 'Permanent', subType: 'General' }), false);
  assertEquals(isRetryableBounce(undefined), false);
});