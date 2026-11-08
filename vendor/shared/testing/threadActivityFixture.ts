import type { Thread } from '../conversation/types';

export const activityThreads: Thread[] = [
  { id: 'old', name: '较早的对话 · 正在进行', updatedAt: 100 },
  { id: 'latest', name: '最后活跃 10:30', updatedAt: 700 },
  { id: 'third', name: '最后活跃 10:10', updatedAt: 300 },
  { id: 'second', name: '最后活跃 10:20', updatedAt: 500 },
  { id: 'resumed', name: '较早创建 · 最后活跃 10:25', updatedAt: 600 },
  { id: 'older', name: '最后活跃 10:00', updatedAt: 200 },
  { id: 'middle', name: '最后活跃 10:15', updatedAt: 400 },
].map(thread => ({ ...thread, cwd: 'F:/projects/remoteai', preview: '',
  status: { type: thread.id === 'old' ? 'active' : 'idle' } }));

export function completedActivityThreads(): Thread[] {
  return activityThreads.map(thread => ({ ...thread, status: { type: 'idle' },
    ...(thread.id === 'old' ? { name: '刚刚完成的对话', updatedAt: 800 } : {}) }));
}
