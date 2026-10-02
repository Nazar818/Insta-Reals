import type { Message } from '../../types';

// The API sends newest first. Keep that order for an inverted chat list and
// replace duplicate entries with the latest version returned by the server.
export function mergeMessages(newer: Message[], existing: Message[]): Message[] {
  const byId = new Map(existing.map((message) => [message.id, message]));
  newer.forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort((a, b) => {
    const time = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return time || b.id.localeCompare(a.id);
  });
}
