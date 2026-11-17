package dev.remoteai.testing;

import com.android.uiautomator.core.Configurator;
import com.android.uiautomator.core.UiObject;
import com.android.uiautomator.core.UiSelector;
import com.android.uiautomator.testrunner.UiAutomatorTestCase;

/** Enter a complete draft through the native text control independently of the user's IME. */
public final class AgentDraftInput extends UiAutomatorTestCase {
    public void testEnter() throws Exception {
        Configurator.getInstance().setWaitForIdleTimeout(0);
        UiObject field = new UiObject(new UiSelector()
            .packageName("com.codexswitch.mobile.agentdraftstest")
            .className("android.widget.EditText"));
        assertTrue(field.waitForExists(5000));
        assertTrue(field.setText(getParams().getString("text")));
    }
}
