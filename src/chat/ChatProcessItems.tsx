import { useState } from 'react';
import { groupConsecutiveActivities, latestActivity } from '../../vendor/shared/conversation/activityGroups';
import { NativeProcessDetails } from './ChatDeferredDetails';
import { ChatActivityRow, ChatMessage } from './ChatMessage';
import { ChatToolDetails } from './ChatToolDetails';
import { ChatWorkDrawer } from './ChatWorkDrawer';
import type { Item, Turn } from './types';

/** A completed turn may become a summary while its process is still expanded. */
export function ChatProcessItems({ item, turn }: { item: Item; turn: Turn }) {
  return <NativeProcessDetails items={[item]}>
    {items => <ProcessRows items={items} turn={turn} />}
  </NativeProcessDetails>;
}

function ProcessRows({ items, turn }: { items: Item[]; turn: Turn }) {
  const [selected, setSelected] = useState<string>();
  const groups = groupConsecutiveActivities(items);
  const group = groups.find(entry => entry.key === selected && entry.activity && entry.items.length > 1);
  const item = !group && items.find(entry => entry.id === selected);
  const close = () => setSelected(undefined);
  return <>
    {groups.map(entry => {
      const last = latestActivity(entry.items);
      return entry.activity && entry.items.length > 1 && last
        ? <ChatActivityRow key={entry.key} item={last} count={entry.items.length} onOpen={() => setSelected(entry.key)} />
        : <ChatMessage key={entry.key} item={entry.items[0]} process onOpen={setSelected} />;
    })}
    {group && <ChatWorkDrawer entry={{ turn, items: group.items }} onClose={close} />}
    {item && <ChatToolDetails item={item} onClose={close} />}
  </>;
}
