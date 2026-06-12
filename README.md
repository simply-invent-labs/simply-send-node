<p align="center">
  <a href="https://simplysend.email">
    <img src="https://simplysend.email/sse-logo-blue-256x.png" alt="SimplySend Logo" width="100" height="100" />
  </a>
</p>

<h1 align="center">SimplySend Node.js SDK</h1>

<p align="center">
  Official Node.js SDK for SimplySend - a premium, high-performance transactional and marketing email sending and management platform.
</p>
<p align="center">
  <a href="https://www.npmjs.com/package/simplysend"><img src="https://img.shields.io/npm/v/simplysend.svg" alt="npm version" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D22-blue.svg" alt="Node Version" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Ready-blue.svg" alt="TypeScript" /></a>
</p>

## Features

- **Strict Separation of Concerns**: Exposes three dedicated client classes for Transactional API, Marketing API, and Web Setup API.
- **Lightweight & Dependency-free**: Uses native `fetch` (requires Node.js 22+). No heavy dependencies.
- **Dual module support**: Pre-built ESM (ES Modules) and CJS (CommonJS) formats.
- **Strongly Typed**: Full TypeScript support with detailed interfaces.
- **Smart Attachments**: Pass raw Node.js `Buffer` objects, and the SDK will automatically base64-encode them for you.

## Installation

```bash
npm install simplysend
```

---

## Client Initialization

To connect to SimplySend, you will initialize the specialized client class corresponding to the API features you need. Each constructor requires your **Account ID** and the respective **API Key** (retrieved from the **Settings** page in your SimplySend Dashboard).

### 1. SimplySendTransactionalClient
Used to send transactional emails (OTPs, receipts, alerts).

```typescript
import { SimplySendTransactionalClient } from 'simplysend';

const client = new SimplySendTransactionalClient({
  accountId: 'ss_acc_123456',
  apiKey: 'ss_api_key_abcdef'
});
```

### 2. SimplySendMarketingClient
Used to send newsletters or marketing campaigns.

```typescript
import { SimplySendMarketingClient } from 'simplysend';

const client = new SimplySendMarketingClient({
  accountId: 'ss_acc_123456',
  apiKey: 'ss_api_key_abcdef'
});
```

### 3. SimplySendWebSetupClient
Used for resource management (domains, templates, subscribers, webhooks).

```typescript
import { SimplySendWebSetupClient } from 'simplysend';

const client = new SimplySendWebSetupClient({
  accountId: 'ss_acc_123456',
  apiKey: 'ss_api_key_abcdef'
});
```

---

## Usage Examples

### 1. Send a Transactional Email

```typescript
import { SimplySendTransactionalClient, SendTransactionalEmailResponse } from 'simplysend';

const client = new SimplySendTransactionalClient({
  accountId: 'ss_acc_123',
  apiKey: 'ss_api_key_abc'
});

try {
  const response: SendTransactionalEmailResponse = await client.email.send({
    from: 'welcome@yourverifieddomain.com',
    to: 'customer@example.com',
    subject: 'Welcome!',
    html: '<h1>Hello, World!</h1><p>Thank you for signing up.</p>',
    text: 'Hello, World! Thank you for signing up.', // Optional plain text fallback
    replyTo: 'support@yourverifieddomain.com',     // Optional
    enableClickTracking: true,                     // Optional
    attachments: [
      {
        name: 'invoice.pdf',
        contentType: 'application/pdf',
        content: Buffer.from('PDF content here...'), // Automatically encoded to base64 by SDK
      }
    ]
  });

  console.log('Transactional email sent. Message ID:', response.data?.messageId);
} catch (error) {
  console.error('Failed to send email:', error.message);
}
```

### 2. Send a Marketing Email

```typescript
import { SimplySendMarketingClient, SendMarketingEmailResponse } from 'simplysend';

const client = new SimplySendMarketingClient({
  accountId: 'ss_acc_123',
  apiKey: 'ss_api_key_xyz'
});

try {
  const response: SendMarketingEmailResponse = await client.email.send({
    from: 'newsletter@yourverifieddomain.com',
    to: 'subscriber@example.com',
    subject: 'June Newsletter',
    html: '<h1>Our monthly updates</h1><p>Here is what is new...</p>{{company_address_html}}{{unsubscribe_email_html}}',
    subscriptionGroupId: 'sub_group_123', // Required
    campaignId: 'camp_abc_456',           // Optional campaign tracking
    enableClickTracking: true,
  });

  console.log('Marketing email sent. Message ID:', response.data?.messageId);
} catch (error) {
  console.error('Failed to send marketing email:', error.message);
}
```

### 3. Manage Web Setup Resources (Domains, Contacts, Subscription Groups, Subscribers)

```typescript
import { SimplySendWebSetupClient } from 'simplysend';

const client = new SimplySendWebSetupClient({
  accountId: 'ss_acc_123',
  apiKey: 'ss_api_key_789'
});

// 1. Add a domain to verify
const newDomain = await client.domains.create({
  domain: 'mycompany.com',
  useCaseId: 'tx-us-east-1'
});
console.log('Verification records:', newDomain.dnsRecords);

// 2. Create a Contact profile globally in the Contacts Directory
// Note: Contacts must exist globally before they can be subscribed to groups.
const contactResponse = await client.contacts.createContact({
  email: 'alice.smith@example.com',
  firstName: 'Alice',
  lastName: 'Smith',
  phone: '+1234567890',
  globalStatus: 'active',
  consentMethod: 'single_opt_in',
  consentProof: 'User signup form'
});
console.log('Contact created:', contactResponse.data.contact);

// 3. Create a Subscription Group (audience list)
const groupResponse = await client.contacts.createSubscriberGroup({
  name: 'Newsletter List',
  description: 'Monthly updates newsletter list'
});
const groupId = groupResponse.data.group.groupId!;
console.log('Group created:', groupResponse.data.group);

// 4. Subscribe the contact to the group list
const subscriptionResponse = await client.contacts.addSubscriber(groupId, {
  email: 'new-user@example.com',
  isActive: true,
  consentMethod: 'single_opt_in',
  consentProof: 'Subscribed via landing page checkbox'
});
console.log('Subscribed to group:', subscriptionResponse.data.subscriber);
```

---

## Client Configurations

When initializing, each client class expects exactly the same configuration properties:

| Property | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `accountId` | `string` | **Yes** | Your unique SimplySend Account ID, found on the Account page of the SimplySend website (https://app.simplysend.email/account). |
| `apiKey` | `string` | **Yes** | The SimplySend API Key for authentication, found on the API Keys page of the SimplySend website (https://app.simplysend.email/api-keys). |

---

## Error Handling

The SDK exposes descriptive error classes to help you debug integration issues:

```typescript
import { SimplySendTransactionalClient, SimplySendHttpError, SimplySendValidationError } from 'simplysend';

try {
  // 1. Instantiation validation (throws locally)
  const client = new SimplySendTransactionalClient({
    accountId: '', // Throws validation error locally
    apiKey: 'ss_api_key_...'
  });

  // 2. Request parameter validation (throws locally)
  await client.email.send({
    from: 'sender@domain.com',
    to: '', // Throws validation error locally
    subject: 'Hello',
    html: '...'
  });
} catch (error) {
  if (error instanceof SimplySendValidationError) {
    // Local validation failed (field check did not hit the network)
    console.error('Validation failed on field:', error.field); // e.g. "accountId", "to"
    console.error('Message:', error.message);
  } else if (error instanceof SimplySendHttpError) {
    // API server responded with a non-2xx status code
    console.error('HTTP Status:', error.statusCode); // e.g. 403, 400
    console.error('Error Code:', error.reasonCode); // e.g. "ACCOUNT_SUSPENDED"
    console.error('Message:', error.message);
  } else {
    // Generic connection/network failure
    console.error('Network/Request Error:', error.message);
  }
}
```

## License

MIT
