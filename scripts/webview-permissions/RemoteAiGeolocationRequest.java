package com.reactnativecommunity.webview;

import android.Manifest;
import android.net.Uri;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import java.util.Arrays;

/** Adapt location to the same per-tab consent and cancellation lifecycle as media capture. */
final class RemoteAiGeolocationRequest extends PermissionRequest {
    static final String RESOURCE = Manifest.permission.ACCESS_COARSE_LOCATION;
    private final String origin;
    private final GeolocationPermissions.Callback callback;

    RemoteAiGeolocationRequest(String origin, GeolocationPermissions.Callback callback) {
        this.origin = origin;
        this.callback = callback;
    }

    @Override public Uri getOrigin() { return Uri.parse(origin); }
    @Override public String[] getResources() { return new String[] { RESOURCE }; }
    @Override public void grant(String[] resources) {
        callback.invoke(origin, Arrays.asList(resources).contains(RESOURCE), false);
    }
    @Override public void deny() { callback.invoke(origin, false, false); }
}
