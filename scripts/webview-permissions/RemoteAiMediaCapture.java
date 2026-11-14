package com.reactnativecommunity.webview;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/** Per-WebView consent. OS permission alone must never authorize a new website request. */
public final class RemoteAiMediaCapture {
    private static final int MAX_DIALOG_WIDTH_DP = 400;
    private static final int DIALOG_MARGIN_DP = 24;
    private final RNCWebView view;
    private Pending pending;
    private AlertDialog dialog;

    public RemoteAiMediaCapture(RNCWebView view) { this.view = view; }

    public void request(PermissionRequest request, Consumer<PermissionRequest> authorize) {
        Activity activity = view.getThemedReactContext().getCurrentActivity();
        if (pending != null || activity == null || activity.isFinishing()
                || !view.isShown() || !view.hasWindowFocus()) {
            request.deny();
            return;
        }
        String message = permissionLabels(activity.getPackageManager(), request.getResources());
        if (message == null) { request.deny(); return; }
        Pending current = new Pending(request);
        pending = current;
        // These labels and actions belong to Android and follow its permission-dialog language.
        dialog = new AlertDialog.Builder(activity)
                .setTitle(request.getOrigin().toString())
                .setMessage(message)
                .setNegativeButton(android.R.string.cancel, (button, which) -> current.deny())
                .setPositiveButton(android.R.string.ok, (button, which) -> {
                    if (pending == current) authorize.accept(current);
                })
                .setOnCancelListener(button -> current.deny())
                .create();
        dialog.setCanceledOnTouchOutside(false);
        try {
            dialog.show();
            constrainWidth(dialog.getWindow());
        } catch (WindowManager.BadTokenException error) { current.deny(); }
    }

    private String permissionLabels(PackageManager manager, String[] resources) {
        List<String> labels = new ArrayList<>();
        for (String resource : resources) {
            String permission;
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                permission = Manifest.permission.RECORD_AUDIO;
            }
            else if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) permission = Manifest.permission.CAMERA;
            else return null;
            try {
                String label = manager.getPermissionInfo(permission, 0).loadLabel(manager).toString();
                if (!labels.contains(label)) labels.add(label);
            } catch (PackageManager.NameNotFoundException error) { return null; }
        }
        return labels.isEmpty() ? null : android.text.TextUtils.join("\n\n", labels);
    }

    private void constrainWidth(Window window) {
        if (window == null) return;
        float density = view.getResources().getDisplayMetrics().density;
        int available = view.getResources().getDisplayMetrics().widthPixels - (int) (DIALOG_MARGIN_DP * density);
        window.setLayout(Math.min(available, (int) (MAX_DIALOG_WIDTH_DP * density)),
                ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    public void cancel() {
        if (pending != null) pending.deny();
        dismiss();
    }

    public void canceledByPage(PermissionRequest request) {
        // Chromium has already canceled this request; do not invoke it again.
        if (pending == null || pending.original != request) return;
        pending = null;
        dismiss();
    }

    private void dismiss() {
        if (dialog == null) return;
        dialog.dismiss();
        dialog = null;
    }

    private final class Pending extends PermissionRequest {
        private final PermissionRequest original;
        Pending(PermissionRequest original) { this.original = original; }
        @Override public Uri getOrigin() { return original.getOrigin(); }
        @Override public String[] getResources() { return original.getResources(); }
        @Override public void grant(String[] resources) {
            if (pending != this) return;
            pending = null;
            dismiss();
            original.grant(resources);
        }
        @Override public void deny() {
            if (pending != this) return;
            pending = null;
            dismiss();
            original.deny();
        }
    }
}
