export function messageMenuActions({ direct, block, blocked, profile }: {
  direct?: () => void; block?: () => void; blocked?: boolean; profile?: () => void;
}) {
  return [
    { key: 'copy', label: 'client.lounge.copyMessage' },
    { key: 'reply', label: 'client.lounge.quoteReply' },
    ...(profile ? [{ key: 'profile', label: 'client.lounge.profile' } as const] : []),
    ...(direct ? [{ key: 'direct', label: 'client.lounge.directChat' } as const] : []),
    ...(block ? [{ key: 'block', label: blocked ? 'client.lounge.unblockUser' : 'client.lounge.blockUser' } as const] : []),
  ] as const;
}
