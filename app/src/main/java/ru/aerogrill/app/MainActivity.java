package ru.aerogrill.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Оболочка: весь интерфейс лежит в assets/www и показывается во встроенном WebView. */
public class MainActivity extends Activity {
    /** Обновления принимаются только из релизов этого репозитория. */
    private static final String RELEASES = "https://github.com/DedMazay321/AeroGrill/releases/download/";
    static volatile boolean foreground;
    private volatile boolean updating;
    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // На кухне экран не должен гаснуть посреди рецепта
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);
        web.setWebViewClient(new WebViewClient() {
            // Внешние ссылки (источники фото) открываются в браузере, а не внутри приложения
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!"http".equals(uri.getScheme()) && !"https".equals(uri.getScheme())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException e) {
                    // Браузера нет — остаёмся в приложении
                }
                return true;
            }
        });
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        setContentView(web);

        if (savedInstanceState == null) web.loadUrl("file:///android_asset/www/index.html");
        else web.restoreState(savedInstanceState);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        foreground = true;
    }

    @Override
    protected void onPause() {
        foreground = false;
        super.onPause();
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    private PendingIntent alarmIntent(String label) {
        Intent i = new Intent(this, TimerReceiver.class).putExtra("label", label);
        return PendingIntent.getBroadcast(this, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void js(String fn, String arg) {
        web.post(() -> web.evaluateJavascript("window." + fn + "(" + arg + ")", null));
    }

    /** Скачивает APK из релиза и передаёт его системному установщику, который спросит подтверждение. */
    private void downloadAndInstall(String url) {
        PackageInstaller.Session session = null;
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            if (c.getResponseCode() != 200) throw new IOException("HTTP " + c.getResponseCode());
            long total = c.getContentLengthLong();

            PackageInstaller installer = getPackageManager().getPackageInstaller();
            PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
            params.setAppPackageName(getPackageName());
            int id = installer.createSession(params);
            session = installer.openSession(id);

            try (InputStream in = c.getInputStream(); OutputStream out = session.openWrite("update.apk", 0, total > 0 ? total : -1)) {
                byte[] buf = new byte[65536];
                long done = 0;
                int n, shown = -1;
                while ((n = in.read(buf)) > 0) {
                    out.write(buf, 0, n);
                    done += n;
                    int pct = total > 0 ? (int) Math.min(99, done * 100 / total) : 0;
                    if (pct != shown) js("onUpdateProgress", String.valueOf(shown = pct));
                }
                session.fsync(out);
            }

            Intent result = new Intent(this, InstallReceiver.class);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
            session.commit(PendingIntent.getBroadcast(this, id, result, flags).getIntentSender());
            session.close();
            js("onUpdateProgress", "100");
        } catch (Exception e) {
            if (session != null) session.abandon();
            js("onUpdateError", JSONObject.quote(String.valueOf(e.getMessage())));
        } finally {
            updating = false;
        }
    }

    /** Методы, которые вызывает интерфейс: таймер должен сработать, даже если приложение свёрнуто. */
    private class Bridge {
        @JavascriptInterface
        public void startTimer(int seconds, String label) {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33
                        && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1);
                }
                AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
                long at = System.currentTimeMillis() + seconds * 1000L;
                PendingIntent pi = alarmIntent(label);
                try {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                } catch (SecurityException e) {
                    // Точные будильники запрещены пользователем — ставим обычный
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                }
            });
        }

        @JavascriptInterface
        public String getVersion() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (PackageManager.NameNotFoundException e) {
                return "";
            }
        }

        @JavascriptInterface
        public void installUpdate(String url) {
            if (url == null || !url.startsWith(RELEASES)) {
                js("onUpdateError", JSONObject.quote("неверный адрес обновления"));
                return;
            }
            if (updating) return;
            updating = true;
            new Thread(() -> downloadAndInstall(url)).start();
        }

        @JavascriptInterface
        public void cancelTimer() {
            runOnUiThread(() -> ((AlarmManager) getSystemService(Context.ALARM_SERVICE)).cancel(alarmIntent("")));
        }
    }
}
