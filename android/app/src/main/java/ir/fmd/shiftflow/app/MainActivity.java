package ir.fmd.shiftflow.app;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.PowerManager;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * ShiftFlow FMD 1405 - Standalone Offline-First Native Android Application (v3.0.0)
 * With OS System Notifications (Android 8-15) & Active Background Sync
 */
public class MainActivity extends Activity {

    static final int FILE_CHOOSER_RESULT_CODE = 1001;
    static final int NOTIF_PERM_REQUEST_CODE = 1002;
    static final int BG_STATUS_NOTIFICATION_ID = 9001;
    static final String LOCAL_ORIGIN = "https://localhost";

    WebView webView;
    ValueCallback<Uri[]> filePathCallback;
    PowerManager.WakeLock bgWakeLock;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        Window window = getWindow();
        if (window != null) {
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(Color.parseColor("#065f46"));
            window.setNavigationBarColor(Color.parseColor("#0f172a"));
        }

        FrameLayout rootLayout = new FrameLayout(this);
        rootLayout.setBackgroundColor(Color.parseColor("#f8fafc"));

        webView = new WebView(this);
        rootLayout.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        setContentView(rootLayout);

        ensureNotificationPermission();
        configureWebView();
        webView.loadUrl(LOCAL_ORIGIN + "/index.html");
    }

    void ensureNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33) {
            try {
                if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, NOTIF_PERM_REQUEST_CODE);
                }
            } catch (Exception ignored) {
            }
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Keep WebView JS timers active in the background so shift change notifications arrive immediately
        if (webView != null) {
            webView.resumeTimers();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.resumeTimers();
        }
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setTextZoom(100);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.addJavascriptInterface(new AndroidBridge(this), "AndroidBridge");
        webView.setWebViewClient(new AssetWebViewClient(this));
        webView.setWebChromeClient(new AppWebChromeClient(this));
        webView.setDownloadListener(new AppDownloadListener(this));
    }

    static class AssetWebViewClient extends WebViewClient {
        final MainActivity activity;

        AssetWebViewClient(MainActivity activity) {
            this.activity = activity;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (uri == null) return null;

            String host = uri.getHost();
            String scheme = uri.getScheme();
            if (host != null && host.equalsIgnoreCase("localhost")
                    && ("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme))) {
                String path = uri.getPath();
                if (path == null || path.isEmpty() || "/".equals(path)) {
                    path = "/index.html";
                }
                return activity.loadAssetResource(path);
            }
            return super.shouldInterceptRequest(view, request);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (uri == null) return false;
            String host = uri.getHost();
            if (host != null && host.equalsIgnoreCase("localhost")) {
                return false;
            }
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                activity.startActivity(intent);
                return true;
            } catch (Exception e) {
                return false;
            }
        }
    }

    static class AppWebChromeClient extends WebChromeClient {
        final MainActivity activity;

        AppWebChromeClient(MainActivity activity) {
            this.activity = activity;
        }

        @Override
        public boolean onShowFileChooser(
                WebView view,
                ValueCallback<Uri[]> callback,
                FileChooserParams fileChooserParams
        ) {
            if (activity.filePathCallback != null) {
                activity.filePathCallback.onReceiveValue(null);
            }
            activity.filePathCallback = callback;

            Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("*/*");
            String[] mimeTypes = new String[]{
                    "application/pdf",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "application/vnd.ms-excel",
                    "application/json",
                    "text/csv"
            };
            intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes);

            try {
                activity.startActivityForResult(Intent.createChooser(intent, "انتخاب فایل اکسل یا PDF برنامه شیفت"), FILE_CHOOSER_RESULT_CODE);
            } catch (Exception e) {
                activity.filePathCallback = null;
                Toast.makeText(activity, "خطا در باز کردن انتخاب‌گر فایل", Toast.LENGTH_SHORT).show();
                return false;
            }
            return true;
        }
    }

    static class AppDownloadListener implements DownloadListener {
        final MainActivity activity;

        AppDownloadListener(MainActivity activity) {
            this.activity = activity;
        }

        @Override
        public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
            if (url != null && url.startsWith("data:")) {
                try {
                    String[] parts = url.split(",");
                    if (parts.length > 1) {
                        new AndroidBridge(activity).saveBase64File(parts[1], "ShiftFlow-Export.xlsx", mimetype);
                    }
                } catch (Exception ignored) {
                }
            }
        }
    }

    WebResourceResponse loadAssetResource(String rawPath) {
        String cleanPath = rawPath.startsWith("/") ? rawPath.substring(1) : rawPath;
        if (cleanPath.isEmpty()) {
            cleanPath = "index.html";
        }
        String assetPath = "public/" + cleanPath;
        try {
            InputStream stream = getAssets().open(assetPath);
            String mimeType = guessMimeType(cleanPath);
            return buildCorsResponse(mimeType, stream);
        } catch (IOException e) {
            if (!cleanPath.contains(".")) {
                try {
                    InputStream fallback = getAssets().open("public/index.html");
                    return buildCorsResponse("text/html", fallback);
                } catch (IOException ignored) {
                }
            }
            return null;
        }
    }

    WebResourceResponse buildCorsResponse(String mimeType, InputStream stream) {
        WebResourceResponse response = new WebResourceResponse(mimeType, "UTF-8", stream);
        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        headers.put("Access-Control-Allow-Headers", "*");
        headers.put("Cache-Control", "no-cache");
        response.setResponseHeaders(headers);
        return response;
    }

    String guessMimeType(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".json") || lower.endsWith(".webmanifest")) return "application/json";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".ico")) return "image/x-icon";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".ttf")) return "font/ttf";
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        if (lower.endsWith(".wasm")) return "application/wasm";
        return "application/octet-stream";
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_RESULT_CODE) {
            if (filePathCallback == null) return;
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                String dataString = data.getDataString();
                if (dataString != null) {
                    results = new Uri[]{Uri.parse(dataString)};
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    public static class AndroidBridge {
        final MainActivity activity;

        public AndroidBridge(MainActivity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public String getAppVersion() {
            return "3.0.0";
        }

        @JavascriptInterface
        public boolean isNativeAndroid() {
            return true;
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    activity.ensureNotificationPermission();
                }
            });
        }

        @JavascriptInterface
        public boolean hasNotificationPermission() {
            if (Build.VERSION.SDK_INT >= 33) {
                return activity.checkSelfPermission("android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED;
            }
            return true;
        }

        @JavascriptInterface
        public void printPage(String jobTitle) {
            activity.runOnUiThread(new PrintTask(activity, jobTitle));
        }

        @JavascriptInterface
        public void saveBase64File(String base64Data, String fileName, String mimeType) {
            activity.runOnUiThread(new SaveFileTask(activity, base64Data, fileName));
        }

        @JavascriptInterface
        public void setBackgroundActive(final boolean enabled, final String personName) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        PowerManager pm = (PowerManager) activity.getSystemService(Context.POWER_SERVICE);
                        if (enabled) {
                            if (activity.bgWakeLock == null && pm != null) {
                                activity.bgWakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ShiftFlow::BgSyncLock");
                                activity.bgWakeLock.setReferenceCounted(false);
                            }
                            if (activity.bgWakeLock != null && !activity.bgWakeLock.isHeld()) {
                                activity.bgWakeLock.acquire(12 * 60 * 60 * 1000L);
                            }
                        } else {
                            if (activity.bgWakeLock != null && activity.bgWakeLock.isHeld()) {
                                activity.bgWakeLock.release();
                            }
                        }
                    } catch (Exception ignored) {
                    }
                }
            });
        }

        @JavascriptInterface
        public void showNotification(final String title, final String message) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        activity.ensureNotificationPermission();
                        NotificationManager nm = (NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE);
                        if (nm == null) return;
                        String channelId = "shiftflow_high_alerts_v2";
                        Intent launchIntent = new Intent(activity, MainActivity.class);
                        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
                        PendingIntent contentIntent = PendingIntent.getActivity(activity, 0, launchIntent, piFlags);

                        Notification.Builder builder;
                        if (Build.VERSION.SDK_INT >= 26) {
                            NotificationChannel channel = new NotificationChannel(
                                    channelId,
                                    "اعلان‌های فوری شیفت تولید FMD",
                                    NotificationManager.IMPORTANCE_HIGH
                            );
                            channel.enableVibration(true);
                            channel.setVibrationPattern(new long[]{0, 250, 150, 250});
                            channel.enableLights(true);
                            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                            nm.createNotificationChannel(channel);
                            builder = new Notification.Builder(activity, channelId);
                        } else {
                            builder = new Notification.Builder(activity)
                                    .setPriority(Notification.PRIORITY_MAX)
                                    .setDefaults(Notification.DEFAULT_ALL);
                        }

                        String safeTitle = title != null ? title : "ShiftFlow FMD";
                        String safeMsg = message != null ? message : "";
                        builder.setContentTitle(safeTitle)
                                .setContentText(safeMsg)
                                .setStyle(new Notification.BigTextStyle().bigText(safeMsg))
                                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                                .setContentIntent(contentIntent)
                                .setAutoCancel(true);

                        nm.notify((int) (System.currentTimeMillis() & 0xfffffff), builder.build());
                    } catch (Exception ignored) {
                    }
                }
            });
        }
    }

    static class PrintTask implements Runnable {
        final MainActivity activity;
        final String jobTitle;

        PrintTask(MainActivity activity, String jobTitle) {
            this.activity = activity;
            this.jobTitle = jobTitle;
        }

        @Override
        public void run() {
            try {
                PrintManager printManager = (PrintManager) activity.getSystemService(Context.PRINT_SERVICE);
                if (printManager != null && activity.webView != null) {
                    String jobName = (jobTitle != null && !jobTitle.isEmpty()) ? jobTitle : "ShiftFlow-FMD-1405";
                    PrintDocumentAdapter printAdapter = activity.webView.createPrintDocumentAdapter(jobName);
                    PrintAttributes.Builder builder = new PrintAttributes.Builder();
                    builder.setMediaSize(PrintAttributes.MediaSize.ISO_A4);
                    printManager.print(jobName, printAdapter, builder.build());
                }
            } catch (Exception e) {
                Toast.makeText(activity, "خطا در باز کردن پنجره چاپ / PDF: " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        }
    }

    static class SaveFileTask implements Runnable {
        final Context context;
        final String base64Data;
        final String fileName;

        SaveFileTask(Context context, String base64Data, String fileName) {
            this.context = context;
            this.base64Data = base64Data;
            this.fileName = fileName;
        }

        @Override
        public void run() {
            try {
                byte[] decodedBytes = Base64.decode(base64Data, Base64.DEFAULT);
                File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!downloadsDir.exists()) {
                    downloadsDir.mkdirs();
                }
                String safeName = (fileName != null && !fileName.isEmpty()) ? fileName : ("ShiftFlow-" + System.currentTimeMillis() + ".xlsx");
                File outFile = new File(downloadsDir, safeName);
                FileOutputStream fos = new FileOutputStream(outFile);
                fos.write(decodedBytes);
                fos.flush();
                fos.close();
                Toast.makeText(context, "فایل با موفقیت در پوشه Downloads ذخیره شد:\n" + safeName, Toast.LENGTH_LONG).show();
            } catch (Exception e) {
                Toast.makeText(context, "خطا در ذخیره فایل: " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        }
    }
}
