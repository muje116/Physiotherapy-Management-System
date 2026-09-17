import { describe, it, expect } from 'vitest';
import { AppError, NotFoundError, ForbiddenError, UnauthorizedError, ValidationError, ConflictError } from '../utils/errors';

describe('AppError', () => {
  it('should create an error with statusCode, code, and message', () => {
    const error = new AppError(418, 'TEAPOT', "I'm a teapot");

    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(418);
    expect(error.code).toBe('TEAPOT');
    expect(error.message).toBe("I'm a teapot");
    expect(error.name).toBe('AppError');
  });

  it('should capture stack trace', () => {
    const error = new AppError(500, 'INTERNAL', 'Test');
    expect(error.stack).toBeDefined();
  });
});

describe('NotFoundError', () => {
  it('should have status 404 and default message', () => {
    const error = new NotFoundError();

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Resource not found');
    expect(error.name).toBe('NotFoundError');
  });

  it('should accept custom message', () => {
    const error = new NotFoundError('Patient not found');
    expect(error.message).toBe('Patient not found');
  });
});

describe('ForbiddenError', () => {
  it('should have status 403 and default message', () => {
    const error = new ForbiddenError();

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toBe('Forbidden');
    expect(error.name).toBe('ForbiddenError');
  });

  it('should accept custom message', () => {
    const error = new ForbiddenError('Access denied');
    expect(error.message).toBe('Access denied');
  });
});

describe('UnauthorizedError', () => {
  it('should have status 401 and default message', () => {
    const error = new UnauthorizedError();

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toBe('Unauthorized');
    expect(error.name).toBe('UnauthorizedError');
  });

  it('should accept custom message', () => {
    const error = new UnauthorizedError('Invalid credentials');
    expect(error.message).toBe('Invalid credentials');
  });
});

describe('ValidationError', () => {
  it('should have status 400 and default message', () => {
    const error = new ValidationError();

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Validation failed');
    expect(error.name).toBe('ValidationError');
  });

  it('should accept custom message', () => {
    const error = new ValidationError('Name is required');
    expect(error.message).toBe('Name is required');
  });

  it('should include details array when provided', () => {
    const details = [{ field: 'email', message: 'Invalid format' }];
    const error = new ValidationError('Validation failed', details);

    expect(error.details).toEqual(details);
    expect(error.details).toHaveLength(1);
  });

  it('should have undefined details when not provided', () => {
    const error = new ValidationError();
    expect(error.details).toBeUndefined();
  });
});

describe('ConflictError', () => {
  it('should have status 409 and default message', () => {
    const error = new ConflictError();

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
    expect(error.message).toBe('Resource already exists');
    expect(error.name).toBe('ConflictError');
  });

  it('should accept custom message', () => {
    const error = new ConflictError('Email already registered');
    expect(error.message).toBe('Email already registered');
  });
});

describe('Error inheritance chain', () => {
  it('should have all custom errors inherit from AppError', () => {
    expect(NotFoundError.prototype).toBeInstanceOf(AppError);
    expect(ForbiddenError.prototype).toBeInstanceOf(AppError);
    expect(UnauthorizedError.prototype).toBeInstanceOf(AppError);
    expect(ValidationError.prototype).toBeInstanceOf(AppError);
    expect(ConflictError.prototype).toBeInstanceOf(AppError);
  });

  it('should allow instanceof checks', () => {
    expect(new NotFoundError()).toBeInstanceOf(AppError);
    expect(new NotFoundError()).toBeInstanceOf(Error);
    expect(new ForbiddenError()).toBeInstanceOf(AppError);
    expect(new UnauthorizedError()).toBeInstanceOf(AppError);
    expect(new ValidationError()).toBeInstanceOf(AppError);
    expect(new ConflictError()).toBeInstanceOf(AppError);
  });
});
