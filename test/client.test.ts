import { test, mock } from 'node:test';
import assert from 'node:assert';
import { SimplySendClient } from '../src/client';
import { SimplySendValidationError, SimplySendHttpError } from '../src/errors';

test('SimplySendClient Initialization', async (t) => {
  await t.test('should throw validation error if accountId is missing', () => {
    assert.throws(
      () => new SimplySendClient({ tapiKey: 'key_123', accountId: '' }),
      (err: any) => err instanceof SimplySendValidationError && err.field === 'accountId'
    );
  });

  await t.test('should throw validation error if all API keys are missing', () => {
    assert.throws(
      () => new SimplySendClient({ accountId: 'acc_abc' }),
      (err: any) => err instanceof SimplySendValidationError && err.field === 'tapiKey'
    );
  });

  await t.test('should initialize with valid settings and default urls', () => {
    const client = new SimplySendClient({ tapiKey: 'key_123', accountId: 'acc_abc' });
    assert.strictEqual(client.getHealth !== undefined, true);
  });
});

test('SimplySendClient Transactional Sends', async (t) => {
  await t.test('should throw error if required send params are missing', async () => {
    const client = new SimplySendClient({ tapiKey: 'key_123', accountId: 'acc_abc' });
    
    await assert.rejects(
      () => client.emails.send({ to: '', subject: 'test', html: 'test', from: 'sender@test.com' }),
      (err: any) => err instanceof SimplySendValidationError && err.field === 'to'
    );

    await assert.rejects(
      () => client.emails.send({ to: 'to@test.com', subject: '', html: 'test', from: 'sender@test.com' }),
      (err: any) => err instanceof SimplySendValidationError && err.field === 'subject'
    );
  });

  await t.test('should map payload and encode Buffer attachments to base64', async () => {
    const client = new SimplySendClient({
      tapiKey: 'key_123',
      accountId: 'acc_123',
      emailApiUrl: 'https://test-api.example.com',
    });

    // Mock global fetch
    const fetchMock = mock.fn(async (url: any, options: any) => {
      assert.strictEqual(url, 'https://test-api.example.com/send');
      assert.strictEqual(options.method, 'POST');
      assert.strictEqual(options.headers['X-Api-Key'], 'key_123');
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

    const res = await client.emails.send({
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
    
    // Restore fetch
    mock.restoreAll();
  });
});

test('SimplySendClient Marketing Sends', async (t) => {
  await t.test('should validate subscriptionGroupId', async () => {
    const client = new SimplySendClient({ mapiKey: 'key_123', accountId: 'acc_abc' });
    await assert.rejects(
      () => client.emails.sendMarketing({
        to: 'rec@test.com',
        from: 'sender@domain.com',
        subject: 'sub',
        html: 'html',
        subscriptionGroupId: '',
      }),
      (err: any) => err instanceof SimplySendValidationError && err.field === 'subscriptionGroupId'
    );
  });

  await t.test('should invoke marketing send API url correctly', async () => {
    const client = new SimplySendClient({
      mapiKey: 'key_123',
      accountId: 'acc_123',
      marketingApiUrl: 'https://marketing-api.example.com',
    });

    const fetchMock = mock.fn(async (url: any, options: any) => {
      assert.strictEqual(url, 'https://marketing-api.example.com/send');
      const body = JSON.parse(options.body);
      assert.strictEqual(body.subscriptionGroupId, 'group_99');
      assert.strictEqual(body.campaignId, 'camp_55');

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    global.fetch = fetchMock as any;

    const res = await client.emails.sendMarketing({
      to: 'rec@test.com',
      from: 'sender@domain.com',
      subject: 'sub',
      html: 'html',
      subscriptionGroupId: 'group_99',
      campaignId: 'camp_55',
    });

    assert.strictEqual(res.success, true);
    mock.restoreAll();
  });
});

test('SimplySendClient Error Handling', async (t) => {
  await t.test('should wrap non-2xx responses into SimplySendHttpError', async () => {
    const client = new SimplySendClient({ wapiKey: 'key_123', accountId: 'acc_123' });

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

test('SimplySendClient Resource Management Auth', async (t) => {
  await t.test('should use wapiKey for resource management if provided', async () => {
    const client = new SimplySendClient({
      tapiKey: 'email_key_123',
      wapiKey: 'wapi_key_789',
      accountId: 'acc_123',
      webSetupApiUrl: 'https://wapi.example.com/web-setup',
    });

    const fetchMock = mock.fn(async (url: any, options: any) => {
      assert.strictEqual(url, 'https://wapi.example.com/web-setup/domains');
      assert.strictEqual(options.headers['X-Api-Key'], 'wapi_key_789');
      assert.strictEqual(options.headers['X-Id'], 'acc_123');
      return new Response(JSON.stringify([]), { status: 200 });
    });

    global.fetch = fetchMock as any;

    const res = await client.domains.list();
    assert.deepStrictEqual(res, []);
    mock.restoreAll();
  });

  await t.test('should use wapiSecret for resource management if provided', async () => {
    const client = new SimplySendClient({
      tapiKey: 'email_key_123',
      wapiSecret: 'wapi_secret_456',
      accountId: 'acc_123',
      webSetupApiUrl: 'https://wapi.example.com/web-setup',
    });

    const fetchMock = mock.fn(async (url: any, options: any) => {
      assert.strictEqual(url, 'https://wapi.example.com/web-setup/domains');
      assert.strictEqual(options.headers['X-Api-Key'], 'wapi_secret_456');
      assert.strictEqual(options.headers['X-Id'], 'acc_123');
      return new Response(JSON.stringify([]), { status: 200 });
    });

    global.fetch = fetchMock as any;

    const res = await client.domains.list();
    assert.deepStrictEqual(res, []);
    mock.restoreAll();
  });

  await t.test('should use wpaiKey for resource management if provided', async () => {
    const client = new SimplySendClient({
      tapiKey: 'email_key_123',
      wpaiKey: 'wpai_key_888',
      accountId: 'acc_123',
      webSetupApiUrl: 'https://wapi.example.com/web-setup',
    });

    const fetchMock = mock.fn(async (url: any, options: any) => {
      assert.strictEqual(url, 'https://wapi.example.com/web-setup/domains');
      assert.strictEqual(options.headers['X-Api-Key'], 'wpai_key_888');
      assert.strictEqual(options.headers['X-Id'], 'acc_123');
      return new Response(JSON.stringify([]), { status: 200 });
    });

    global.fetch = fetchMock as any;

    const res = await client.domains.list();
    assert.deepStrictEqual(res, []);
    mock.restoreAll();
  });

  await t.test('should throw validation error for resource management if no WAPI key is provided', async () => {
    const client = new SimplySendClient({
      tapiKey: 'email_key_123',
      accountId: 'acc_123',
      webSetupApiUrl: 'https://wapi.example.com/web-setup',
    });

    await assert.rejects(
      () => client.domains.list(),
      (err: any) => err instanceof SimplySendValidationError && err.field === 'wapiKey'
    );
  });
});

test('SimplySendClient Specific API Keys (tapiKey & mapiKey)', async (t) => {
  await t.test('should use tapiKey for transactional sends if provided', async () => {
    const client = new SimplySendClient({
      tapiKey: 'tapi_key_abc',
      accountId: 'acc_123',
      emailApiUrl: 'https://tapi.example.com',
    });

    const fetchMock = mock.fn(async (url: any, options: any) => {
      assert.strictEqual(url, 'https://tapi.example.com/send');
      assert.strictEqual(options.headers['X-Api-Key'], 'tapi_key_abc');
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    global.fetch = fetchMock as any;

    const res = await client.emails.send({
      to: 'recipient@test.com',
      from: 'sender@domain.com',
      subject: 'Subject',
      html: '<h1>html</h1>',
    });

    assert.strictEqual(res.success, true);
    mock.restoreAll();
  });

  await t.test('should throw validation error if tapiKey is missing when sending transactional emails', async () => {
    const client = new SimplySendClient({
      mapiKey: 'mapi_key_xyz',
      accountId: 'acc_123',
    });
    await assert.rejects(
      () => client.emails.send({
        to: 'recipient@test.com',
        from: 'sender@domain.com',
        subject: 'Subject',
        html: '<h1>html</h1>',
      }),
      (err: any) => err instanceof SimplySendValidationError && err.field === 'tapiKey'
    );
  });

  await t.test('should use mapiKey for marketing sends if provided', async () => {
    const client = new SimplySendClient({
      mapiKey: 'mapi_key_xyz',
      accountId: 'acc_123',
      marketingApiUrl: 'https://mapi.example.com',
    });

    const fetchMock = mock.fn(async (url: any, options: any) => {
      assert.strictEqual(url, 'https://mapi.example.com/send');
      assert.strictEqual(options.headers['X-Api-Key'], 'mapi_key_xyz');
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    global.fetch = fetchMock as any;

    const res = await client.emails.sendMarketing({
      to: 'recipient@test.com',
      from: 'sender@domain.com',
      subject: 'Subject',
      html: '<h1>html</h1>',
      subscriptionGroupId: 'sub_group_123',
    });

    assert.strictEqual(res.success, true);
    mock.restoreAll();
  });

  await t.test('should throw validation error if mapiKey is missing when sending marketing emails', async () => {
    const client = new SimplySendClient({
      tapiKey: 'tapi_key_abc',
      accountId: 'acc_123',
    });
    await assert.rejects(
      () => client.emails.sendMarketing({
        to: 'recipient@test.com',
        from: 'sender@domain.com',
        subject: 'Subject',
        html: '<h1>html</h1>',
        subscriptionGroupId: 'sub_group_123',
      }),
      (err: any) => err instanceof SimplySendValidationError && err.field === 'mapiKey'
    );
  });
});
