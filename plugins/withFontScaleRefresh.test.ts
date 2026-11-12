import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { addFontScaleRefresh, handleFontScaleChanges } = require('./withFontScaleRefresh.cjs') as {
  addFontScaleRefresh: (source: string) => string;
  handleFontScaleChanges: (attributes: Record<string, string>) => void;
};
const application = `class MainApplication : Application(), ReactApplication {
  override fun onCreate() {
    super.onCreate()
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }
  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}`;

describe('Android font-scale refresh', () => {
  it('keeps the activity stable during runtime reload without losing existing configuration handling', () => {
    const attributes = { 'android:configChanges': 'keyboard|orientation|uiMode' };
    handleFontScaleChanges(attributes);
    handleFontScaleChanges(attributes);
    expect(attributes['android:configChanges']).toBe('keyboard|orientation|uiMode|fontScale');
    const empty: Record<string, string> = {};
    handleFontScaleChanges(empty);
    expect(empty['android:configChanges']).toBe('fontScale');
  });

  it('refreshes an existing runtime only when font scale changes, preserving Expo lifecycle dispatch', () => {
    const result = addFontScaleRefresh(application);
    expect(result).toContain('previousFontScale = resources.configuration.fontScale');
    expect(result).toContain('val fontScaleChanged = previousFontScale != newConfig.fontScale');
    expect(result).toContain('fontScaleChanged && reactHost.currentReactContext != null');
    expect(result).toContain('ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)');
    expect(result).toContain('reactHost.reload("System font size changed")');
    expect(addFontScaleRefresh(result)).toBe(result);
  });

  it('preserves Windows line endings and rejects an incompatible template', () => {
    const result = addFontScaleRefresh(application.replace(/\n/g, '\r\n'));
    expect(result.replace(/\r\n/g, '')).not.toContain('\n');
    expect(() => addFontScaleRefresh(application.replace('super.onCreate()', 'other()'))).toThrow();
    expect(() => addFontScaleRefresh(application + application)).toThrow();
  });
});
