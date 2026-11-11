package dev.remoteai.testing;

import com.android.uiautomator.core.Configurator;
import com.android.uiautomator.core.UiObject;
import com.android.uiautomator.core.UiSelector;
import com.android.uiautomator.testrunner.UiAutomatorTestCase;
import java.io.File;

/** Capture animated native controls without waiting for an idle accessibility tree. */
public final class NativeCliHierarchy extends UiAutomatorTestCase {
    public void testEnterMessage() throws Exception {
        Configurator.getInstance().setWaitForIdleTimeout(0);
        UiObject field = new UiObject(new UiSelector()
            .packageName("com.codexswitch.mobile.cliguitest")
            .className("android.widget.EditText").description("消息"));
        assertTrue("The message field is available", field.waitForExists(5000));
        assertTrue("The message is entered through the native control", field.setText("Check project"));
    }

    public void testDump() throws Exception {
        Configurator.getInstance().setWaitForIdleTimeout(0);
        // UiAutomator's legacy dump command resolves this relative to its shell working directory.
        File output = new File("/data/local/tmp/local/tmp/native-cli.xml");
        assertTrue(!output.exists() || output.delete());
        for (int attempt = 0; attempt < 20 && !output.isFile(); attempt++) {
            getUiDevice().dumpWindowHierarchy("native-cli.xml");
            if (!output.isFile()) Thread.sleep(100);
        }
        assertTrue("A fresh hierarchy is required", output.isFile() && output.length() > 0);
    }
}
