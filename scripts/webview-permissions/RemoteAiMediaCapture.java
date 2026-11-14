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
import android.webkit.GeolocationPermissions;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Consumer;

/** Successful website consent lasts for this tab's current origin, independently of OS permission. */
public final class RemoteAiMediaCapture {
    private static final int MAX_DIALOG_WIDTH_DP = 400;
    private static final int DIALOG_MARGIN_DP = 24;
    private final RNCWebView view;
    private final Map<String, Set<String>> grants = new HashMap<>();
    private String pageOrigin;
    private Pending pending;
    private AlertDialog dialog;

    public RemoteAiMediaCapture(RNCWebView view) { this.view = view; }

    public void requestGeolocation(String origin, GeolocationPermissions.Callback callback,
            Consumer<GeolocationPermissions.Callback> authorize) {
        PermissionRequest location = new RemoteAiGeolocationRequest(origin, callback);
        request(location, approved -> authorize.accept((ignoredOrigin, allow, retain) -> {
            if (allow) approved.grant(location.getResources());
            else approved.deny();
        }));
    }

    public void cancelGeolocation() {
        if (pending != null && pending.original instanceof RemoteAiGeolocationRequest) cancel();
    }

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
        Set<String> allowed = grants.get(origin(request.getOrigin()));
        if (pageOrigin != null && allowed != null && allowed.containsAll(Arrays.asList(request.getResources()))) {
            // Recheck OS permissions even when website consent is retained.
            authorize.accept(current);
            return;
        }
        prompt(activity, current, message, authorize);
    }

    private void prompt(Activity activity, Pending current, String message, Consumer<PermissionRequest> authorize) {
        // These labels and actions belong to Android and follow its permission-dialog language.
        dialog = new AlertDialog.Builder(activity)
                .setTitle(current.getOrigin().toString())
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
            else if (RemoteAiGeolocationRequest.RESOURCE.equals(resource)) permission = resource;
            else return null;
            try {
                String label = permissionLabel(manager, permission);
                if (!labels.contains(label)) labels.add(label);
            } catch (PackageManager.NameNotFoundException error) { return null; }
        }
        return labels.isEmpty() ? null : android.text.TextUtils.join("\n\n", labels);
    }

    private String permissionLabel(PackageManager manager, String permission)
            throws PackageManager.NameNotFoundException {
        if (RemoteAiGeolocationRequest.RESOURCE.equals(permission)) {
            // The OS lets the user choose precision; the website prompt must not imply a fixed accuracy.
            return manager.getPermissionGroupInfo(Manifest.permission_group.LOCATION, 0).loadLabel(manager).toString();
        }
        return manager.getPermissionInfo(permission, 0).loadLabel(manager).toString();
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

    public void navigate(String url) {
        cancel();
        String nextOrigin = origin(Uri.parse(url));
        if (!Objects.equals(pageOrigin, nextOrigin)) grants.clear();
        pageOrigin = nextOrigin;
    }

    public void close() {
        cancel();
        grants.clear();
        pageOrigin = null;
    }

    private static String origin(Uri uri) {
        String scheme = uri.getScheme();
        String host = uri.getHost();
        if (scheme == null || host == null) return null;
        scheme = scheme.toLowerCase(Locale.ROOT);
        if (!scheme.equals("https") && !scheme.equals("http")) return null;
        int port = uri.getPort();
        if (port == -1) port = scheme.equals("https") ? 443 : 80;
        return scheme + "://" + host.toLowerCase(Locale.ROOT) + ":" + port;
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
            String requestOrigin = origin(getOrigin());
            if (pageOrigin != null && requestOrigin != null) {
                grants.computeIfAbsent(requestOrigin, key -> new HashSet<>()).addAll(Arrays.asList(resources));
            }
        }
        @Override public void deny() {
            if (pending != this) return;
            pending = null;
            dismiss();
            original.deny();
        }
    }
}
