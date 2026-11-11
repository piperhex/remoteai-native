package dev.remoteai.testing;

import com.android.uiautomator.core.Configurator;
import com.android.uiautomator.core.UiObject;
import com.android.uiautomator.core.UiSelector;
import com.android.uiautomator.testrunner.UiAutomatorTestCase;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.InputEvent;
import android.view.MotionEvent;
import java.io.File;
import java.lang.reflect.Method;

/** Capture animated native controls without waiting for an idle accessibility tree. */
public final class NativeCliHierarchy extends UiAutomatorTestCase {
    private static final int SWIPE_STEPS = 12;
    private static final int SWIPE_STEP_MS = 16;
    public void testSwipe() throws Exception {
        Configurator.getInstance().setWaitForIdleTimeout(0);
        boolean right = "right".equals(getParams().getString("direction"));
        int width = getUiDevice().getDisplayWidth();
        int height = getUiDevice().getDisplayHeight();
        int start = (int) (width * (right ? 0.25 : 0.8));
        int end = (int) (width * (right ? 0.8 : 0.25));
        int y = (int) (height * 0.42);
        // UiDevice.swipe waits for rendering after every event, stretching a swipe into a long press
        // on slow emulators. Shell-only asynchronous injection preserves a normal touch cadence.
        Class<?> managerClass = Class.forName("android.hardware.input.InputManagerGlobal");
        Object manager = managerClass.getMethod("getInstance").invoke(null);
        Method inject = managerClass.getMethod("injectInputEvent", InputEvent.class, int.class);
        long down = SystemClock.uptimeMillis();
        for (int step = 0; step <= SWIPE_STEPS; step++) {
            int action = step == 0 ? MotionEvent.ACTION_DOWN
                : step == SWIPE_STEPS ? MotionEvent.ACTION_UP : MotionEvent.ACTION_MOVE;
            float x = start + (end - start) * step / (float) SWIPE_STEPS;
            MotionEvent event = MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, x, y, 0);
            event.setSource(InputDevice.SOURCE_TOUCHSCREEN);
            try { assertTrue("Inject horizontal touch event", (Boolean) inject.invoke(manager, event, 0)); }
            finally { event.recycle(); }
            if (step < SWIPE_STEPS) SystemClock.sleep(SWIPE_STEP_MS);
        }
    }

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
