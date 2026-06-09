# SimplySend Node.js SDK

Official Node.js SDK for SimplySend - a premium, high-performance transactional and marketing email sending and management platform.

<!-- [![npm version](https://img.shields.io/npm/v/@simplysend/node.svg)](https://www.npmjs.com/package/@simplysend/node) (Uncomment once published to npm) -->
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Transactional Email**: Fast sending with support for single/multiple recipients, reply-to, and custom headers.
- **Marketing Email**: Target subscription groups with automatic RFC 8058 consent validation and click tracking.
- **Web Setup API**: Manage domains, domain groups, subscribers, subscription groups, and webhooks programmatically.
- **Dual module support**: Pre-built CJS (CommonJS) and ESM (ES Modules) formats out of the box.
- **Strongly Typed**: Full TypeScript support with detailed interfaces.
- **Lightweight & Dependency-free**: Uses native `fetch` (requires Node.js 18+). No heavy dependencies.
- **Smart Attachments**: Pass raw Node.js `Buffer` objects, and the SDK will automatically base64-encode them for you.

## Installation

```bash
npm install @simplysend/node
```

## Initialization

Configure your **Account ID** and the respective **API Keys** (such as `tapiKey`, `mapiKey`, and `wapiKey`) under the **Settings** section of your SimplySend dashboard. Both the **Account ID** and at least **one API key/secret** are mandatory.

### ES Modules (TypeScript / Modern JS)

```typescript
import { SimplySendClient } from '@simplysend/node';

const client = new SimplySendClient({
  accountId: 'ss_acc_...',          // Required
  tapiKey: 'ss_tapi_key_...',      // API key for transactional email sending (tapi)
  mapiKey: 'ss_mapi_key_...',      // API key for marketing email sending (mapi)
  wapiKey: 'ss_wapi_secret_...',    // API key for resource management (wapi)
});
```

### CommonJS (Legacy JS)

```javascript
const { SimplySendClient } = require('@simplysend/node');

const client = new SimplySendClient({
  accountId: 'ss_acc_...',
  tapiKey: 'ss_tapi_key_...',
  mapiKey: 'ss_mapi_key_...',
  wapiKey: 'ss_wapi_secret_...',
});
```

---

## Usage Examples

### 1. Send a Transactional Email

Transactional emails are designed for fast delivery (e.g., OTPs, receipts, password resets).

```typescript
try {
  const response = await client.emails.send({
    from: 'welcome@yourverifieddomain.com',
    to: 'customer@example.com',
    subject: 'Welcome to our platform!',
    html: '<h1>Hello, World!</h1><p>Thank you for signing up.</p>',
    text: 'Hello, World! Thank you for signing up.', // Optional text fallback
    replyTo: 'support@yourverifieddomain.com',     // Optional
    enableClickTracking: true,                     // Optional
    attachments: [
      {
        name: 'invoice.pdf',
        contentType: 'application/pdf',
        content: Buffer.from('PDF content here...'), // Automatically encoded to base64
      }
    ]
  });

  console.log('Email sent successfully:', response.data.messageId);
} catch (error) {
  console.error('Failed to send email:', error.message);
}
```

### 2. Send a Marketing Email

Marketing emails are automatically checked for recipient list consent before dispatch.

```typescript
try {
  const response = await client.emails.sendMarketing({
    from: 'newsletter@yourverifieddomain.com',
    to: 'subscriber@example.com',
    subject: 'June Newsletter',
    html: '<h1>Our monthly updates</h1><p>Here is what is new...</p>',
    subscriptionGroupId: 'sub_group_123', // Required
    campaignId: 'camp_abc_456',           // Optional campaign tracking
    enableClickTracking: true,
  });

  console.log('Marketing email sent:', response.data.messageId);
} catch (error) {
  console.error('Failed to send marketing email:', error.message);
}
```

### 3. Add a Subscriber to a Subscription Group

Add a subscriber to an audience group with audit/consent trail proof.

```typescript
const subscriber = await client.subscribers.add('sub_group_123', {
  email: 'new-user@example.com',
  firstName: 'Alice',
  fullName: 'Alice Smith',
  consentMethod: 'single_opt_in',
  consentProof: 'Subscribed via website registration form',
  metadata: { source: 'landing-page' },
});

console.log('Subscriber added:', subscriber);
```

### 4. Create and Verify a Domain

```typescript
// 1. Add Domain
const newDomain = await client.domains.create({
  domain: 'mycompany.com',
  useCaseId: 'tx-us-east-1', // Set your use case configuration
});

console.log('Domain added. Verification records:', newDomain);

// 2. Request verification checks (after configuring your DNS settings)
const verificationResult = await client.domains.verify(newDomain.domainId);
console.log('Verification status:', verificationResult.message);
```

---

## Configuration Options

When creating the client, the following parameters are accepted:

| Option | Type | Description |
| :--- | :--- | :--- |
| `accountId` | `string` | **Required**. Your SimplySend Account ID. |
| `tapiKey` | `string` | **Optional**. API Key dedicated for transactional sends (`tapi.simplysend.email`). |
| `mapiKey` | `string` | **Optional**. API Key dedicated for marketing sends (`mapi.simplysend.email`). |
| `wapiKey` | `string` | **Optional**. Web Setup API Key (`wapi.simplysend.email/web-setup`) for resource management. |
| `wpaiKey` | `string` | Alias for `wapiKey`. |
| `wapiSecret` | `string` | Alias for `wapiKey`. |
| `emailApiUrl` | `string` | Override the transactional email sending endpoint. |
| `marketingApiUrl` | `string` | Override the marketing email sending endpoint. |
| `webSetupApiUrl` | `string` | Override the Resource management endpoint. |
| `timeout` | `number` | Request timeout in milliseconds (defaults to `30000`). |

---

## Error Handling

The SDK exposes descriptive error classes to help you debug integration issues.

```typescript
import { SimplySendClient, SimplySendHttpError, SimplySendValidationError } from '@simplysend/node';

try {
  // 1. Instantiation validation (e.g. missing Account ID or API keys)
  const client = new SimplySendClient({
    accountId: '', // Throws validation error locally
    tapiKey: 'ss_tapi_key_...'
  });

  // 2. Request parameter validation (e.g. missing 'to' recipient)
  await client.emails.send({
    from: 'sender@domain.com',
    to: '', // Throws validation error locally
    subject: 'Hello',
    html: '...'
  });
} catch (error) {
  if (error instanceof SimplySendValidationError) {
    // Local validation failed (field check did not hit the network)
    console.error('Validation failed on field:', error.field); // e.g. "accountId", "to", "tapiKey"
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
