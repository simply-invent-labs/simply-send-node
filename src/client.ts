import { SimplySendError, SimplySendValidationError, SimplySendHttpError } from './errors';
import {
  SimplySendTransactionalConfig,
  SimplySendMarketingConfig,
  SimplySendWebSetupConfig,
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

// ============================================================================
// 1. SimplySendTransactionalClient
// ============================================================================
export class SimplySendTransactionalClient {
  private accountId: string;
  private tapiKey: string;
  private emailApiUrl = 'https://tapi.simplysend.email';
  private timeout = 30000;

  constructor(config: SimplySendTransactionalConfig) {
    if (!config.accountId) {
      throw new SimplySendValidationError('Account ID (accountId) is required', 'accountId');
    }
    if (!config.tapiKey) {
      throw new SimplySendValidationError('Transactional API Key (tapiKey) is required', 'tapiKey');
    }
    this.accountId = config.accountId;
    this.tapiKey = config.tapiKey;
  }

  /**
   * Helper request wrapper for making HTTP calls using native fetch.
   */
  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: any;
      query?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const base = this.emailApiUrl.endsWith('/') ? this.emailApiUrl : `${this.emailApiUrl}/`;
    const cleanedPath = path.startsWith('/') ? path.slice(1) : path;
    const url = new URL(cleanedPath, base);

    if (options.query) {
      Object.entries(options.query).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          url.searchParams.append(key, val);
        }
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Api-Key': this.tapiKey,
      'X-Id': this.accountId,
    };

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

  /**
   * Send a transactional email.
   */
  public async send(payload: SendEmailRequest): Promise<SendEmailResponse> {
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

    const toValue = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;
    const ccValue = Array.isArray(payload.cc) ? payload.cc.join(', ') : payload.cc;

    const attachments = payload.attachments?.map((att) => {
      let contentStr = '';
      if (Buffer.isBuffer(att.content)) {
        contentStr = att.content.toString('base64');
      } else if (typeof att.content === 'string') {
        contentStr = att.content;
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

    return this.request<SendEmailResponse>('send', {
      method: 'POST',
      body,
    });
  }
}

// ============================================================================
// 2. SimplySendMarketingClient
// ============================================================================
export class SimplySendMarketingClient {
  private accountId: string;
  private mapiKey: string;
  private marketingApiUrl = 'https://mapi.simplysend.email';
  private timeout = 30000;

  constructor(config: SimplySendMarketingConfig) {
    if (!config.accountId) {
      throw new SimplySendValidationError('Account ID (accountId) is required', 'accountId');
    }
    if (!config.mapiKey) {
      throw new SimplySendValidationError('Marketing API Key (mapiKey) is required', 'mapiKey');
    }
    this.accountId = config.accountId;
    this.mapiKey = config.mapiKey;
  }

  /**
   * Helper request wrapper for making HTTP calls using native fetch.
   */
  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: any;
      query?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const base = this.marketingApiUrl.endsWith('/') ? this.marketingApiUrl : `${this.marketingApiUrl}/`;
    const cleanedPath = path.startsWith('/') ? path.slice(1) : path;
    const url = new URL(cleanedPath, base);

    if (options.query) {
      Object.entries(options.query).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          url.searchParams.append(key, val);
        }
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Api-Key': this.mapiKey,
      'X-Id': this.accountId,
    };

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

  /**
   * Send a marketing email (requires subscriptionGroupId).
   */
  public async send(payload: SendMarketingEmailRequest): Promise<SendEmailResponse> {
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
      throw new SimplySendValidationError(
        'Subscription Group ID (subscriptionGroupId) is required for marketing emails',
        'subscriptionGroupId'
      );
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

    return this.request<SendEmailResponse>('send', {
      method: 'POST',
      body,
    });
  }
}

// ============================================================================
// 3. SimplySendWebSetupClient
// ============================================================================
export class SimplySendWebSetupClient {
  private accountId: string;
  private wapiKey?: string;
  private wpaiKey?: string;
  private wapiSecret?: string;
  private webSetupApiUrl = 'https://wapi.simplysend.email/web-setup/';
  private timeout = 30000;

  constructor(config: SimplySendWebSetupConfig) {
    if (!config.accountId) {
      throw new SimplySendValidationError('Account ID (accountId) is required', 'accountId');
    }
    if (!config.wapiKey && !config.wpaiKey && !config.wapiSecret) {
      throw new SimplySendValidationError('Web Setup API Key (wapiKey/wpaiKey/wapiSecret) is required', 'wapiKey');
    }
    this.accountId = config.accountId;
    this.wapiKey = config.wapiKey;
    this.wpaiKey = config.wpaiKey;
    this.wapiSecret = config.wapiSecret;
  }

  /**
   * Helper request wrapper for making HTTP calls using native fetch.
   */
  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: any;
      query?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const base = this.webSetupApiUrl;
    const cleanedPath = path.startsWith('/') ? path.slice(1) : path;
    const url = new URL(cleanedPath, base);

    if (options.query) {
      Object.entries(options.query).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          url.searchParams.append(key, val);
        }
      });
    }

    const apiKeyToUse = this.wapiKey || this.wpaiKey || this.wapiSecret;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKeyToUse!,
      'X-Id': this.accountId,
    };

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
  // Namespace: domains
  // -------------------------------------------------------------
  public readonly domains = {
    list: async (): Promise<Domain[]> => {
      return this.request<Domain[]>('domains');
    },
    get: async (domainId: string): Promise<Domain> => {
      return this.request<Domain>(`domains/${domainId}`);
    },
    create: async (domain: Domain): Promise<Domain> => {
      return this.request<Domain>('domains', {
        method: 'PUT',
        body: domain,
      });
    },
    delete: async (domainId: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>(`domains/${domainId}`, {
        method: 'DELETE',
      });
    },
    getDnsRecords: async (domainId: string): Promise<DnsRecord[]> => {
      return this.request<DnsRecord[]>(`domains/${domainId}/dns-records`);
    },
    verify: async (domainId: string): Promise<{ success: boolean; message: string }> => {
      return this.request<{ success: boolean; message: string }>(`domains/${domainId}/verify`, {
        method: 'POST',
      });
    },
    assignGroup: async (domainId: string, groupId: string): Promise<{ success: boolean }> => {
      return this.request<{ success: boolean }>(`domains/${domainId}/assign-group`, {
        method: 'PUT',
        body: { groupId },
      });
    },
  };

  // -------------------------------------------------------------
  // Namespace: domainGroups
  // -------------------------------------------------------------
  public readonly domainGroups = {
    list: async (): Promise<DomainGroup[]> => {
      return this.request<DomainGroup[]>('domain-groups');
    },
    get: async (groupId: string): Promise<DomainGroup> => {
      return this.request<DomainGroup>(`domain-groups/${groupId}`);
    },
    getByOwner: async (ownerId: string): Promise<DomainGroup[]> => {
      return this.request<DomainGroup[]>(`domain-groups/owner/${ownerId}`);
    },
    create: async (group: DomainGroup): Promise<DomainGroup> => {
      return this.request<DomainGroup>('domain-groups', {
        method: 'POST',
        body: group,
      });
    },
    update: async (groupId: string, group: DomainGroup): Promise<DomainGroup> => {
      return this.request<DomainGroup>(`domain-groups/${groupId}`, {
        method: 'PUT',
        body: group,
      });
    },
    delete: async (groupId: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>(`domain-groups/${groupId}`, {
        method: 'DELETE',
      });
    },
  };

  // -------------------------------------------------------------
  // Namespace: subscriptionGroups
  // -------------------------------------------------------------
  public readonly subscriptionGroups = {
    list: async (): Promise<SubscriptionGroup[]> => {
      return this.request<SubscriptionGroup[]>('subscription-groups');
    },
    get: async (groupId: string): Promise<SubscriptionGroup> => {
      return this.request<SubscriptionGroup>(`subscription-groups/${groupId}`);
    },
    create: async (group: SubscriptionGroup): Promise<SubscriptionGroup> => {
      return this.request<SubscriptionGroup>('subscription-groups', {
        method: 'POST',
        body: group,
      });
    },
    update: async (groupId: string, group: SubscriptionGroup): Promise<SubscriptionGroup> => {
      return this.request<SubscriptionGroup>(`subscription-groups/${groupId}`, {
        method: 'PUT',
        body: group,
      });
    },
    delete: async (groupId: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>(`subscription-groups/${groupId}`, {
        method: 'DELETE',
      });
    },
  };

  // -------------------------------------------------------------
  // Namespace: subscribers
  // -------------------------------------------------------------
  public readonly subscribers = {
    add: async (groupId: string, subscriber: Subscriber): Promise<Subscriber> => {
      return this.request<Subscriber>(`subscription-groups/${groupId}/subscribers`, {
        method: 'POST',
        body: subscriber,
      });
    },
    get: async (groupId: string, email: string): Promise<Subscriber> => {
      return this.request<Subscriber>(`subscription-groups/${groupId}/subscribers/${email}`);
    },
    update: async (groupId: string, email: string, subscriber: Partial<Subscriber>): Promise<Subscriber> => {
      return this.request<Subscriber>(`subscription-groups/${groupId}/subscribers/${email}`, {
        method: 'PATCH',
        body: subscriber,
      });
    },
    delete: async (groupId: string, email: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>(
        `subscription-groups/${groupId}/subscribers/${email}`,
        {
          method: 'DELETE',
        }
      );
    },
  };

  // -------------------------------------------------------------
  // Namespace: templates
  // -------------------------------------------------------------
  public readonly templates = {
    list: async (): Promise<EmailTemplate[]> => {
      return this.request<EmailTemplate[]>('templates');
    },
    get: async (templateId: string): Promise<EmailTemplate> => {
      return this.request<EmailTemplate>(`templates/${templateId}`);
    },
    create: async (template: EmailTemplate): Promise<EmailTemplate> => {
      return this.request<EmailTemplate>('templates', {
        method: 'POST',
        body: template,
      });
    },
    update: async (templateId: string, template: EmailTemplate): Promise<EmailTemplate> => {
      return this.request<EmailTemplate>(`templates/${templateId}`, {
        method: 'PUT',
        body: template,
      });
    },
    delete: async (templateId: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>(`templates/${templateId}`, {
        method: 'DELETE',
      });
    },
  };

  // -------------------------------------------------------------
  // Namespace: webhooks
  // -------------------------------------------------------------
  public readonly webhooks = {
    list: async (): Promise<Webhook[]> => {
      return this.request<Webhook[]>('webhooks');
    },
    get: async (webhookId: string): Promise<Webhook> => {
      return this.request<Webhook>(`webhooks/${webhookId}`);
    },
    create: async (webhook: Webhook): Promise<Webhook> => {
      return this.request<Webhook>('webhooks', {
        method: 'POST',
        body: webhook,
      });
    },
    update: async (webhookId: string, webhook: Webhook): Promise<Webhook> => {
      return this.request<Webhook>(`webhooks/${webhookId}`, {
        method: 'PUT',
        body: webhook,
      });
    },
    delete: async (webhookId: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>(`webhooks/${webhookId}`, {
        method: 'DELETE',
      });
    },
  };

  public async getUseCases(): Promise<UseCase[]> {
    return this.request<UseCase[]>('use-cases');
  }

  public async getHealth(): Promise<{ status: string }> {
    return this.request<{ status: string }>('health');
  }
}
