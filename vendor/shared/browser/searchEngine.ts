export const searchEngines = [
  { id: 'google', label: 'market.browserSearchGoogle', url: 'https://www.google.com/search', parameter: 'q' },
  { id: 'baidu', label: 'market.browserSearchBaidu', url: 'https://www.baidu.com/s', parameter: 'wd' },
  { id: 'bing', label: 'market.browserSearchBing', url: 'https://www.bing.com/search', parameter: 'q' },
  { id: 'duckduckgo', label: 'market.browserSearchDuckDuckGo', url: 'https://duckduckgo.com/', parameter: 'q' },
] as const;
export type SearchEngine = typeof searchEngines[number]['id'];
export const DEFAULT_SEARCH_ENGINE: SearchEngine = 'google';
export const searchEngine = (value: unknown): SearchEngine =>
  searchEngines.find(engine => engine.id === value)?.id ?? DEFAULT_SEARCH_ENGINE;

export function searchUrl(query: string, engine: SearchEngine): URL {
  const selected = searchEngines.find(entry => entry.id === engine) ?? searchEngines[0];
  const url = new URL(selected.url);
  url.searchParams.set(selected.parameter, query);
  return url;
}
