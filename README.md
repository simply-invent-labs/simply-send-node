# SimplySend Node.js SDK

Official Node.js SDK for SimplySend - a premium, high-performance transactional and marketing email sending and management platform.

<!-- [![npm version](https://img.shields.io/npm/v/simplysend.svg)](https://www.npmjs.com/package/simplysend) (Uncomment once published to npm) -->
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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

### 1. SimplySendTransactionalClient (tapi)
Used to send transactional emails (OTPs, receipts, alerts).

```typescript
import { SimplySendTransactionalClient } from 'simplysend';

const client = new SimplySendTransactionalClient({
  accountId: 'ss_acc_123456',
  tapiKey: 'ss_tapi_key_abcdef'
});
```

### 2. SimplySendMarketingClient (mapi)
Used to send newsletters or marketing campaigns.

```typescript
import { SimplySendMarketingClient } from 'simplysend';

const client = new SimplySendMarketingClient({
  accountId: 'ss_acc_123456',
  mapiKey: 'ss_mapi_key_abcdef'
});
```

### 3. SimplySendWebSetupClient (wapi)
Used for resource management (domains, templates, subscribers, webhooks).

```typescript
import { SimplySendWebSetupClient } from 'simplysend';

const client = new SimplySendWebSetupClient({
  accountId: 'ss_acc_123456',
  wapiKey: 'ss_wapi_key_abcdef' // wapiSecret and wpaiKey are also accepted as aliases
});
```

---

## Usage Examples

### 1. Send a Transactional Email

```typescript
import { SimplySendTransactionalClient } from 'simplysend';

const client = new SimplySendTransactionalClient({
  accountId: 'ss_acc_123',
  tapiKey: 'ss_tapi_key_abc'
});

try {
  const response = await client.send({
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

  console.log('Transactional email sent. Message ID:', response.data.messageId);
} catch (error) {
  console.error('Failed to send email:', error.message);
}
```

### 2. Send a Marketing Email

```typescript
import { SimplySendMarketingClient } from 'simplysend';

const client = new SimplySendMarketingClient({
  accountId: 'ss_acc_123',
  mapiKey: 'ss_mapi_key_xyz'
});

try {
  const response = await client.send({
    from: 'newsletter@yourverifieddomain.com',
    to: 'subscriber@example.com',
    subject: 'June Newsletter',
    html: '<h1>Our monthly updates</h1><p>Here is what is new...</p>{{company_address_html}}{{unsubscribe_email_html}}',
    subscriptionGroupId: 'sub_group_123', // Required
    campaignId: 'camp_abc_456',           // Optional campaign tracking
    enableClickTracking: true,
  });

  console.log('Marketing email sent. Message ID:', response.data.messageId);
} catch (error) {
  console.error('Failed to send marketing email:', error.message);
}
```

### 3. Manage Web Setup Resources (Domains, Templates, Subscribers)

```typescript
import { SimplySendWebSetupClient } from 'simplysend';

const client = new SimplySendWebSetupClient({
  accountId: 'ss_acc_123',
  wapiKey: 'ss_wapi_key_789'
});

// 1. Add a domain to verify
const newDomain = await client.domains.create({
  domain: 'mycompany.com',
  useCaseId: 'tx-us-east-1'
});
console.log('Verification records:', newDomain.dnsRecords);

// 2. Add a subscriber to an audience group
const subscriber = await client.subscribers.add('sub_group_123', {
  email: 'new-user@example.com',
  firstName: 'Alice',
  consentMethod: 'single_opt_in',
  consentProof: 'Subscribed via registration checkbox'
});
console.log('Subscriber added:', subscriber);
```

---

## Client Configurations

When initializing, each client expects exactly its corresponding credentials:

### `SimplySendTransactionalClient`
| Property | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `accountId` | `string` | **Yes** | Your SimplySend Account ID. |
| `tapiKey` | `string` | **Yes** | API Key dedicated for transactional sends (`tapi.simplysend.email`). |

### `SimplySendMarketingClient`
| Property | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `accountId` | `string` | **Yes** | Your SimplySend Account ID. |
| `mapiKey` | `string` | **Yes** | API Key dedicated for marketing sends (`mapi.simplysend.email`). |

### `SimplySendWebSetupClient`
| Property | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `accountId` | `string` | **Yes** | Your SimplySend Account ID. |
| `wapiKey` | `string` | **Yes\*** | API Key for Web Setup resource management. |
| `wpaiKey` | `string` | **Yes\*** | Alias for `wapiKey`. |
| `wapiSecret` | `string` | **Yes\*** | Alias for `wapiKey`. |

*\* One of `wapiKey`, `wpaiKey`, or `wapiSecret` is required.*

---

## Error Handling

The SDK exposes descriptive error classes to help you debug integration issues:

```typescript
import { SimplySendTransactionalClient, SimplySendHttpError, SimplySendValidationError } from 'simplysend';

try {
  // 1. Instantiation validation (throws locally)
  const client = new SimplySendTransactionalClient({
    accountId: '', // Throws validation error locally
    tapiKey: 'ss_tapi_key_...'
  });

  // 2. Request parameter validation (throws locally)
  await client.send({
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
