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

  await t.test('should send transactional email and include Idempotency-Key header', async () => {
    const client = new SimplySendTransactionalClient({
      accountId: 'acc_123',
      apiKey: 'tapi_key_abc',
    });

    const fetchMock = mock.fn(async (url: any, options: any) => {
      assert.strictEqual(url, 'https://tapi.simplysend.email/send');
      assert.strictEqual(options.method, 'POST');
      assert.strictEqual(options.headers['X-Api-Key'], 'tapi_key_abc');
      assert.strictEqual(options.headers['X-Id'], 'acc_123');
      assert.strictEqual(options.headers['Idempotency-Key'], 'test-idempotency-uuid-tx');

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
      idempotencyKey: 'test-idempotency-uuid-tx',
    });

    assert.strictEqual(res.success, true);
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

  await t.test('should send marketing email with Idempotency-Key header', async () => {
    const client = new SimplySendMarketingClient({
      accountId: 'acc_123',
      apiKey: 'mapi_key_xyz',
    });

    const fetchMock = mock.fn(async (url: any, options: any) => {
      assert.strictEqual(url, 'https://mapi.simplysend.email/send');
      assert.strictEqual(options.headers['X-Api-Key'], 'mapi_key_xyz');
      assert.strictEqual(options.headers['X-Id'], 'acc_123');
      assert.strictEqual(options.headers['Idempotency-Key'], 'test-idempotency-uuid-mkt');

      return new Response(JSON.stringify({ success: true, data: { messageId: 'msg_888' } }), { status: 200 });
    });

    global.fetch = fetchMock as any;

    const res = await client.email.send({
      to: 'rec@test.com',
      from: 'sender@domain.com',
      subject: 'sub',
      html: 'html',
      idempotencyKey: 'test-idempotency-uuid-mkt',
    });

    assert.strictEqual(res.success, true);
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
// 4. SimplySendWebSetupClient Contacts & Subscribers Tests
// ============================================================================
test('SimplySendWebSetupClient Contacts & Subscribers API', async (t) => {
  const client = new SimplySendWebSetupClient({
    accountId: 'acc_123',
    apiKey: 'wapi_key_789',
  });

  await t.test('contacts.listContacts() should invoke GET /web-setup/contacts', async () => {
    const fetchMock = mock.fn(async (url: any, options: any) => {
      assert.strictEqual(url, 'https://wapi.simplysend.email/web-setup/contacts?limit=10&search=john');
      assert.strictEqual(options.method, 'GET');
      return new Response(JSON.stringify({ success: true, data: { contacts: [], count: 0 } }), { status: 200 });
    });
    global.fetch = fetchMock as any;

    const res = await client.contacts.listContacts({ limit: 10, search: 'john' });
    assert.strictEqual(res.success, true);
    mock.restoreAll();
  });

  await t.test('contacts.getContact() should throw validation error if identifier format is invalid', async () => {
    await assert.rejects(
      () => client.contacts.getContact('user@test.com'),
      (err: any) => err instanceof SimplySendValidationError && err.field === 'contactIdentifier'
    );
  });

  await t.test('contacts.getContact() should invoke GET /web-setup/contacts/{contactIdentifier}', async () => {
    const fetchMock = mock.fn(async (url: any, options: any) => {
      assert.strictEqual(url, 'https://wapi.simplysend.email/web-setup/contacts/email_4832981775432a1383848b8137350438');
      assert.strictEqual(options.method, 'GET');
      return new Response(JSON.stringify({ success: true, data: { contact: { email: 'user@test.com' }, memberships: [] } }), { status: 200 });
    });
    global.fetch = fetchMock as any;

    const res = await client.contacts.getContact('email_4832981775432a1383848b8137350438');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.contact.email, 'user@test.com');
    mock.restoreAll();
  });

  await t.test('contacts.createContact() should invoke POST /web-setup/contacts', async () => {
    const fetchMock = mock.fn(async (url: any, options: any) => {
      assert.strictEqual(url, 'https://wapi.simplysend.email/web-setup/contacts');
      assert.strictEqual(options.method, 'POST');
      const body = JSON.parse(options.body);
      assert.strictEqual(body.email, 'user@test.com');
      assert.strictEqual(body.firstName, 'John');
      return new Response(JSON.stringify({ success: true, data: { contact: { email: 'user@test.com', firstName: 'John' } } }), { status: 201 });
    });
    global.fetch = fetchMock as any;

    const res = await client.contacts.createContact({ email: 'user@test.com', firstName: 'John' });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.contact.firstName, 'John');
    mock.restoreAll();
  });

  await t.test('contacts.updateContact() should invoke PUT /web-setup/contacts/{contactIdentifier}', async () => {
    const fetchMock = mock.fn(async (url: any, options: any) => {
      assert.strictEqual(url, 'https://wapi.simplysend.email/web-setup/contacts/email_4832981775432a1383848b8137350438');
      assert.strictEqual(options.method, 'PUT');
      const body = JSON.parse(options.body);
      assert.strictEqual(body.firstName, 'John');
      return new Response(JSON.stringify({ success: true, data: { contact: { email: 'user@test.com', firstName: 'John' } } }), { status: 200 });
    });
    global.fetch = fetchMock as any;

    const res = await client.contacts.updateContact('email_4832981775432a1383848b8137350438', { firstName: 'John' });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.contact.firstName, 'John');
    mock.restoreAll();
  });

  await t.test('contacts.deleteContact() should invoke DELETE /web-setup/contacts/{contactIdentifier}', async () => {
    const fetchMock = mock.fn(async (url: any, options: any) => {
      assert.strictEqual(url, 'https://wapi.simplysend.email/web-setup/contacts/email_4832981775432a1383848b8137350438');
      assert.strictEqual(options.method, 'DELETE');
      return new Response(JSON.stringify({ success: true, data: { message: 'Deleted' } }), { status: 200 });
    });
    global.fetch = fetchMock as any;

    const res = await client.contacts.deleteContact('email_4832981775432a1383848b8137350438');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.message, 'Deleted');
    mock.restoreAll();
  });

  await t.test('contacts.createSubscriberGroup() should invoke POST /web-setup/contacts/subscription-groups', async () => {
    const fetchMock = mock.fn(async (url: any, options: any) => {
      assert.strictEqual(url, 'https://wapi.simplysend.email/web-setup/contacts/subscription-groups');
      assert.strictEqual(options.method, 'POST');
      const body = JSON.parse(options.body);
      assert.strictEqual(body.name, 'Newsletter');
      return new Response(JSON.stringify({ success: true, data: { group: { name: 'Newsletter', subscriptionGroupId: 'list_123' } } }), { status: 201 });
    });
    global.fetch = fetchMock as any;

    const res = await client.contacts.createSubscriberGroup({ name: 'Newsletter' });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.group.subscriptionGroupId, 'list_123');
    mock.restoreAll();
  });

  await t.test('contacts.addSubscriber() should invoke POST /web-setup/contacts/subscription-groups/{id}/subscriptions', async () => {
    const fetchMock = mock.fn(async (url: any, options: any) => {
      assert.strictEqual(url, 'https://wapi.simplysend.email/web-setup/contacts/subscription-groups/list_123/subscriptions');
      assert.strictEqual(options.method, 'POST');
      const body = JSON.parse(options.body);
      assert.strictEqual(body.email, 'sub@test.com');
      return new Response(JSON.stringify({ success: true, data: { message: 'Added', subscriber: { email: 'sub@test.com' } } }), { status: 201 });
    });
    global.fetch = fetchMock as any;

    const res = await client.contacts.addSubscriber('list_123', { email: 'sub@test.com', isActive: true });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.subscriber.email, 'sub@test.com');
    mock.restoreAll();
  });
});

// ============================================================================
// 5. SimplySendWebSetupClient Compliance Templates API
// ============================================================================
test('SimplySendWebSetupClient Compliance Templates API', async (t) => {
  await t.test('complianceTemplates.list() should invoke GET /web-setup/compliance-templates', async () => {
    const client = new SimplySendWebSetupClient({
      accountId: 'acc_123',
      apiKey: 'wapi_key_789',
    });

    const fetchMock = mock.fn(async (url: any, options: any) => {
      assert.strictEqual(url, 'https://wapi.simplysend.email/web-setup/compliance-templates');
      assert.strictEqual(options.method, 'GET');
      assert.strictEqual(options.headers['X-Api-Key'], 'wapi_key_789');
      assert.strictEqual(options.headers['X-Id'], 'acc_123');

      return new Response(JSON.stringify({ success: true, data: { templates: [] } }), { status: 200 });
    });

    global.fetch = fetchMock as any;

    const res = await client.complianceTemplates.list();
    assert.deepStrictEqual(res.data.templates, []);
    mock.restoreAll();
  });

  await t.test('complianceTemplates.list() should pass type query parameter', async () => {
    const client = new SimplySendWebSetupClient({
      accountId: 'acc_123',
      apiKey: 'wapi_key_789',
    });

    const fetchMock = mock.fn(async (url: any) => {
      assert.ok(url.toString().includes('type=unsubscribe'));
      return new Response(JSON.stringify({ success: true, data: { templates: [] } }), { status: 200 });
    });

    global.fetch = fetchMock as any;

    await client.complianceTemplates.list('unsubscribe');
    mock.restoreAll();
  });

  await t.test('complianceTemplates.create() should invoke POST /web-setup/compliance-templates', async () => {
    const client = new SimplySendWebSetupClient({
      accountId: 'acc_123',
      apiKey: 'wapi_key_789',
    });

    const fetchMock = mock.fn(async (url: any, options: any) => {
      assert.strictEqual(url, 'https://wapi.simplysend.email/web-setup/compliance-templates');
      assert.strictEqual(options.method, 'POST');
      const body = JSON.parse(options.body);
      assert.strictEqual(body.name, 'Unsubscribe Footer');
      assert.strictEqual(body.type, 'unsubscribe');
      assert.strictEqual(body.htmlContent, '<p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>');

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            template: {
              templateId: 'compliance_123',
              name: 'Unsubscribe Footer',
              type: 'unsubscribe',
              htmlContent: '<p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>',
              isDefault: true,
            },
          },
        }),
        { status: 201 }
      );
    });

    global.fetch = fetchMock as any;

    const res = await client.complianceTemplates.create({
      name: 'Unsubscribe Footer',
      type: 'unsubscribe',
      htmlContent: '<p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>',
    });
    assert.strictEqual(res.data.template.templateId, 'compliance_123');
    mock.restoreAll();
  });

  await t.test('complianceTemplates.update() should invoke PUT /web-setup/compliance-templates/{id}', async () => {
    const client = new SimplySendWebSetupClient({
      accountId: 'acc_123',
      apiKey: 'wapi_key_789',
    });

    const fetchMock = mock.fn(async (url: any, options: any) => {
      assert.strictEqual(url, 'https://wapi.simplysend.email/web-setup/compliance-templates/compliance_123');
      assert.strictEqual(options.method, 'PUT');

      return new Response(
        JSON.stringify({ success: true, data: { template: { templateId: 'compliance_123', name: 'Updated' } } }),
        { status: 200 }
      );
    });

    global.fetch = fetchMock as any;

    const res = await client.complianceTemplates.update('compliance_123', {
      name: 'Updated',
      type: 'unsubscribe',
      htmlContent: '<p>Updated</p>',
    });
    assert.strictEqual(res.data.template.name, 'Updated');
    mock.restoreAll();
  });

  await t.test('complianceTemplates.delete() should invoke DELETE /web-setup/compliance-templates/{id}', async () => {
    const client = new SimplySendWebSetupClient({
      accountId: 'acc_123',
      apiKey: 'wapi_key_789',
    });

    const fetchMock = mock.fn(async (url: any, options: any) => {
      assert.strictEqual(url, 'https://wapi.simplysend.email/web-setup/compliance-templates/compliance_123');
      assert.strictEqual(options.method, 'DELETE');

      return new Response(JSON.stringify({ success: true, data: { message: 'Compliance template deleted', templateId: 'compliance_123' } }), { status: 200 });
    });

    global.fetch = fetchMock as any;

    const res = await client.complianceTemplates.delete('compliance_123');
    assert.strictEqual(res.data.message, 'Compliance template deleted');
    mock.restoreAll();
  });
});

// ============================================================================
// 6. HTTP Errors & Wrapping
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
