import { SimplySendError, SimplySendValidationError, SimplySendHttpError } from './errors';
import {
  SimplySendTransactionalConfig,
  SimplySendMarketingConfig,
  SimplySendWebSetupConfig,
  SendTransactionalEmailRequest,
  SendTransactionalEmailResponse,
  SendMarketingEmailResponse,
  SendMarketingEmailRequest,
  DomainGroup,
  Domain,
  DnsRecord,
  SubscriptionGroup,
  Contact,
  SubscriberRequest,
  SubscriberResponse,
  ListContactsResponse,
  GetContactResponse,
  UpsertContactResponse,
  DeleteContactResponse,
  ListSubscriptionGroupsResponse,
  GetSubscriptionGroupResponse,
  CreateSubscriptionGroupResponse,
  UpdateSubscriptionGroupResponse,
  DeleteSubscriptionGroupResponse,
  ListSubscribersResponse,
  AddSubscriberResponse,
  DeleteSubscriberResponse,
  EmailTemplate,
  Webhook,
  UseCase,
} from './types';

// ============================================================================
// 1. SimplySendTransactionalClient
// ============================================================================

/**
 * Client for sending transactional emails via the SimplySend Transactional API (tapi).
 * Transactional emails are usually triggered automatically by user actions (e.g. OTPs, order receipts, alerts).
 */
export class SimplySendTransactionalClient {
  /**
   * The SimplySend Account ID, found on the Account page of the SimplySend website (https://app.simplysend.email/account).
   */
  private accountId: string;

  /**
   * The SimplySend API Key for transactional sending (tapi), found on the API Keys page of the SimplySend website (https://app.simplysend.email/api-keys).
   */
  private apiKey: string;

  /**
   * The base URL for the transactional API.
   */
  private emailApiUrl = 'https://tapi.simplysend.email';

  /**
   * Default HTTP request timeout in milliseconds (30 seconds).
   */
  private timeout = 30000;

  /**
   * Creates an instance of SimplySendTransactionalClient.
   * 
   * @param config The client configuration object.
   * @throws SimplySendValidationError If accountId or apiKey are missing.
   */
  constructor(config: SimplySendTransactionalConfig) {
    if (!config.accountId) {
      throw new SimplySendValidationError('Account ID (accountId) is required', 'accountId');
    }
    if (!config.apiKey) {
      throw new SimplySendValidationError('API Key (apiKey) is required', 'apiKey');
    }
    this.accountId = config.accountId;
    this.apiKey = config.apiKey;
    if (config.baseUrl) {
      this.emailApiUrl = config.baseUrl;
    }
  }

  /**
   * Helper request wrapper for making HTTP calls using native fetch.
   * Handles timeouts, standard headers, and response status mapping.
   * 
   * @template T The expected JSON response model.
   * @param path The API endpoint path.
   * @param options HTTP method, body payload, and query parameters.
   * @returns Resolves to the typed response.
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
      'X-Api-Key': this.apiKey,
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
   * Namespaced transactional email API operations.
   */
  public readonly email = {
    /**
     * Sends a transactional email.
     * Smartly automatically encodes attachments if passed as raw node buffers.
     * 
     * @param payload Transactional email request fields.
     * @returns A promise resolving to the send transaction details.
     * @throws SimplySendValidationError If local validation checks fail (e.g. missing recipient, subject, body, or invalid attachments).
     * @throws SimplySendHttpError If the API endpoint responds with a non-2xx status code.
     */
    send: async (payload: SendTransactionalEmailRequest): Promise<SendTransactionalEmailResponse> => {
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

      return this.request<SendTransactionalEmailResponse>('send', {
        method: 'POST',
        body,
      });
    }
  };
}

// ============================================================================
// 2. SimplySendMarketingClient
// ============================================================================

/**
 * Client for sending marketing emails via the SimplySend Marketing API (mapi).
 * Marketing emails require a valid subscription group ID for unsubscribe compliance.
 */
export class SimplySendMarketingClient {
  /**
   * The SimplySend Account ID, found on the Account page of the SimplySend website (https://app.simplysend.email/account).
   */
  private accountId: string;

  /**
   * The SimplySend API Key for marketing sending (mapi), found on the API Keys page of the SimplySend website (https://app.simplysend.email/api-keys).
   */
  private apiKey: string;

  /**
   * The base URL for the marketing API.
   */
  private marketingApiUrl = 'https://mapi.simplysend.email';

  /**
   * Default HTTP request timeout in milliseconds (30 seconds).
   */
  private timeout = 30000;

  /**
   * Creates an instance of SimplySendMarketingClient.
   * 
   * @param config The client configuration object.
   * @throws SimplySendValidationError If accountId or apiKey are missing.
   */
  constructor(config: SimplySendMarketingConfig) {
    if (!config.accountId) {
      throw new SimplySendValidationError('Account ID (accountId) is required', 'accountId');
    }
    if (!config.apiKey) {
      throw new SimplySendValidationError('API Key (apiKey) is required', 'apiKey');
    }
    this.accountId = config.accountId;
    this.apiKey = config.apiKey;
    if (config.baseUrl) {
      this.marketingApiUrl = config.baseUrl;
    }
  }

  /**
   * Helper request wrapper for making HTTP calls using native fetch.
   * Handles timeouts, standard headers, and response status mapping.
   * 
   * @template T The expected JSON response model.
   * @param path The API endpoint path.
   * @param options HTTP method, body payload, and query parameters.
   * @returns Resolves to the typed response.
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
      'X-Api-Key': this.apiKey,
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
   * Namespaced marketing email API operations.
   */
  public readonly email = {
    /**
     * Sends a marketing email.
     * Complies with email laws by requiring a subscriptionGroupId.
     * 
     * @param payload Marketing email request fields.
     * @returns A promise resolving to the send transaction details.
     * @throws SimplySendValidationError If local validation checks fail (e.g. missing recipient, subject, subscriptionGroupId).
     * @throws SimplySendHttpError If the API endpoint responds with a non-2xx status code.
     */
    send: async (payload: SendMarketingEmailRequest): Promise<SendMarketingEmailResponse> => {
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

      return this.request<SendMarketingEmailResponse>('send', {
        method: 'POST',
        body,
      });
    }
  };
}

// ============================================================================
// 3. SimplySendWebSetupClient
// ============================================================================

/**
 * Client for managing account resources such as domains, groups, templates, subscribers, and webhooks.
 * Connects to the SimplySend Web Setup API (wapi).
 */
export class SimplySendWebSetupClient {
  /**
   * The SimplySend Account ID, found on the Account page of the SimplySend website (https://app.simplysend.email/account).
   */
  private accountId: string;

  /**
   * The resolved Web Setup API Key (wapi), found on the API Keys page of the SimplySend website (https://app.simplysend.email/api-keys).
   */
  private wapiKey: string;

  /**
   * The base URL for the Web Setup API.
   */
  private webSetupApiUrl = 'https://wapi.simplysend.email/web-setup/';

  /**
   * Default HTTP request timeout in milliseconds (30 seconds).
   */
  private timeout = 30000;

  /**
   * Creates an instance of SimplySendWebSetupClient.
   * 
   * @param config The client configuration object. Requires accountId and apiKey.
   * @throws SimplySendValidationError If accountId or apiKey configuration is missing.
   */
  constructor(config: SimplySendWebSetupConfig) {
    if (!config.accountId) {
      throw new SimplySendValidationError('Account ID (accountId) is required', 'accountId');
    }
    if (!config.apiKey) {
      throw new SimplySendValidationError('API Key (apiKey) is required', 'apiKey');
    }
    this.accountId = config.accountId;
    this.wapiKey = config.apiKey;
    if (config.baseUrl) {
      this.webSetupApiUrl = config.baseUrl.endsWith('/') ? config.baseUrl : `${config.baseUrl}/`;
    }
  }

  /**
   * Helper request wrapper for making HTTP calls using native fetch.
   * Handles timeouts, standard headers, and response status mapping.
   * 
   * @template T The expected JSON response model.
   * @param path The API endpoint path.
   * @param options HTTP method, body payload, and query parameters.
   * @returns Resolves to the typed response.
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

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Api-Key': this.wapiKey,
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
  /**
   * Namespace container for managing sending domains.
   */
  public readonly domains = {
    /**
     * Retrieves the list of domains associated with your account.
     * @returns A promise resolving to an array of Domain objects.
     */
    list: async (): Promise<Domain[]> => {
      return this.request<Domain[]>('domains');
    },

    /**
     * Gets verification details for a single domain.
     * @param domainId The unique identifier of the domain.
     * @returns A promise resolving to the Domain configuration.
     */
    get: async (domainId: string): Promise<Domain> => {
      return this.request<Domain>(`domains/${domainId}`);
    },

    /**
     * Registers a new sending domain under your account.
     * @param domain Domain parameters including name and useCaseId.
     * @returns A promise resolving to the newly created Domain object (containing its DNS verification records).
     */
    create: async (domain: Domain): Promise<Domain> => {
      return this.request<Domain>('domains', {
        method: 'PUT',
        body: domain,
      });
    },

    /**
     * Removes a sending domain from your account.
     * @param domainId The unique identifier of the domain to delete.
     * @returns A success message confirmation.
     */
    delete: async (domainId: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>(`domains/${domainId}`, {
        method: 'DELETE',
      });
    },

    /**
     * Retrieves the specific DNS verification records required to verify ownership of a domain.
     * @param domainId The unique identifier of the domain.
     * @returns A list of DNS records (DKIM, SPF, tracking, etc.).
     */
    getDnsRecords: async (domainId: string): Promise<DnsRecord[]> => {
      return this.request<DnsRecord[]>(`domains/${domainId}/dns-records`);
    },

    /**
     * Triggers the SimplySend verification system to check DNS records for validation.
     * @param domainId The unique identifier of the domain.
     * @returns Verification success state and message.
     */
    verify: async (domainId: string): Promise<{ success: boolean; message: string }> => {
      return this.request<{ success: boolean; message: string }>(`domains/${domainId}/verify`, {
        method: 'POST',
      });
    },

    /**
     * Assigns a verified sending domain to a specific domain routing group.
     * @param domainId The unique identifier of the domain.
     * @param groupId The unique identifier of the target group.
     * @returns Operation success indicator.
     */
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
  /**
   * Namespace container for managing domain groups.
   */
  public readonly domainGroups = {
    /**
     * Lists all domain groups.
     * @returns A promise resolving to an array of DomainGroup objects.
     */
    list: async (): Promise<DomainGroup[]> => {
      return this.request<DomainGroup[]>('domain-groups');
    },

    /**
     * Gets a single domain group details.
     * @param groupId Unique group ID.
     * @returns The DomainGroup object.
     */
    get: async (groupId: string): Promise<DomainGroup> => {
      return this.request<DomainGroup>(`domain-groups/${groupId}`);
    },

    /**
     * Lists domain groups belonging to a specific owner.
     * @param ownerId The owner identifier.
     * @returns An array of domain groups.
     */
    getByOwner: async (ownerId: string): Promise<DomainGroup[]> => {
      return this.request<DomainGroup[]>(`domain-groups/owner/${ownerId}`);
    },

    /**
     * Creates a new domain group.
     * @param group The domain group parameters.
     * @returns The created DomainGroup object.
     */
    create: async (group: DomainGroup): Promise<DomainGroup> => {
      return this.request<DomainGroup>('domain-groups', {
        method: 'POST',
        body: group,
      });
    },

    /**
     * Updates domain group metadata.
     * @param groupId Unique group ID.
     * @param group The updated properties.
     * @returns The updated DomainGroup.
     */
    update: async (groupId: string, group: DomainGroup): Promise<DomainGroup> => {
      return this.request<DomainGroup>(`domain-groups/${groupId}`, {
        method: 'PUT',
        body: group,
      });
    },

    /**
     * Deletes a domain group.
     * @param groupId Unique group ID.
     * @returns Success message confirmation.
     */
    delete: async (groupId: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>(`domain-groups/${groupId}`, {
        method: 'DELETE',
      });
    },
  };

  // -------------------------------------------------------------
  // Namespace: contacts
  // -------------------------------------------------------------
  /**
   * Namespace container for managing contacts, subscription groups, and subscriber lists.
   */
  public readonly contacts = {
    // === Global Contacts Directory ===
    /**
     * Retrieves the list of contacts globally in the Contacts Directory.
     * @param query Optional filtering and pagination params.
     * @returns A promise resolving to ListContactsResponse.
     */
    list: async (query?: {
      limit?: number;
      search?: string;
      status?: string;
      lastKey?: string;
    }): Promise<ListContactsResponse> => {
      const queryParams: Record<string, string> = {};
      if (query) {
        if (query.limit !== undefined) queryParams.limit = String(query.limit);
        if (query.search !== undefined) queryParams.search = query.search;
        if (query.status !== undefined) queryParams.status = query.status;
        if (query.lastKey !== undefined) queryParams.lastKey = query.lastKey;
      }
      return this.request<ListContactsResponse>('contacts', { query: queryParams });
    },

    /**
     * Retrieves details for a specific contact from the directory, including list memberships.
     * @param contactIdentifier The secure contact identifier (e.g. 'email:<md5>' or 'phone:<md5>').
     * @returns A promise resolving to GetContactResponse.
     */
    get: async (contactIdentifier: string): Promise<GetContactResponse> => {
      if (!contactIdentifier) {
        throw new SimplySendValidationError('Contact identifier is required', 'contactIdentifier');
      }
      if (!contactIdentifier.includes(':')) {
        throw new SimplySendValidationError('Contact identifier must be a secure hashed value (e.g. \'email:<md5>\' or \'phone:<md5>\')', 'contactIdentifier');
      }
      return this.request<GetContactResponse>(`contacts/${encodeURIComponent(contactIdentifier)}`);
    },

    /**
     * Creates a new contact profile in the directory.
     * @param contact Profile data including email or phone.
     * @returns A promise resolving to UpsertContactResponse.
     */
    create: async (contact: Partial<Contact>): Promise<UpsertContactResponse> => {
      if (!contact.email && !contact.phone) {
        throw new SimplySendValidationError('Either email or phone is required to create a contact', 'email');
      }
      return this.request<UpsertContactResponse>('contacts', {
        method: 'POST',
        body: contact,
      });
    },

    /**
     * Idempotently creates or updates a global contact profile.
     * @param contactIdentifier The secure contact identifier (e.g. 'email:<md5>' or 'phone:<md5>').
     * @param contact Profile data to set.
     * @returns A promise resolving to UpsertContactResponse.
     */
    createOrUpdate: async (contactIdentifier: string, contact: Partial<Contact>): Promise<UpsertContactResponse> => {
      if (!contactIdentifier) {
        throw new SimplySendValidationError('Contact identifier is required', 'contactIdentifier');
      }
      if (!contactIdentifier.includes(':')) {
        throw new SimplySendValidationError('Contact identifier must be a secure hashed value (e.g. \'email:<md5>\' or \'phone:<md5>\')', 'contactIdentifier');
      }
      return this.request<UpsertContactResponse>(`contacts/${encodeURIComponent(contactIdentifier)}`, {
        method: 'PUT',
        body: contact,
      });
    },

    /**
     * Deletes a contact profile globally from the Contacts Directory (retaining unsubscribe compliance logs).
     * @param contactIdentifier The secure contact identifier (e.g. 'email:<md5>' or 'phone:<md5>').
     * @returns A promise resolving to DeleteContactResponse.
     */
    delete: async (contactIdentifier: string): Promise<DeleteContactResponse> => {
      if (!contactIdentifier) {
        throw new SimplySendValidationError('Contact identifier is required', 'contactIdentifier');
      }
      if (!contactIdentifier.includes(':')) {
        throw new SimplySendValidationError('Contact identifier must be a secure hashed value (e.g. \'email:<md5>\' or \'phone:<md5>\')', 'contactIdentifier');
      }
      return this.request<DeleteContactResponse>(`contacts/${encodeURIComponent(contactIdentifier)}`, {
        method: 'DELETE',
      });
    },

    // === Subscription Groups ===
    /**
     * Lists all subscription groups.
     * @returns A promise resolving to ListSubscriptionGroupsResponse.
     */
    listGroups: async (): Promise<ListSubscriptionGroupsResponse> => {
      return this.request<ListSubscriptionGroupsResponse>('contacts/subscription-groups');
    },

    /**
     * Gets details for a single subscription group.
     * @param groupId The group identifier (contactListId).
     * @returns A promise resolving to GetSubscriptionGroupResponse.
     */
    getGroup: async (groupId: string): Promise<GetSubscriptionGroupResponse> => {
      if (!groupId) {
        throw new SimplySendValidationError('Group ID (groupId) is required', 'groupId');
      }
      return this.request<GetSubscriptionGroupResponse>(`contacts/subscription-groups/${groupId}`);
    },

    /**
     * Creates a new subscription group.
     * @param group Group parameters.
     * @returns A promise resolving to CreateSubscriptionGroupResponse.
     */
    createGroup: async (group: SubscriptionGroup): Promise<CreateSubscriptionGroupResponse> => {
      if (!group.name) {
        throw new SimplySendValidationError('Group name is required', 'name');
      }
      return this.request<CreateSubscriptionGroupResponse>('contacts/subscription-groups', {
        method: 'POST',
        body: group,
      });
    },

    /**
     * Updates properties on an existing subscription group.
     * @param groupId The group identifier (contactListId).
     * @param group Updated parameters.
     * @returns A promise resolving to UpdateSubscriptionGroupResponse.
     */
    updateGroup: async (groupId: string, group: Partial<SubscriptionGroup>): Promise<UpdateSubscriptionGroupResponse> => {
      if (!groupId) {
        throw new SimplySendValidationError('Group ID (groupId) is required', 'groupId');
      }
      return this.request<UpdateSubscriptionGroupResponse>(`contacts/subscription-groups/${groupId}`, {
        method: 'PUT',
        body: group,
      });
    },

    /**
     * Removes a subscription group.
     * @param groupId The group identifier (contactListId) to delete.
     * @returns A promise resolving to DeleteSubscriptionGroupResponse.
     */
    deleteGroup: async (groupId: string): Promise<DeleteSubscriptionGroupResponse> => {
      if (!groupId) {
        throw new SimplySendValidationError('Group ID (groupId) is required', 'groupId');
      }
      return this.request<DeleteSubscriptionGroupResponse>(`contacts/subscription-groups/${groupId}`, {
        method: 'DELETE',
      });
    },

    // === Group Subscribers (Memberships) ===
    /**
     * Lists subscribers within a specific subscription group.
     * @param groupId The target subscription group ID.
     * @param query Optional filtering and pagination parameters.
     * @returns A promise resolving to ListSubscribersResponse.
     */
    listSubscribers: async (
      groupId: string,
      query?: {
        limit?: number;
        search?: string;
        isActive?: boolean | string;
        lastKey?: string;
      }
    ): Promise<ListSubscribersResponse> => {
      if (!groupId) {
        throw new SimplySendValidationError('Group ID (groupId) is required', 'groupId');
      }
      const queryParams: Record<string, string> = {};
      if (query) {
        if (query.limit !== undefined) queryParams.limit = String(query.limit);
        if (query.search !== undefined) queryParams.search = query.search;
        if (query.isActive !== undefined) queryParams.isActive = String(query.isActive);
        if (query.lastKey !== undefined) queryParams.lastKey = query.lastKey;
      }
      return this.request<ListSubscribersResponse>(`contacts/subscription-groups/${groupId}/subscriptions`, {
        query: queryParams,
      });
    },

    /**
     * Subscribes a contact to a subscription group. Fails if the contact does not exist globally.
     * @param groupId The target subscription group ID.
     * @param subscriber Subscriber request data containing email or contactIdentifier.
     * @returns A promise resolving to AddSubscriberResponse.
     */
    addSubscriber: async (groupId: string, subscriber: SubscriberRequest): Promise<AddSubscriberResponse> => {
      if (!groupId) {
        throw new SimplySendValidationError('Group ID (groupId) is required', 'groupId');
      }
      if (!subscriber.email && !subscriber.contactIdentifier && !subscriber.phone) {
        throw new SimplySendValidationError('Subscriber identifier (email, phone, or contactIdentifier) is required', 'subscriber');
      }
      return this.request<AddSubscriberResponse>(`contacts/subscription-groups/${groupId}/subscriptions`, {
        method: 'POST',
        body: subscriber,
      });
    },

    /**
     * Retrieves subscription membership details for a specific subscriber in a group.
     * @param groupId The subscription group ID.
     * @param contactIdentifier The secure contact identifier (e.g. 'email:<md5>' or 'phone:<md5>').
     * @returns A promise resolving to SubscriberResponse.
     */
    getSubscriber: async (groupId: string, contactIdentifier: string): Promise<SubscriberResponse> => {
      if (!groupId) {
        throw new SimplySendValidationError('Group ID (groupId) is required', 'groupId');
      }
      if (!contactIdentifier) {
        throw new SimplySendValidationError('Contact identifier is required', 'contactIdentifier');
      }
      if (!contactIdentifier.includes(':')) {
        throw new SimplySendValidationError('Contact identifier must be a secure hashed value (e.g. \'email:<md5>\' or \'phone:<md5>\')', 'contactIdentifier');
      }
      return this.request<SubscriberResponse>(
        `contacts/subscription-groups/${groupId}/subscriptions/${encodeURIComponent(contactIdentifier)}`
      );
    },

    /**
     * Idempotently subscribes or updates consent/status for a contact in a group.
     * @param groupId The subscription group ID.
     * @param contactIdentifier The secure contact identifier (e.g. 'email:<md5>' or 'phone:<md5>').
     * @param subscriber Subscriber membership data.
     * @returns A promise resolving to AddSubscriberResponse.
     */
    upsertSubscriber: async (
      groupId: string,
      contactIdentifier: string,
      subscriber: SubscriberRequest
    ): Promise<AddSubscriberResponse> => {
      if (!groupId) {
        throw new SimplySendValidationError('Group ID (groupId) is required', 'groupId');
      }
      if (!contactIdentifier) {
        throw new SimplySendValidationError('Contact identifier is required', 'contactIdentifier');
      }
      if (!contactIdentifier.includes(':')) {
        throw new SimplySendValidationError('Contact identifier must be a secure hashed value (e.g. \'email:<md5>\' or \'phone:<md5>\')', 'contactIdentifier');
      }
      return this.request<AddSubscriberResponse>(
        `contacts/subscription-groups/${groupId}/subscriptions/${encodeURIComponent(contactIdentifier)}`,
        {
          method: 'PUT',
          body: subscriber,
        }
      );
    },

    /**
     * Updates membership fields (e.g. toggling active status) for a subscriber.
     * @param groupId The subscription group ID.
     * @param contactIdentifier The secure contact identifier (e.g. 'email:<md5>' or 'phone:<md5>').
     * @param subscriber Partial subscriber fields to update.
     * @returns A promise resolving to AddSubscriberResponse.
     */
    updateSubscriber: async (
      groupId: string,
      contactIdentifier: string,
      subscriber: Partial<SubscriberRequest>
    ): Promise<AddSubscriberResponse> => {
      if (!groupId) {
        throw new SimplySendValidationError('Group ID (groupId) is required', 'groupId');
      }
      if (!contactIdentifier) {
        throw new SimplySendValidationError('Contact identifier is required', 'contactIdentifier');
      }
      if (!contactIdentifier.includes(':')) {
        throw new SimplySendValidationError('Contact identifier must be a secure hashed value (e.g. \'email:<md5>\' or \'phone:<md5>\')', 'contactIdentifier');
      }
      return this.request<AddSubscriberResponse>(
        `contacts/subscription-groups/${groupId}/subscriptions/${encodeURIComponent(contactIdentifier)}`,
        {
          method: 'PATCH',
          body: subscriber,
        }
      );
    },

    /**
     * Unsubscribes/removes a contact from a subscription group.
     * @param groupId The subscription group ID.
     * @param contactIdentifier The secure contact identifier (e.g. 'email:<md5>' or 'phone:<md5>').
     * @returns A promise resolving to DeleteSubscriberResponse.
     */
    deleteSubscriber: async (groupId: string, contactIdentifier: string): Promise<DeleteSubscriberResponse> => {
      if (!groupId) {
        throw new SimplySendValidationError('Group ID (groupId) is required', 'groupId');
      }
      if (!contactIdentifier) {
        throw new SimplySendValidationError('Contact identifier is required', 'contactIdentifier');
      }
      if (!contactIdentifier.includes(':')) {
        throw new SimplySendValidationError('Contact identifier must be a secure hashed value (e.g. \'email:<md5>\' or \'phone:<md5>\')', 'contactIdentifier');
      }
      return this.request<DeleteSubscriberResponse>(
        `contacts/subscription-groups/${groupId}/subscriptions/${encodeURIComponent(contactIdentifier)}`,
        {
          method: 'DELETE',
        }
      );
    },
  };

  // -------------------------------------------------------------
  // Namespace: templates
  // -------------------------------------------------------------
  /**
   * Namespace container for managing template layouts.
   */
  public readonly templates = {
    /**
     * Lists all custom email templates saved under your account.
     * @returns An array of EmailTemplate objects.
     */
    list: async (): Promise<EmailTemplate[]> => {
      return this.request<EmailTemplate[]>('templates');
    },

    /**
     * Retrieves details for a specific email template.
     * @param templateId The unique template identifier.
     * @returns The EmailTemplate configuration.
     */
    get: async (templateId: string): Promise<EmailTemplate> => {
      return this.request<EmailTemplate>(`templates/${templateId}`);
    },

    /**
     * Saves a new email template layout.
     * @param template Template fields including layout structure and type definition.
     * @returns The created EmailTemplate object.
     */
    create: async (template: EmailTemplate): Promise<EmailTemplate> => {
      return this.request<EmailTemplate>('templates', {
        method: 'POST',
        body: template,
      });
    },

    /**
     * Modifies an existing email template layout.
     * @param templateId The unique template identifier.
     * @param template Updated template parameters.
     * @returns The updated EmailTemplate object.
     */
    update: async (templateId: string, template: EmailTemplate): Promise<EmailTemplate> => {
      return this.request<EmailTemplate>(`templates/${templateId}`, {
        method: 'PUT',
        body: template,
      });
    },

    /**
     * Deletes a template.
     * @param templateId The unique template identifier to delete.
     * @returns Success message confirmation.
     */
    delete: async (templateId: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>(`templates/${templateId}`, {
        method: 'DELETE',
      });
    },
  };

  // -------------------------------------------------------------
  // Namespace: webhooks
  // -------------------------------------------------------------
  /**
   * Namespace container for configuring notification webhooks to receive real-time email delivery events.
   */
  public readonly webhooks = {
    /**
     * Lists all webhooks.
     * @returns An array of Webhook configurations.
     */
    list: async (): Promise<Webhook[]> => {
      return this.request<Webhook[]>('webhooks');
    },

    /**
     * Gets a single webhook subscription.
     * @param webhookId The webhook identifier.
     * @returns The Webhook configuration.
     */
    get: async (webhookId: string): Promise<Webhook> => {
      return this.request<Webhook>(`webhooks/${webhookId}`);
    },

    /**
     * Creates a new webhook endpoint to subscribe to real-time events.
     * @param webhook Parameters including target URL and array of events to monitor (e.g. delivery, bounces).
     * @returns The registered Webhook configuration.
     */
    create: async (webhook: Webhook): Promise<Webhook> => {
      return this.request<Webhook>('webhooks', {
        method: 'POST',
        body: webhook,
      });
    },

    /**
     * Updates event scopes or URL endpoint for a webhook.
     * @param webhookId The webhook identifier.
     * @param webhook Updated parameters.
     * @returns The updated Webhook configuration.
     */
    update: async (webhookId: string, webhook: Webhook): Promise<Webhook> => {
      return this.request<Webhook>(`webhooks/${webhookId}`, {
        method: 'PUT',
        body: webhook,
      });
    },

    /**
     * Removes a webhook registration.
     * @param webhookId Unique webhook identifier to delete.
     * @returns Success message confirmation.
     */
    delete: async (webhookId: string): Promise<{ message: string }> => {
      return this.request<{ message: string }>(`webhooks/${webhookId}`, {
        method: 'DELETE',
      });
    },
  };

  /**
   * Lists available domain setup use-cases.
   * @returns An array of UseCase options.
   */
  public async getUseCases(): Promise<UseCase[]> {
    return this.request<UseCase[]>('use-cases');
  }

  /**
   * Checks the health and connection status of the Setup API.
   * @returns Status object containing the API status string.
   */
  public async getHealth(): Promise<{ status: string }> {
    return this.request<{ status: string }>('health');
  }
}
