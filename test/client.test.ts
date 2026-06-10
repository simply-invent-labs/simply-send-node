import { test, mock } from 'node:test';
import assert from 'node:assert';
import {
  SimplySendTransactionalClient,
  SimplySendMarketingClient,
  SimplySendWebSetupClient,
} from '../src/client';
import { SimplySendValidationError, SimplySendHttpError } from '../src/errors';

// ============================================================================
// 1. SimplySendTransactionalClient Tests
// ============================================================================
test('SimplySendTransactionalClient', async (t) => {
  await t.test('should throw error if accountId is missing', () => {
    assert.throws(
      () => new SimplySendTransactionalClient({ accountId: '', apiKey: 'key_123' }),
      (err: any) => err instanceof SimplySendValidationError && err.field === 'accountId'
    );
  });

  await t.test('should throw error if apiKey is missing', () => {
    assert.throws(
      () => new SimplySendTransactionalClient({ accountId: 'acc_123', apiKey: '' }),
      (err: any) => err instanceof SimplySendValidationError && err.field === 'apiKey'
    );
  });

  await t.test('should validate send payload inputs', async () => {
    const client = new SimplySendTransactionalClient({ accountId: 'acc_123', apiKey: 'key_123' });
    
    await assert.rejects(
      () => client.email.send({ to: '', subject: 'test', html: 'test', from: 'sender@test.com' }),
      (err: any) => err instanceof SimplySendValidationError && err.field === 'to'
    );

    await assert.rejects(
      () => client.email.send({ to: 'to@test.com', subject: '', html: 'test', from: 'sender@test.com' }),
      (err: any) => err instanceof SimplySendValidationError && err.field === 'subject'
    );
  });

  await t.test('should send transactional email with headers and encode Buffer attachments to base64', async () => {
    const client = new SimplySendTransactionalClient({
      accountId: 'acc_123',
      apiKey: 'tapi_key_abc',
    });

    const fetchMock = mock.fn(async (url: any, options: any) => {
      assert.strictEqual(url, 'https://tapi.simplysend.email/send');
      assert.strictEqual(options.method, 'POST');
      assert.strictEqual(options.headers['X-Api-Key'], 'tapi_key_abc');
      assert.strictEqual(options.headers['X-Id'], 'acc_123');

      const body = JSON.parse(options.body);
      assert.strictEqual(body.to, 'recipient@example.com');
      assert.strictEqual(body.subject, 'Test subject');
      assert.strictEqual(body.attachments[0].name, 'doc.txt');
      assert.strictEqual(body.attachments[0].contentType, 'text/plain');
      // Buffer of 'hello' base64 encoded is 'aGVsbG8='
      assert.strictEqual(body.attachments[0].content, 'aGVsbG8=');

      return new Response(JSON.stringify({ success: true, data: { messageId: 'msg_999' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    global.fetch = fetchMock as any;

    const res = await client.email.send({
      to: 'recipient@example.com',
      from: 'sender@domain.com',
      subject: 'Test subject',
      html: '<h1>Hello</h1>',
      attachments: [
        {
          name: 'doc.txt',
          contentType: 'text/plain',
          content: Buffer.from('hello'),
        },
      ],
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data?.messageId, 'msg_999');
    mock.restoreAll();
  });
});

// ============================================================================
// 2. SimplySendMarketingClient Tests
// ============================================================================
test('SimplySendMarketingClient', async (t) => {
  await t.test('should throw error if accountId is missing', () => {
    assert.throws(
      () => new SimplySendMarketingClient({ accountId: '', apiKey: 'key_123' }),
      (err: any) => err instanceof SimplySendValidationError && err.field === 'accountId'
    );
  });

  await t.test('should throw error if apiKey is missing', () => {
    assert.throws(
      () => new SimplySendMarketingClient({ accountId: 'acc_123', apiKey: '' }),
      (err: any) => err instanceof SimplySendValidationError && err.field === 'apiKey'
    );
  });

  await t.test('should validate subscriptionGroupId', async () => {
    const client = new SimplySendMarketingClient({ accountId: 'acc_123', apiKey: 'key_123' });
    await assert.rejects(
      () => client.email.send({
        to: 'rec@test.com',
        from: 'sender@domain.com',
        subject: 'sub',
        html: 'html',
        subscriptionGroupId: '',
      }),
      (err: any) => err instanceof SimplySendValidationError && err.field === 'subscriptionGroupId'
    );
  });

  await t.test('should send marketing email', async () => {
    const client = new SimplySendMarketingClient({
      accountId: 'acc_123',
      apiKey: 'mapi_key_xyz',
    });

    const fetchMock = mock.fn(async (url: any, options: any) => {
      assert.strictEqual(url, 'https://mapi.simplysend.email/send');
      assert.strictEqual(options.headers['X-Api-Key'], 'mapi_key_xyz');
      assert.strictEqual(options.headers['X-Id'], 'acc_123');

      const body = JSON.parse(options.body);
      assert.strictEqual(body.subscriptionGroupId, 'group_99');

      return new Response(JSON.stringify({ success: true, data: { messageId: 'msg_888' } }), { status: 200 });
    });

    global.fetch = fetchMock as any;

    const res = await client.email.send({
      to: 'rec@test.com',
      from: 'sender@domain.com',
      subject: 'sub',
      html: 'html',
      subscriptionGroupId: 'group_99',
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data?.messageId, 'msg_888');
    mock.restoreAll();
  });
});

// ============================================================================
// 3. SimplySendWebSetupClient Tests
// ============================================================================
test('SimplySendWebSetupClient', async (t) => {
  await t.test('should throw error if accountId is missing', () => {
    assert.throws(
      () => new SimplySendWebSetupClient({ accountId: '', apiKey: 'key_123' }),
      (err: any) => err instanceof SimplySendValidationError && err.field === 'accountId'
    );
  });

  await t.test('should throw error if apiKey is missing', () => {
    assert.throws(
      () => new SimplySendWebSetupClient({ accountId: 'acc_123', apiKey: '' }),
      (err: any) => err instanceof SimplySendValidationError && err.field === 'apiKey'
    );
  });

  await t.test('should authenticate with apiKey', async () => {
    const client = new SimplySendWebSetupClient({
      accountId: 'acc_123',
      apiKey: 'wapi_key_789',
    });

    const fetchMock = mock.fn(async (url: any, options: any) => {
      assert.strictEqual(url, 'https://wapi.simplysend.email/web-setup/domains');
      assert.strictEqual(options.headers['X-Api-Key'], 'wapi_key_789');
      assert.strictEqual(options.headers['X-Id'], 'acc_123');
      return new Response(JSON.stringify([]), { status: 200 });
    });

    global.fetch = fetchMock as any;

    const res = await client.domains.list();
    assert.deepStrictEqual(res, []);
    mock.restoreAll();
  });
});

// ============================================================================
// 4. HTTP Errors & Wrapping
// ============================================================================
test('SimplySend Client Error Wrapping', async (t) => {
  await t.test('should wrap non-2xx responses into SimplySendHttpError', async () => {
    const client = new SimplySendWebSetupClient({
      accountId: 'acc_123',
      apiKey: 'wapi_key_789',
    });

    const fetchMock = mock.fn(async () => {
      return new Response(
        JSON.stringify({
          error: 'Account Suspended',
          message: 'Your account is suspended.',
          reasonCode: 'ACCOUNT_SUSPENDED',
        }),
        { status: 403 }
      );
    });

    global.fetch = fetchMock as any;

    await assert.rejects(
      () => client.getUseCases(),
      (err: any) => {
        return (
          err instanceof SimplySendHttpError &&
          err.statusCode === 403 &&
          err.reasonCode === 'ACCOUNT_SUSPENDED' &&
          err.message === 'Account Suspended'
        );
      }
    );

    mock.restoreAll();
  });
});
