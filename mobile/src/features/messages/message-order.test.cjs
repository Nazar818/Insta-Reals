const assert = require('node:assert/strict');
const test = require('node:test');
const { mergeMessages } = require('./message-order');

function message(id, second, text = id) {
  return { id, senderId: 'person', text, createdAt: `2026-10-01T12:00:${String(second).padStart(2, '0')}.000Z` };
}

test('polling retains loaded history and replaces overlapping messages without duplicates', () => {
  const older = [message('middle', 20, 'old response'), message('oldest', 10)];
  const incoming = [message('newest', 30), message('middle', 20, 'fresh response')];
  const merged = mergeMessages(incoming, older);
  assert.deepEqual(merged.map((entry) => entry.id), ['newest', 'middle', 'oldest']);
  assert.equal(merged[1].text, 'fresh response');
  assert.equal(older[0].text, 'old response');
});

test('older pagination cannot move a message ahead of a newer sent message', () => {
  const current = [message('new', 45), message('same-b', 20)];
  const paginated = [message('same-a', 20), message('old', 5), message('same-b', 20)];
  assert.deepEqual(mergeMessages(paginated, current).map((entry) => entry.id), ['new', 'same-b', 'same-a', 'old']);
});
