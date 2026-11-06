import { avatarData, type LoungeAvatarStore } from './avatar';
import type { LoungeAccount, LoungeMessage, LoungeSnapshot } from './types';
import { LoungeNames } from './names';
import { accountLabel } from './accountLabel';
import { LoungeAvatarCache } from './avatarCache';
import { parseClients, parseClientVersions } from './clientVersion';

const MAX_PROFILES = 200;

function mapChanged<T>(values: T[], transform: (value: T) => T): T[] {
  const updated = values.map(transform);
  return updated.some((value, index) => value !== values[index]) ? updated : values;
}

/** Server profiles override message snapshots and local caches, including explicit resets. */
export class LoungeProfiles {
  readonly names = new LoungeNames();
  available = false;
  private readonly avatars: LoungeAvatarCache;
  private cached = false;
  private watched = '';
  private versions = new Map<string, Pick<LoungeAccount, 'clientVersions' | 'clients'>>();

  constructor(store?: LoungeAvatarStore) { this.avatars = new LoungeAvatarCache(store); }

  clear() { this.avatars.clear(); this.names.clear(); this.versions.clear(); this.disconnect(); }
  disconnect() { this.watched = ''; this.available = false; this.names.available = false; }
  ready(user: LoungeAccount, available: boolean, namesAvailable = false, avatarCache = false) {
    this.names.ready(user, namesAvailable);
    this.available = available;
    this.cached = available && avatarCache;
    this.watched = '';
    if (available && !this.cached) this.avatars.set(user.id, avatarData(user.avatar) ? user.avatar : '');
  }
  receive(input: unknown) {
    if (!this.available || !Array.isArray(input) || input.length > MAX_PROFILES) return false;
    for (const profile of input) {
      if (typeof profile?.id === 'string' && profile.id.length > 0 && profile.id.length <= 80
        && (profile.avatar === '' || avatarData(profile.avatar))) this.avatars.set(profile.id, profile.avatar);
    }
    return true;
  }
  user(user: LoungeAccount): LoungeAccount {
    user = this.names.user(user);
    const metadata = this.versions.get(user.id);
    if (metadata && (metadata.clientVersions !== user.clientVersions || metadata.clients !== user.clients)) {
      user = { ...user, ...metadata };
    }
    const account = accountLabel(user.account);
    if (account !== user.account) user = { ...user, account };
    const cached = this.avatars.get(user.id);
    if (!cached) return user;
    const avatar = cached.avatar || undefined;
    return avatar === user.avatar ? user : { ...user, avatar };
  }
  message = (message: LoungeMessage): LoungeMessage => {
    const sender = this.user(message.sender);
    const recipient = message.recipient ? this.user(message.recipient) : undefined;
    let reply = message.reply;
    if (reply && accountLabel(reply.account) !== reply.account) {
      reply = { ...reply, account: accountLabel(reply.account) };
    }
    return sender === message.sender && recipient === message.recipient && reply === message.reply
      ? message : { ...message, sender, recipient, reply };
  };
  decorate(state: LoungeSnapshot): LoungeSnapshot {
    // Preserve unchanged lists: presence and acknowledgements must not reset the chat viewport.
    return { ...state, user: state.user ? this.user(state.user) : undefined,
      messages: mapChanged(state.messages, this.message),
      contacts: mapChanged(state.contacts, contact => {
        const user = this.user(contact.user);
        return user === contact.user ? contact : { ...contact, user };
      }) };
  }
  watch(socket: WebSocket, state: LoungeSnapshot) {
    if (!this.available) return;
    const ids = [...new Set([this.cached ? state.user?.id ?? '' : '', state.conversation,
      ...state.contacts.map(contact => contact.user.id).reverse()])]
      .filter(id => id && (this.cached || id !== state.user?.id)).slice(0, MAX_PROFILES);
    const serialized = JSON.stringify(ids);
    if (serialized === this.watched || !ids.length && !this.watched) return;
    this.avatars.retain([...ids, state.user?.id ?? '']);
    for (const id of this.versions.keys()) if (!ids.includes(id) && id !== state.user?.id) this.versions.delete(id);
    socket.send(JSON.stringify({ type: 'profile-watch', watch: ids,
      clientVersions: true,
      ...(this.cached ? { avatarVersions: this.avatars.versions(ids) } : {}) }));
    this.watched = serialized;
  }
  receiveVersions(input: unknown) {
    if (!this.available || !Array.isArray(input) || input.length > MAX_PROFILES) return false;
    for (const value of input) {
      const versions = parseClientVersions(value?.clientVersions);
      const clients = parseClients(value?.clients);
      if (typeof value?.id === 'string' && value.id.length > 0 && value.id.length <= 80 && versions) {
        if (this.versions.has(value.id) || this.versions.size < MAX_PROFILES) {
          this.versions.set(value.id, { clientVersions: versions, clients });
        }
      }
    }
    return true;
  }
}
