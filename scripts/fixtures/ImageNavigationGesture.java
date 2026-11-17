package dev.codexswitch.testing;

import com.android.uiautomator.core.Configurator;
import com.android.uiautomator.core.UiObject;
import com.android.uiautomator.core.UiSelector;
import com.android.uiautomator.testrunner.UiAutomatorTestCase;

/** Screenshots are captured with adb because UiDevice capture is unavailable on some Android versions. */
public final class ImageNavigationGesture extends UiAutomatorTestCase {
    public void testPinchKeepsPreviewOpen() throws Exception {
        Configurator.getInstance().setWaitForIdleTimeout(0);
        UiObject image = new UiObject(new UiSelector().description("图片"));
        assertTrue(image.pinchOut(70, 40));
        Thread.sleep(500);
        assertTrue(new UiObject(new UiSelector().description("下载图片到相册")).exists());
        assertTrue(new UiObject(new UiSelector().description("下一个")).exists());
    }
}
