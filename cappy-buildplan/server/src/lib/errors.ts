/**
 * RFC 9457 Problem Details for HTTP APIs.
 * Every error response from Cappy uses this shape.
 *
 * Authorization failures and "not in your scope" both return 404
 * (NotFoundProblem) — never 403 — to avoid existence leaks.
 *
 * Never put PHI in `detail` or `title`. These appear in client logs
 * and crash reports.
 */

export type Problem = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
};

export class HttpProblem extends Error {
  public readonly problem: Problem;
  public readonly statusCode: number;

  constructor(problem: Problem) {
    super(problem.title);
    this.problem = problem;
    this.statusCode = problem.status;
  }
}

export const BadRequest = (detail?: string): HttpProblem =>
  new HttpProblem({
    type: 'about:blank',
    title: 'Bad Request',
    status: 400,
    ...(detail ? { detail } : {}),
  });

export const Unauthorized = (): HttpProblem =>
  new HttpProblem({
    type: 'about:blank',
    title: 'Unauthorized',
    status: 401,
  });

/**
 * NEVER use this for resource-existence checks — use NotFound instead.
 * Reserved for cases where the caller is authenticated and the resource
 * exists but the action itself is forbidden by policy (e.g., a readonly
 * caregiver attempting to log a dose).
 */
export const Forbidden = (): HttpProblem =>
  new HttpProblem({
    type: 'about:blank',
    title: 'Forbidden',
    status: 403,
  });

export const NotFound = (): HttpProblem =>
  new HttpProblem({
    type: 'about:blank',
    title: 'Not Found',
    status: 404,
  });

export const Conflict = (detail?: string): HttpProblem =>
  new HttpProblem({
    type: 'about:blank',
    title: 'Conflict',
    status: 409,
    ...(detail ? { detail } : {}),
  });

export const Gone = (detail?: string): HttpProblem =>
  new HttpProblem({
    type: 'about:blank',
    title: 'Gone',
    status: 410,
    ...(detail ? { detail } : {}),
  });

export const UnprocessableEntity = (detail?: string): HttpProblem =>
  new HttpProblem({
    type: 'about:blank',
    title: 'Unprocessable Entity',
    status: 422,
    ...(detail ? { detail } : {}),
  });

export const TooManyRequests = (): HttpProblem =>
  new HttpProblem({
    type: 'about:blank',
    title: 'Too Many Requests',
    status: 429,
  });
