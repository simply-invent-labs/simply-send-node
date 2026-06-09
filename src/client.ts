import { SimplySendError, SimplySendValidationError, SimplySendHttpError } from './errors';
import {
  SimplySendConfig,
  SendEmailRequest,
  SendEmailResponse,
  SendMarketingEmailRequest,
  DomainGroup,
  Domain,
  DnsRecord,
  SubscriptionGroup,
  Subscriber,
  EmailTemplate,
  Webhook,
  UseCase,
} from './types';

export class SimplySendClient {
  private tapiKey?: string;
  private mapiKey?: string;
  private wapiKey?: string;
  private wpaiKey?: string;
  private wapiSecret?: string;
  private accountId?: string;
  private emailApiUrl: string;
  private marketingApiUrl: string;
  private webSetupApiUrl: string;
  private timeout: number;

  constructor(config: SimplySendConfig) {
    if (!config.accountId) {
      throw new SimplySendValidationError('Account ID (accountId) is required', 'accountId');
    }
    if (!config.tapiKey && !config.mapiKey && !config.wapiKey && !config.wpaiKey && !config.wapiSecret) {
      throw new SimplySendValidationError('At least one API key (tapiKey, mapiKey, or wapiKey/wpaiKey) must be provided', 'tapiKey');
    }
    this.tapiKey = config.tapiKey;
    this.mapiKey = config.mapiKey;
    this.wapiKey = config.wapiKey;
    this.wpaiKey = config.wpaiKey;
    this.wapiSecret = config.wapiSecret;
    this.accountId = config.accountId;
    this.emailApiUrl = config.emailApiUrl || 'https://tapi.simplysend.email';
    this.marketingApiUrl = config.marketingApiUrl || 'https://mapi.simplysend.email';
    
    // Normalize Web Setup URL to always end with /web-setup/
    let setupUrl = config.webSetupApiUrl || 'https://wapi.simplysend.email/web-setup';
    if (!setupUrl.endsWith('/')) {
      setupUrl += '/';
    }
    this.webSetupApiUrl = setupUrl;
    
    this.timeout = config.timeout || 30000;
  }

  /**
   * Helper request wrapper for making HTTP calls using native fetch.
   */
  private async request<T>(
    baseUrl: string,
    path: string,
    options: {
      method?: string;
      body?: any;
      query?: Record<string, string>;
      requireAccountId?: boolean;
      isResourceManagement?: boolean;
    } = {}
  ): Promise<T> {
    // Clean base and path to ensure URL merges properly
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const cleanedPath = path.startsWith('/') ? path.slice(1) : path;
    const url = new URL(cleanedPath, base);

    if (options.query) {
      Object.entries(options.query).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          url.searchParams.append(key, val);
        }
      });
    }

    const isResourceManagement = options.isResourceManagement !== undefined
      ? options.isResourceManagement
      : (baseUrl === this.webSetupApiUrl || baseUrl.startsWith(this.webSetupApiUrl) || path.startsWith('web-setup') || baseUrl.includes('web-setup'));

    let apiKeyToUse: string | undefined;
    const isMarketingSend = !isResourceManagement && (baseUrl === this.marketingApiUrl || baseUrl.startsWith(this.marketingApiUrl));

    if (isResourceManagement) {
      apiKeyToUse = this.wapiKey || this.wpaiKey || this.wapiSecret;
    } else if (isMarketingSend) {
      apiKeyToUse = this.mapiKey;
    } else {
      apiKeyToUse = this.tapiKey;
    }

    if (!apiKeyToUse) {
      const errorMsg = isResourceManagement
        ? 'WAPI Secret (wapiKey/wpaiKey/wapiSecret) is required for resource management.'
        : isMarketingSend
          ? 'Marketing API Key (mapiKey) is required for marketing email sending.'
          : 'Transactional API Key (tapiKey) is required for transactional email sending.';
      throw new SimplySendValidationError(
        errorMsg,
        isResourceManagement ? 'wapiKey' : (isMarketingSend ? 'mapiKey' : 'tapiKey')
      );
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKeyToUse,
    };

    if (options.requireAccountId) {
      if (!this.accountId) {
        throw new SimplySendValidationError('Account ID (accountId) is required for this request.', 'accountId');
      }
      headers['X-Id'] = this.accountId;
    } else if (this.accountId) {
      headers['X-Id'] = this.accountId;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      let responseData: any;
      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch {
        responseData = { error: responseText || 'Unknown response format' };
      }

      if (!response.ok) {
        throw new SimplySendHttpError(response.status, responseData);
      }

      return responseData as T;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new SimplySendError(`Request timed out after ${this.timeout}ms`);
      }
      if (error instanceof SimplySendError) {
        throw error;
      }
      throw new SimplySendError(`Network request failed: ${error.message}`);
    }
  }

  // -------------------------------------------------------------
  // Namespace: emails
  // -------------------------------------------------------------
  public readonly emails = {
    /**
     * Send a transactional email.
     */
    send: async (payload: SendEmailRequest): Promise<SendEmailResponse> => {
      // Validate inputs
      if (!payload.to || (Array.isArray(payload.to) && payload.to.length === 0)) {
        throw new SimplySendValidationError('Recipient (to) is required', 'to');
      }
      if (!payload.subject) {
        throw new SimplySendValidationError('Subject is required', 'subject');
      }
      if (!payload.from) {
        throw new SimplySendValidationError('Sender (from) is required', 'from');
      }
      if (!payload.html) {
        throw new SimplySendValidationError('HTML content (html) is required', 'html');
      }

      // Map to/cc arrays to comma-separated strings if the API expects it, or keep array.
      // SimplySend API supports both, but we normalize to what the server needs.
      const toValue = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;
      const ccValue = Array.isArray(payload.cc) ? payload.cc.join(', ') : payload.cc;

      // Handle attachment formatting: Auto-convert raw buffers to base64 strings
      const attachments = payload.attachments?.map((att) => {
        let contentStr = '';
        if (Buffer.isBuffer(att.content)) {
          contentStr = att.content.toString('base64');
        } else if (typeof att.content === 'string') {
          // Check if it's already a base64 Data URL (e.g. data:application/pdf;base64,...)
          if (att.content.includes(';base64,')) {
            contentStr = att.content;
          } else {
            contentStr = att.content;
          }
        } else {
          throw new SimplySendValidationError(
            `Invalid attachment content for file '${att.name}'. Must be a string or a Buffer.`,
            'attachments'
          );
        }
        return {
          name: att.name,
          contentType: att.contentType,
          content: contentStr,
        };
      });

      const body = {
        to: toValue,
        subject: payload.subject,
        html: payload.html,
        from: payload.from,
        ...(ccValue && { cc: ccValue }),
        ...(payload.replyTo && { replyTo: payload.replyTo }),
        ...(payload.text && { text: payload.text }),
        ...(payload.enableClickTracking !== undefined && { enableClickTracking: payload.enableClickTracking }),
        ...(payload.headers && { headers: payload.headers }),
        ...(payload.templateVariables && { templateVariables: payload.templateVariables }),
        ...(attachments && attachments.length > 0 && { attachments }),
      };

      return this.request<SendEmailResponse>(this.emailApiUrl, 'send', {
        method: 'POST',
        body,
        requireAccountId: true,
      });
    },

    /**
     * Send a marketing email (requires subscriptionGroupId/contactListId).
     */
    sendMarketing: async (payload: SendMarketingEmailRequest): Promise<SendEmailResponse> => {
      // Validate inputs
      if (!payload.to || (Array.isArray(payload.to) && payload.to.length === 0)) {
        throw new SimplySendValidationError('Recipient (to) is required', 'to');
      }
      if (!payload.subject) {
        throw new SimplySendValidationError('Subject is required', 'subject');
      }
      if (!payload.from) {
        throw new SimplySendValidationError('Sender (from) is required', 'from');
      }
      if (!payload.html) {
        throw new SimplySendValidationError('HTML content (html) is required', 'html');
      }
      if (!payload.subscriptionGroupId) {
        throw new SimplySendValidationError('Subscription Group ID (subscriptionGroupId) is required for marketing emails', 'subscriptionGroupId');
      }

      const toValue = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;

      const body = {
        to: toValue,
        subject: payload.subject,
        html: payload.html,
        from: payload.from,
        subscriptionGroupId: payload.subscriptionGroupId,
        ...(payload.campaignId && { campaignId: payload.campaignId }),
        ...(payload.text && { text: payload.text }),
        ...(payload.enableClickTracking !== undefined && { enableClickTracking: payload.enableClickTracking }),
        ...(payload.headers && { headers: payload.headers }),
        ...(payload.templateVariables && { templateVariables: payload.templateVariables }),
      };

      return this.request<SendEmailResponse>(this.marketingApiUrl, 'send', {
        method: 'POST',
        body,
        requireAccountId: true,
      });
    },
  };

  // -------------------------------------------------------------
  // Namespace: domains
  // -------------------------------------------------------------
  public readonly domains = {
    list: async (): Promise<Domain[]> => {
      return this.request<Domain[]>(this.webSetupApiUrl, 'domains', { requireAccountId: true });
    },
    get: async (domainId: string): Promise<Domain> => {
      return this.request<Domain>(this.webSetupApiUrl, `domains/${domainId}`, { requireAccountId: true });
    },
    create: async (domain: Domain): Promise<Domain> => {
      return this.request<Domain>(this.webSetupApiUrl, 'domains', {
        method: 'PUT',
        body: domain,
        requireAccountId: true,
      });
    },
    delete: async (domainId: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>(this.webSetupApiUrl, `domains/${domainId}`, {
        method: 'DELETE',
        requireAccountId: true,
      });
    },
    getDnsRecords: async (domainId: string): Promise<DnsRecord[]> => {
      return this.request<DnsRecord[]>(this.webSetupApiUrl, `domains/${domainId}/dns-records`, {
        requireAccountId: true,
      });
    },
    verify: async (domainId: string): Promise<{ success: boolean; message: string }> => {
      return this.request<{ success: boolean; message: string }>(this.webSetupApiUrl, `domains/${domainId}/verify`, {
        method: 'POST',
        requireAccountId: true,
      });
    },
    assignGroup: async (domainId: string, groupId: string): Promise<{ success: boolean }> => {
      return this.request<{ success: boolean }>(this.webSetupApiUrl, `domains/${domainId}/assign-group`, {
        method: 'PUT',
        body: { groupId },
        requireAccountId: true,
      });
    },
  };

  // -------------------------------------------------------------
  // Namespace: domainGroups
  // -------------------------------------------------------------
  public readonly domainGroups = {
    list: async (): Promise<DomainGroup[]> => {
      return this.request<DomainGroup[]>(this.webSetupApiUrl, 'domain-groups', { requireAccountId: true });
    },
    get: async (groupId: string): Promise<DomainGroup> => {
      return this.request<DomainGroup>(this.webSetupApiUrl, `domain-groups/${groupId}`, { requireAccountId: true });
    },
    getByOwner: async (ownerId: string): Promise<DomainGroup[]> => {
      return this.request<DomainGroup[]>(this.webSetupApiUrl, `domain-groups/owner/${ownerId}`, {
        requireAccountId: true,
      });
    },
    create: async (group: DomainGroup): Promise<DomainGroup> => {
      return this.request<DomainGroup>(this.webSetupApiUrl, 'domain-groups', {
        method: 'POST',
        body: group,
        requireAccountId: true,
      });
    },
    update: async (groupId: string, group: DomainGroup): Promise<DomainGroup> => {
      return this.request<DomainGroup>(this.webSetupApiUrl, `domain-groups/${groupId}`, {
        method: 'PUT',
        body: group,
        requireAccountId: true,
      });
    },
    delete: async (groupId: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>(this.webSetupApiUrl, `domain-groups/${groupId}`, {
        method: 'DELETE',
        requireAccountId: true,
      });
    },
  };

  // -------------------------------------------------------------
  // Namespace: subscriptionGroups
  // -------------------------------------------------------------
  public readonly subscriptionGroups = {
    list: async (): Promise<SubscriptionGroup[]> => {
      return this.request<SubscriptionGroup[]>(this.webSetupApiUrl, 'subscription-groups', { requireAccountId: true });
    },
    get: async (groupId: string): Promise<SubscriptionGroup> => {
      return this.request<SubscriptionGroup>(this.webSetupApiUrl, `subscription-groups/${groupId}`, {
        requireAccountId: true,
      });
    },
    create: async (group: SubscriptionGroup): Promise<SubscriptionGroup> => {
      return this.request<SubscriptionGroup>(this.webSetupApiUrl, 'subscription-groups', {
        method: 'POST',
        body: group,
        requireAccountId: true,
      });
    },
    update: async (groupId: string, group: SubscriptionGroup): Promise<SubscriptionGroup> => {
      return this.request<SubscriptionGroup>(this.webSetupApiUrl, `subscription-groups/${groupId}`, {
        method: 'PUT',
        body: group,
        requireAccountId: true,
      });
    },
    delete: async (groupId: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>(this.webSetupApiUrl, `subscription-groups/${groupId}`, {
        method: 'DELETE',
        requireAccountId: true,
      });
    },
  };

  // -------------------------------------------------------------
  // Namespace: subscribers
  // -------------------------------------------------------------
  public readonly subscribers = {
    add: async (groupId: string, subscriber: Subscriber): Promise<Subscriber> => {
      return this.request<Subscriber>(this.webSetupApiUrl, `subscription-groups/${groupId}/subscribers`, {
        method: 'POST',
        body: subscriber,
        requireAccountId: true,
      });
    },
    get: async (groupId: string, email: string): Promise<Subscriber> => {
      return this.request<Subscriber>(this.webSetupApiUrl, `subscription-groups/${groupId}/subscribers/${email}`, {
        requireAccountId: true,
      });
    },
    update: async (groupId: string, email: string, subscriber: Partial<Subscriber>): Promise<Subscriber> => {
      return this.request<Subscriber>(this.webSetupApiUrl, `subscription-groups/${groupId}/subscribers/${email}`, {
        method: 'PATCH',
        body: subscriber,
        requireAccountId: true,
      });
    },
    delete: async (groupId: string, email: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>(
        this.webSetupApiUrl,
        `subscription-groups/${groupId}/subscribers/${email}`,
        {
          method: 'DELETE',
          requireAccountId: true,
        }
      );
    },
  };

  // -------------------------------------------------------------
  // Namespace: templates
  // -------------------------------------------------------------
  public readonly templates = {
    list: async (): Promise<EmailTemplate[]> => {
      return this.request<EmailTemplate[]>(this.webSetupApiUrl, 'templates', { requireAccountId: true });
    },
    get: async (templateId: string): Promise<EmailTemplate> => {
      return this.request<EmailTemplate>(this.webSetupApiUrl, `templates/${templateId}`, { requireAccountId: true });
    },
    create: async (template: EmailTemplate): Promise<EmailTemplate> => {
      return this.request<EmailTemplate>(this.webSetupApiUrl, 'templates', {
        method: 'POST',
        body: template,
        requireAccountId: true,
      });
    },
    update: async (templateId: string, template: EmailTemplate): Promise<EmailTemplate> => {
      return this.request<EmailTemplate>(this.webSetupApiUrl, `templates/${templateId}`, {
        method: 'PUT',
        body: template,
        requireAccountId: true,
      });
    },
    delete: async (templateId: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>(this.webSetupApiUrl, `templates/${templateId}`, {
        method: 'DELETE',
        requireAccountId: true,
      });
    },
  };

  // -------------------------------------------------------------
  // Namespace: webhooks
  // -------------------------------------------------------------
  public readonly webhooks = {
    list: async (): Promise<Webhook[]> => {
      return this.request<Webhook[]>(this.webSetupApiUrl, 'webhooks', { requireAccountId: true });
    },
    get: async (webhookId: string): Promise<Webhook> => {
      return this.request<Webhook>(this.webSetupApiUrl, `webhooks/${webhookId}`, { requireAccountId: true });
    },
    create: async (webhook: Webhook): Promise<Webhook> => {
      return this.request<Webhook>(this.webSetupApiUrl, 'webhooks', {
        method: 'POST',
        body: webhook,
        requireAccountId: true,
      });
    },
    update: async (webhookId: string, webhook: Webhook): Promise<Webhook> => {
      return this.request<Webhook>(this.webSetupApiUrl, `webhooks/${webhookId}`, {
        method: 'PUT',
        body: webhook,
        requireAccountId: true,
      });
    },
    delete: async (webhookId: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>(this.webSetupApiUrl, `webhooks/${webhookId}`, {
        method: 'DELETE',
        requireAccountId: true,
      });
    },
  };

  // -------------------------------------------------------------
  // General resources & health check
  // -------------------------------------------------------------
  public async getUseCases(): Promise<UseCase[]> {
    return this.request<UseCase[]>(this.webSetupApiUrl, 'use-cases', { requireAccountId: true });
  }

  public async getHealth(): Promise<{ status: string }> {
    return this.request<{ status: string }>(this.webSetupApiUrl, 'health', { requireAccountId: false });
  }
}
