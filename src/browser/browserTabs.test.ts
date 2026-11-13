import { describe, expect, it } from 'vitest';
import { closeBrowserTab, newBrowserTab, restoreBrowserTabs, serializeBrowserTabs } from './browserTabs';

describe('retained native browser tabs', () => {
  it('restores URLs and selection without serializing page previews or pending navigation', () => {
    const first = newBrowserTab('https://example.org/one');
    const second = { ...newBrowserTab('https://example.org/two'), title: 'Second',
      desktop: true, preview: 'private-image', request: { url: 'https://pending.example' } };
    const saved = serializeBrowserTabs({ tabs: [first, second], activeId: second.id });
    expect(saved).not.toContain('private-image'); expect(saved).not.toContain('pending');
    const restored = restoreBrowserTabs(saved, '');
    expect(restored.tabs.map(tab => tab.url)).toEqual([first.url, second.url]);
    expect(restored.activeId).toBe(restored.tabs[1].id);
    expect(restored.tabs[1].title).toBe('Second');
    expect(restored.tabs[1].desktop).toBe(true);
  });
  it('selects the adjacent tab when closing the active tab and preserves other live instances', () => {
    const tabs = [newBrowserTab('https://one.test'), newBrowserTab('https://two.test'), newBrowserTab()];
    const next = closeBrowserTab({ tabs, activeId: tabs[1].id }, tabs[1].id);
    expect(next.activeId).toBe(tabs[2].id);
    expect(next.tabs[0]).toBe(tabs[0]); expect(next.tabs[1]).toBe(tabs[2]);
    expect(closeBrowserTab(next, tabs[0].id).activeId).toBe(tabs[2].id);
  });
  it('keeps a blank tab after the last tab is closed and safely migrates malformed state', () => {
    const tab = newBrowserTab();
    const next = closeBrowserTab({ tabs: [tab], activeId: tab.id }, tab.id);
    expect(next.tabs).toHaveLength(1); expect(next.tabs[0].url).toBe('');
    expect(next.activeId).not.toBe(tab.id);
    for (const raw of [null, 'invalid', '{"tabs":[{"url":"javascript:alert(1)"}]}']) {
      expect(restoreBrowserTabs(raw, 'https://fallback.test').tabs[0].url).toBe('https://fallback.test');
    }
  });
});
