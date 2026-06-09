/**
 * Base error class for all SimplySend SDK errors.
 */
export class SimplySendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimplySendError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when local validation of API parameters fails.
 */
export class SimplySendValidationError extends SimplySendError {
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'SimplySendValidationError';
    this.field = field;
  }
}

/**
 * Error structure returned by SimplySend API.
 */
export interface SimplySendApiErrorResponse {
  error: string | {
    code?: string;
    message?: string;
    details?: Array<{ field: string; message: string }>;
  };
  message?: string;
  reasonCode?: string;
  subscriptionStatus?: string;
}

/**
 * Error thrown when an API request returns a non-2xx status code.
 */
export class SimplySendHttpError extends SimplySendError {
  public readonly statusCode: number;
  public readonly body: SimplySendApiErrorResponse;
  public readonly reasonCode?: string;

  constructor(statusCode: number, body: SimplySendApiErrorResponse) {
    let message = 'API request failed';
    if (typeof body.error === 'string') {
      message = body.error;
    } else if (body.error?.message) {
      message = body.error.message;
    } else if (body.message) {
      message = body.message;
    }

    super(message);
    this.name = 'SimplySendHttpError';
    this.statusCode = statusCode;
    this.body = body;
    this.reasonCode = body.reasonCode;
  }
}
