/**
 * Configuration for the SimplySend Transactional Client.
 */
export interface SimplySendTransactionalConfig {
  /**
   * Your unique SimplySend Account ID, found on the Account page of the SimplySend website (https://app.simplysend.email/account). Required.
   */
  accountId: string;

  /**
   * The SimplySend API Key for transactional sending (tapi), found on the API Keys page of the SimplySend website (https://app.simplysend.email/api-keys). Required.
   */
  apiKey: string;
}

/**
 * Configuration for the SimplySend Marketing Client.
 */
export interface SimplySendMarketingConfig {
  /**
   * Your unique SimplySend Account ID, found on the Account page of the SimplySend website (https://app.simplysend.email/account). Required.
   */
  accountId: string;

  /**
   * The SimplySend API Key for marketing sending (mapi), found on the API Keys page of the SimplySend website (https://app.simplysend.email/api-keys). Required.
   */
  apiKey: string;
}

/**
 * Configuration for the SimplySend Web Setup / Resource Management Client.
 */
export interface SimplySendWebSetupConfig {
  /**
   * Your unique SimplySend Account ID, found on the Account page of the SimplySend website (https://app.simplysend.email/account). Required.
   */
  accountId: string;

  /**
   * The SimplySend API Key for resource setup management (wapi), found on the API Keys page of the SimplySend website (https://app.simplysend.email/api-keys). Required.
   */
  apiKey: string;
}

/**
 * Interface representing a file attachment.
 */
export interface Attachment {
  /**
   * The name of the file (e.g. 'invoice.pdf'). Required.
   */
  name: string;

  /**
   * The MIME content type of the file (e.g. 'application/pdf'). Required.
   */
  contentType: string;

  /**
   * File content as a base64 encoded string OR a raw Buffer. Required.
   * If a Buffer is provided, it will be automatically converted to base64 by the SDK.
   */
  content: string | Buffer;
}

/**
 * Payload structure for sending a transactional email.
 */
export interface SendTransactionalEmailRequest {
  /**
   * Recipient email address(es). Can be a single string (comma-separated if multiple) or an array of strings. Required.
   */
  to: string | string[];

  /**
   * Email subject line. Required.
   */
  subject: string;

  /**
   * HTML body content of the email. Required.
   */
  html: string;

  /**
   * Sender email address. Must be from one of your verified sending domains. Required.
   */
  from: string;

  /**
   * CC recipient email address(es). Can be a single string or an array of strings. Optional.
   */
  cc?: string | string[];

  /**
   * Reply-To email address. Optional.
   */
  replyTo?: string;

  /**
   * Optional plain text fallback version of the email body. Optional.
   */
  text?: string;

  /**
   * Enable click redirection tracking (defaults to false). Optional.
   */
  enableClickTracking?: boolean;

  /**
   * Optional custom SMTP headers. Optional.
   */
  headers?: Record<string, string>;

  /**
   * Custom template variables to replace in compile patterns. Optional.
   */
  templateVariables?: Record<string, any>;

  /**
   * List of email attachments. Optional.
   */
  attachments?: Attachment[];
}

/**
 * Payload structure for sending a marketing email.
 */
export interface SendMarketingEmailRequest {
  /**
   * Recipient email address(es). Can be a single string or an array of strings. Required.
   */
  to: string | string[];

  /**
   * Email subject line. Required.
   */
  subject: string;

  /**
   * HTML body content of the email. Required.
   */
  html: string;

  /**
   * Sender email address. Must be from one of your verified sending domains. Required.
   */
  from: string;

  /**
   * Subscription Group ID (or Contact List ID) associated with the marketing send.
   * Required for unsubscribe link compliance. Required.
   */
  subscriptionGroupId: string;

  /**
   * Optional Campaign ID to attribute this send for campaign analytics. Optional.
   */
  campaignId?: string;

  /**
   * Optional plain text fallback version of the email body. Optional.
   */
  text?: string;

  /**
   * Optional custom SMTP headers. Must comply with unsubscribe headers (RFC 8058). Optional.
   */
  headers?: Record<string, string>;

  /**
   * Custom template variables to replace in compile patterns. Optional.
   */
  templateVariables?: Record<string, any>;

  /**
   * Enable click redirection tracking (defaults to false). Optional.
   */
  enableClickTracking?: boolean;
}

/**
 * Response returned from the transactional send email API.
 */
export interface SendTransactionalEmailResponse {
  /**
   * Indicates whether the transactional email dispatch request succeeded. Required.
   */
  success: boolean;

  /**
   * Object containing transaction details if the dispatch request was successful. Optional.
   */
  data?: {
    /**
     * Confirmation status message. Optional.
     */
    message?: string;

    /**
     * Unique tracking message identifier generated for the email transaction. Required.
     */
    messageId: string;

    /**
     * Sender email address used. Required.
     */
    from: string;

    /**
     * Total number of recipients targeted (to + cc). Required.
     */
    totalRecipients: number;

    /**
     * Array of recipient metadata and sending roles. Required.
     */
    recipients: Array<{
      /**
       * Email address of the recipient. Required.
       */
      email: string;

      /**
       * Dispatch status for this recipient (e.g. 'sent'). Required.
       */
      status: string;

      /**
       * Role of the recipient (e.g. 'to', 'cc'). Required.
       */
      role: string;
    }>;

    /**
     * Aggregated send status (e.g., 'sent'). Required.
     */
    status: string;
  };

  /**
   * Error message if the transaction failed. Optional.
   */
  error?: string;

  /**
   * System reason code representing the failure category. Optional.
   */
  reasonCode?: string;
}

/**
 * Response returned from the marketing send email API.
 */
export interface SendMarketingEmailResponse {
  /**
   * Indicates whether the marketing email dispatch request succeeded. Required.
   */
  success: boolean;

  /**
   * Object containing transaction details if the dispatch request was successful. Optional.
   */
  data?: {
    /**
     * Confirmation status message. Optional.
     */
    message?: string;

    /**
     * Unique tracking message identifier generated for the marketing email transaction. Required.
     */
    messageId: string;

    /**
     * Sender email address used. Required.
     */
    from: string;

    /**
     * Total number of recipients targeted. Required.
     */
    totalRecipients: number;

    /**
     * Array of recipient metadata and sending roles. Required.
     */
    recipients: Array<{
      /**
       * Email address of the recipient. Required.
       */
      email: string;

      /**
       * Dispatch status for this recipient. Required.
       */
      status: string;

      /**
       * Role of the recipient (e.g. 'to'). Required.
       */
      role: string;
    }>;

    /**
     * Aggregated send status. Required.
     */
    status: string;
  };

  /**
   * Error message if the transaction failed. Optional.
   */
  error?: string;

  /**
   * System reason code representing the failure category. Optional.
   */
  reasonCode?: string;
}

// -------------------------------------------------------------
// Web Setup API Types
// -------------------------------------------------------------

/**
 * Represents a group of domains used for segregation.
 */
export interface DomainGroup {
  /**
   * The unique domain group identifier. Optional.
   */
  groupId?: string;

  /**
   * Name of the domain group. Required.
   */
  name: string;

  /**
   * Detailed description of the group's purpose. Optional.
   */
  description?: string;

  /**
   * Hex color code used to style group representation. Optional.
   */
  color?: string;

  /**
   * Icon representation name. Optional.
   */
  icon?: string;

  /**
   * Account owner ID. Optional.
   */
  ownerId?: string;
}

/**
 * Represents a sending domain configuration.
 */
export interface Domain {
  /**
   * Unique identifier of the sending domain. Optional.
   */
  domainId?: string;

  /**
   * The domain name (e.g. 'yourverifieddomain.com'). Required.
   */
  domain: string;

  /**
   * The associated target setup use-case identifier. Optional.
   */
  useCaseId?: string;

  /**
   * The domain group identifier this domain is assigned to. Optional.
   */
  groupId?: string;

  /**
   * Verification status of the domain configuration (e.g., 'verified', 'pending'). Optional.
   */
  status?: string;

  /**
   * The DNS verification records required to verify this domain. Optional.
   */
  dnsRecords?: DnsRecord[];
}

/**
 * Represents a required DNS record for domain verification.
 */
export interface DnsRecord {
  /**
   * DNS record type (e.g. 'TXT', 'CNAME', 'MX'). Required.
   */
  type: string;

  /**
   * Host name/record key prefix. Required.
   */
  name: string;

  /**
   * Required value or target of the record. Required.
   */
  value: string;

  /**
   * Verification status of this specific record (e.g. 'verified', 'pending'). Required.
   */
  status: string;

  /**
   * Priority field (applicable for MX records). Optional.
   */
  priority?: number;
}

/**
 * Represents a subscription list or contact group.
 */
export interface SubscriptionGroup {
  /**
   * Unique subscription group identifier. Optional.
   */
  groupId?: string;

  /**
   * Name of the group. Required.
   */
  name: string;

  /**
   * Brief description of the audience group. Optional.
   */
  description?: string;
}

/**
 * Represents an active contact / subscriber.
 */
export interface Subscriber {
  /**
   * Email address of the subscriber. Required.
   */
  email: string;

  /**
   * Optional first name. Optional.
   */
  firstName?: string;

  /**
   * Optional full name. Optional.
   */
  fullName?: string;

  /**
   * Optional phone number. Optional.
   */
  phone?: string;

  /**
   * How consent was obtained (e.g., 'single_opt_in', 'double_opt_in'). Optional.
   */
  consentMethod?: string;

  /**
   * Documented proof of consent (e.g. checkbox state, IP, form URL). Optional.
   */
  consentProof?: string;

  /**
   * Active status of the subscriber. Optional.
   */
  isActive?: boolean;

  /**
   * Custom key-value metadata store. Optional.
   */
  metadata?: Record<string, any>;
}

/**
 * Represents an email HTML/text template design.
 */
export interface EmailTemplate {
  /**
   * Unique template identifier. Optional.
   */
  templateId?: string;

  /**
   * Human-readable template name. Required.
   */
  name: string;

  /**
   * Default subject line associated with this template. Optional.
   */
  subject?: string;

  /**
   * HTML layout code of the template. Required.
   */
  html: string;

  /**
   * Intended template usage type (e.g. 'transactional' or 'marketing'). Optional.
   */
  type?: 'transactional' | 'marketing';

  /**
   * Variables defined within the template. Optional.
   */
  variables?: Array<{
    /**
     * Variable key placeholder name. Required.
     */
    name: string;

    /**
     * Expected type (e.g. 'string', 'number'). Required.
     */
    type: string;

    /**
     * Whether this variable must be provided during compilation. Required.
     */
    required: boolean;
  }>;
}

/**
 * Represents a webhook callback subscription.
 */
export interface Webhook {
  /**
   * Unique webhook subscription identifier. Optional.
   */
  webhookId?: string;

  /**
   * Target URL to receive POST event callbacks. Required.
   */
  url: string;

  /**
   * List of event types to trigger callbacks (e.g., 'delivery', 'bounce'). Required.
   */
  events: string[];

  /**
   * Optional description of the webhook callback purpose. Optional.
   */
  description?: string;
}

/**
 * Represents a domain configuration use case definition.
 */
export interface UseCase {
  /**
   * Unique use case identifier. Required.
   */
  useCaseId: string;

  /**
   * Use case name. Required.
   */
  name: string;

  /**
   * Description of what this use case sets up. Required.
   */
  description: string;
}
