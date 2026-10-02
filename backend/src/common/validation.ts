import { BadRequestException } from '@nestjs/common';

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('A JSON object is required');
  }
  return value as Record<string, unknown>;
}

export function text(
  value: unknown,
  field: string,
  max: number,
  min = 1,
): string {
  if (
    typeof value !== 'string' ||
    value.trim().length < min ||
    value.trim().length > max
  ) {
    throw new BadRequestException(
      `${field} must contain ${min}–${max} characters`,
    );
  }
  return value.trim();
}

export function cursorPage<T extends { id: string }>(
  items: T[],
  cursor: string | undefined,
  limit: number,
) {
  const start = cursor ? items.findIndex((item) => item.id === cursor) + 1 : 0;
  if (cursor && start === 0) throw new BadRequestException('Invalid cursor');
  const page = items.slice(start, start + limit);
  return {
    items: page,
    nextCursor: start + limit < items.length ? (page.at(-1)?.id ?? null) : null,
  };
}

export function uniqueError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'P2002',
  );
}

export function rowsPage<T extends { id: string }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit);
  return {
    items,
    nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null,
  };
}
