import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPurchaseToken, validatePurchaseToken} from '../purchase-access.mjs';

const secret = 'test-purchase-secret-that-is-at-least-32-characters';

test('private purchase tokens are signed, email-bound and expire', async () => {
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const token = await createPurchaseToken(secret, {
    email: 'Buyer@Example.com',
    name: 'Test Buyer',
    maxQuantity: 3,
    expiresAt,
  });
  const invitation = await validatePurchaseToken(secret, token);
  assert.equal(invitation.email, 'buyer@example.com');
  assert.equal(invitation.name, 'Test Buyer');
  assert.equal(invitation.maxQuantity, 3);
  assert.equal(await validatePurchaseToken(secret, `${token}changed`), null);
  const expired = await createPurchaseToken(secret, {
    email: 'buyer@example.com',
    maxQuantity: 1,
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  });
  assert.equal(await validatePurchaseToken(secret, expired), null);
});
