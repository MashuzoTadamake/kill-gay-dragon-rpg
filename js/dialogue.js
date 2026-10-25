import { STORY, SPEAKERS, message } from './story.js';

export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const currentConversation = state => state.history.filter(m => m.conversation === state.dialogue?.conversation);
export function renderMessages(messages) {
  return messages.map((m, i) => `<article class="message message--${m.role}" data-speaker="${escapeHtml(m.speakerId)}" data-message="${i}"><div class="message-name">${escapeHtml(m.speaker)}</div><div class="message-text">${escapeHtml(m.text).replaceAll('\n', '<br>')}</div></article>`).join('');
}
export function historyConversations(state) {
  const groups = [];
  for (const entry of state.history) {
    let group = groups.at(-1);
    if (!group || group.id !== entry.conversation) {
      group = { id: entry.conversation, title: STORY[entry.scene]?.title ?? 'Earlier pages', messages: [] };
      groups.push(group);
    }
    group.messages.push(entry);
  }
  return groups;
}
// V1 stored entire nodes. Match exact legacy signatures to authored metadata;
// this never guesses a speaker from quotes, pronouns, or names in prose.
export function legacySignature(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return hash.toString(16);
}
export function restoreLegacyDialogue(state) {
  const entries = state.history;
  const history = [];
  let conversation = 0, group = null;
  entries.forEach((entry, index) => {
    const scene = Object.keys(STORY).find(id => STORY[id].speaker === entry.speaker && STORY[id].legacyHash === legacySignature(entry.text));
    const n = STORY[scene];
    if (!n) {
      history.push({ ...message('n', entry.text), conversation: ++conversation }); group = null; return;
    }
    if (n.conversation !== group || index && entries[index - 1].speaker === entry.speaker && entries[index - 1].text === entry.text) conversation++;
    group = n.conversation;
    n.messages.forEach((m, messageIndex) => history.push({ ...m, scene, messageIndex, conversation }));
    const nextEntry = entries[index + 1];
    const selected = n.choices?.find(c => nextEntry && STORY[c.next]?.legacyHash === legacySignature(nextEntry.text));
    if (selected) history.push({ ...message(selected.speakerId, selected.label), scene, conversation, choice: true });
  });
  state.history = history;
  const current = state.view === 'story' ? STORY[state.scene] : null;
  state.dialogue = { conversation: Math.max(1, conversation), group: current?.conversation ?? group, cursor: current?.messages.length ?? 0 };
  if (state.view === 'smith') state.flags.metSmith = true;
  if (state.view === 'merchant') state.flags.metMerchant = true;
}
export function validMessage(m) {
  const speaker = SPEAKERS[m?.speakerId];
  return !!speaker && m.role === speaker.role && m.speaker === speaker.name && typeof m.text === 'string' && Number.isSafeInteger(m.conversation) && m.conversation > 0 && (!m.scene || !!STORY[m.scene]);
}
// Edits keep each scene's message slots stable, so older saves retain the same
// cursor. Refresh only already-read authored messages; never reveal new ones.
export function refreshStoryMessages(state) {
  state.history = state.history.map(entry => {
    const canonical = !entry.choice && Number.isSafeInteger(entry.messageIndex) && STORY[entry.scene]?.messages[entry.messageIndex];
    return canonical ? { ...entry, ...canonical } : entry;
  });
}
