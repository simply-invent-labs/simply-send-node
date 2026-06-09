/**
 * Client initialization configuration options.
 */
export interface SimplySendConfig {
  /**
   * The SimplySend Transactional Email API Key (tapi).
   */
  tapiKey?: string;
  /**
   * The SimplySend Marketing Email API Key (mapi).
   */
  mapiKey?: string;
  /**
   * The SimplySend Web Setup API Key (wapi) for resource management.
   */
  wapiKey?: string;
  /**
   * Alias for wapiKey (supporting user typing: wpai).
   */
  wpaiKey?: string;
  /**
   * Alias for wapiKey.
   */
  wapiSecret?: string;
  /**
   * The Account ID (required for Web Setup API and transactional/marketing sends).
   */
  accountId?: string;
  /**
   * Transactional Email API base URL override (defaults to https://tapi.simplysend.email).
   */
  emailApiUrl?: string;
  /**
   * Marketing Email API base URL override (defaults to https://mapi.simplysend.email).
   */
  marketingApiUrl?: string;
  /**
   * Web Setup API base URL override (defaults to https://wapi.simplysend.email/web-setup).
   */
  webSetupApiUrl?: string;
  /**
   * Request timeout in milliseconds (defaults to 30000ms).
   */
  timeout?: number;
}

/**
 * Interface representing a file attachment.
 */
export interface Attachment {
  /**
   * The name of the file (e.g. invoice.pdf).
   */
  name: string;
  /**
   * The MIME content type of the file (e.g. application/pdf).
   */
  contentType: string;
  /**
   * File content as a base64 encoded string OR a raw Buffer.
   * If a Buffer is provided, it will be automatically converted to base64 by the SDK.
   */
  content: string | Buffer;
}

/**
 * Payload structure for sending a transactional email.
 */
export interface SendEmailRequest {
  /**
   * Recipient email address(es). Can be a single string (comma-separated if multiple) or an array of strings.
   */
  to: string | string[];
  /**
   * Email subject line.
   */
  subject: string;
  /**
   * HTML content of the email.
   */
  html: string;
  /**
   * Sender email address. Must be from a verified domain.
   */
  from: string;
  /**
   * CC recipient email address(es). Can be a single string or an array of strings.
   */
  cc?: string | string[];
  /**
   * Reply-To email address.
   */
  replyTo?: string;
  /**
   * Plain text version of the email.
   */
  text?: string;
  /**
   * Enable click redirection tracking (defaults to false).
   */
  enableClickTracking?: boolean;
  /**
   * Optional custom SMTP headers.
   */
  headers?: Record<string, string>;
  /**
   * Custom template variables.
   */
  templateVariables?: Record<string, any>;
  /**
   * List of attachments.
   */
  attachments?: Attachment[];
}

/**
 * Payload structure for sending a marketing email.
 */
export interface SendMarketingEmailRequest {
  /**
   * Recipient email address(es). Can be a single string or an array of strings.
   */
  to: string | string[];
  /**
   * Email subject line.
   */
  subject: string;
  /**
   * HTML content of the email.
   */
  html: string;
  /**
   * Sender email address. Must be from a verified domain.
   */
  from: string;
  /**
   * Subscription Group ID (or Contact List ID) associated with the marketing send.
   */
  subscriptionGroupId: string;
  /**
   * Optional Campaign ID to attribute this send for campaign analytics.
   */
  campaignId?: string;
  /**
   * Plain text version of the email.
   */
  text?: string;
  /**
   * Optional custom SMTP headers. Must comply with RFC 8058 (List-Unsubscribe).
   */
  headers?: Record<string, string>;
  /**
   * Custom template variables.
   */
  templateVariables?: Record<string, any>;
  /**
   * Enable click redirection tracking (defaults to false).
   */
  enableClickTracking?: boolean;
}

/**
 * Response returned from the send email API.
 */
export interface SendEmailResponse {
  success: boolean;
  data?: {
    message: string;
    messageId: string;
    from: string;
    totalRecipients: number;
    recipients: Array<{
      email: string;
      status: string;
      role: string;
    }>;
    status: string;
  };
  error?: string;
  reasonCode?: string;
}

// -------------------------------------------------------------
// Web Setup API Types
// -------------------------------------------------------------

export interface DomainGroup {
  groupId?: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  ownerId?: string;
}

export interface Domain {
  domainId?: string;
  domain: string;
  useCaseId?: string;
  groupId?: string;
  status?: string;
}

export interface DnsRecord {
  type: string;
  name: string;
  value: string;
  status: string;
  priority?: number;
}

export interface SubscriptionGroup {
  groupId?: string;
  name: string;
  description?: string;
}

export interface Subscriber {
  email: string;
  firstName?: string;
  fullName?: string;
  phone?: string;
  consentMethod?: string;
  consentProof?: string;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface EmailTemplate {
  templateId?: string;
  name: string;
  subject?: string;
  html: string;
  type?: 'transactional' | 'marketing';
  variables?: Array<{
    name: string;
    type: string;
    required: boolean;
  }>;
}

export interface Webhook {
  webhookId?: string;
  url: string;
  events: string[];
  description?: string;
}

export interface UseCase {
  useCaseId: string;
  name: string;
  description: string;
}
