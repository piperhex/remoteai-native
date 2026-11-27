package com.reactnativecommunity.webview;

import android.net.Uri;
import android.net.http.SslCertificate;
import android.net.http.SslError;
import android.webkit.SslErrorHandler;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONException;

/** Only app-supplied mapping metadata may authorize the SHA-256 digest of a particular TLS leaf. */
final class MappingCertificate {
    static final int ERROR_CODE = -27841;
    private final Uri origin;
    private final String pin;

    private MappingCertificate(Uri origin, String pin) { this.origin = origin; this.pin = pin; }

    static MappingCertificate configure(RNCWebView view, String policy) {
        if (policy == null || policy.isEmpty()) return null;
        try {
            JSONArray parts = new JSONArray(policy);
            Uri origin = Uri.parse(parts.getString(0));
            if (!"https".equals(origin.getScheme()) || origin.getHost() == null || origin.getUserInfo() != null) return null;
            if (!WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE)) return null;
            String pin = parts.getString(1);
            if (!pin.isEmpty()) {
                String key = parts.getString(2);
                WebViewCompat.setProfile(view, "mapping-" + fingerprint(key.getBytes(StandardCharsets.UTF_8)) + "-" + pin);
            }
            return new MappingCertificate(origin, pin);
        } catch (JSONException | IllegalArgumentException | IllegalStateException invalid) { return null; }
    }

    private boolean matches(String address) {
        if (address == null) return false;
        Uri url = Uri.parse(address);
        return "https".equals(url.getScheme()) && url.getUserInfo() == null
            && origin.getHost().equalsIgnoreCase(url.getHost()) && port(origin) == port(url);
    }

    private static int port(Uri url) { return url.getPort() == -1 ? 443 : url.getPort(); }

    boolean handle(RNCWebView view, SslErrorHandler handler, SslError error, RNCWebViewClient client) {
        String top = view.getUrl();
        if (!matches(error.getUrl()) || !matches(top) || error.getCertificate() == null
                || error.hasError(SslError.SSL_INVALID)) return false;
        byte[] leaf = SslCertificate.saveState(error.getCertificate()).getByteArray("x509-certificate");
        if (leaf == null) return false;
        String fingerprint = fingerprint(leaf);
        if (pin.equals(fingerprint)) {
            handler.proceed();
            // Chromium caches by hostname without the port. Our per-mapping pin owns subsequent decisions.
            view.clearSslPreferences();
            view.post(view::clearSslPreferences);
            return true;
        }
        if (!error.getUrl().equals(top)) return false;
        handler.cancel();
        client.onReceivedError(view, ERROR_CODE, fingerprint, error.getUrl());
        return true;
    }

    private static String fingerprint(byte[] leaf) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(leaf);
            StringBuilder text = new StringBuilder(64);
            for (byte value : digest) text.append(String.format(Locale.ROOT, "%02X", value));
            return text.toString();
        } catch (NoSuchAlgorithmException missing) { throw new IllegalStateException(missing); }
    }
}
