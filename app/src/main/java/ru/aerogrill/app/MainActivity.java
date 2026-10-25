package ru.aerogrill.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Оболочка: интерфейс и рецепты — это веб-страницы во встроенном WebView.
 * Они лежат в assets/www внутри APK, но более новый комплект можно скачать из релиза
 * в папку приложения — так обновления ставятся без переустановки APK.
 */
public class MainActivity extends Activity {
    /**
     * Номер версии оболочки. Комплект страниц из релиза подходит, если ему нужна оболочка не новее этой.
     * tools/release.sh сам увеличивает число, когда меняется Java-код, манифест или ресурсы.
     */
    static final int SHELL = 3;
    /** Обновления принимаются только из релизов этого репозитория. */
    private static final String RELEASES = "https://github.com/DedMazay321/AeroGrill/releases/download/";
    private static final String ASSETS_URL = "file:///android_asset/www/index.html";
    private static final long MAX_WEB_SIZE = 80L << 20;

    static volatile boolean foreground;
    private volatile boolean updating;
    private WebView web;
    private SharedPreferences prefs;
    /** Версия страниц, которые сейчас показаны: из APK или из скачанного комплекта. */
    private volatile String activeVersion = "";
    private boolean clearHistory;
    // Режим готовки без рук: распознавание команд и чтение шагов вслух
    private SpeechRecognizer recognizer;
    private boolean voiceOn;
    private TextToSpeech tts;
    private boolean ttsReady;
    private String pendingSpeech;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // На кухне экран не должен гаснуть посреди рецепта
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        prefs = getSharedPreferences("app", MODE_PRIVATE);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true); // скачанный комплект страниц лежит в папке приложения
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);
        web.setWebViewClient(new WebViewClient() {
            // После смены комплекта страниц кнопка «Назад» не должна возвращать к старому
            @Override
            public void onPageFinished(WebView view, String url) {
                if (clearHistory) {
                    clearHistory = false;
                    view.clearHistory();
                }
            }

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
        loadWeb();
    }

    @Override
    protected void onResume() {
        super.onResume();
        foreground = true;
    }

    @Override
    protected void onPause() {
        endVoice(null); // микрофон не остаётся включённым, когда приложение свёрнуто
        if (tts != null) tts.stop();
        foreground = false;
        super.onPause();
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    /* ---------- Какие страницы показывать ---------- */

    private String apkVersion() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (PackageManager.NameNotFoundException e) {
            return "0";
        }
    }

    private static int compareVersions(String a, String b) {
        String[] x = a.split("\\."), y = b.split("\\.");
        for (int i = 0; i < 3; i++) {
            int d = part(x, i) - part(y, i);
            if (d != 0) return d;
        }
        return 0;
    }

    private static int part(String[] v, int i) {
        try {
            return i < v.length ? Integer.parseInt(v[i]) : 0;
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private File webRoot() {
        return new File(getFilesDir(), "web");
    }

    private static void delete(File f) {
        File[] children = f.listFiles();
        if (children != null) for (File c : children) delete(c);
        f.delete();
    }

    /**
     * Показывает скачанный комплект страниц, если он новее встроенного в APK и исправен.
     * Комплект, который за три запуска ни разу не сообщил, что загрузился, считается сломанным и удаляется.
     */
    private void loadWeb() {
        clearHistory = true;
        String apk = apkVersion(), ver = prefs.getString("web_ver", null);
        if (ver != null) {
            File index = new File(new File(webRoot(), ver), "index.html");
            int tries = prefs.getInt("web_tries", 0);
            boolean confirmed = prefs.getBoolean("web_ok", false);
            if (compareVersions(ver, apk) > 0 && index.isFile() && (confirmed || tries < 3)) {
                if (!confirmed) prefs.edit().putInt("web_tries", tries + 1).apply();
                activeVersion = ver;
                web.loadUrl(Uri.fromFile(index).toString());
                return;
            }
            prefs.edit().remove("web_ver").remove("web_ok").remove("web_tries").apply();
            delete(webRoot());
        }
        activeVersion = apk;
        web.loadUrl(ASSETS_URL);
    }

    /* ---------- Загрузка обновлений ---------- */

    private void js(String fn, String arg) {
        web.post(() -> web.evaluateJavascript("window." + fn + " && window." + fn + "(" + arg + ")", null));
    }

    private HttpURLConnection open(String url) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        if (c.getResponseCode() != 200) throw new IOException("HTTP " + c.getResponseCode());
        return c;
    }

    /** Копирует поток и сообщает интерфейсу проценты от 0 до 99. */
    private void copy(InputStream in, OutputStream out, long total) throws IOException {
        byte[] buf = new byte[65536];
        long done = 0;
        int n, shown = -1;
        while ((n = in.read(buf)) > 0) {
            out.write(buf, 0, n);
            done += n;
            if (done > MAX_WEB_SIZE) throw new IOException("файл слишком большой");
            int pct = total > 0 ? (int) Math.min(99, done * 100 / total) : 0;
            if (pct != shown) js("onUpdateProgress", String.valueOf(shown = pct));
        }
    }

    /** Скачивает APK из релиза и передаёт его системному установщику, который спросит подтверждение. */
    private void downloadAndInstall(String url) {
        PackageInstaller.Session session = null;
        try {
            HttpURLConnection c = open(url);
            long total = c.getContentLengthLong();

            PackageInstaller installer = getPackageManager().getPackageInstaller();
            PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
            params.setAppPackageName(getPackageName());
            int id = installer.createSession(params);
            session = installer.openSession(id);

            try (InputStream in = c.getInputStream(); OutputStream out = session.openWrite("update.apk", 0, total > 0 ? total : -1)) {
                copy(in, out, total);
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

    /** Распаковывает архив в папку, не выпуская файлы за её пределы. */
    private static void unzip(File zip, File dir) throws IOException {
        String root = dir.getCanonicalPath() + File.separator;
        byte[] buf = new byte[65536];
        try (ZipInputStream in = new ZipInputStream(new FileInputStream(zip))) {
            for (ZipEntry e; (e = in.getNextEntry()) != null; ) {
                File out = new File(dir, e.getName());
                if (!out.getCanonicalPath().startsWith(root)) throw new IOException("недопустимый путь в архиве");
                if (e.isDirectory()) {
                    out.mkdirs();
                    continue;
                }
                out.getParentFile().mkdirs();
                try (OutputStream os = new FileOutputStream(out)) {
                    for (int n; (n = in.read(buf)) > 0; ) os.write(buf, 0, n);
                }
            }
        }
    }

    /** Скачивает комплект страниц из релиза и делает его активным. Окно установки Android не нужно. */
    private void downloadWeb(String url, String version, boolean reload) {
        File zip = new File(getCacheDir(), "www.zip");
        File tmp = new File(webRoot(), version + ".tmp"), dir = new File(webRoot(), version);
        try {
            HttpURLConnection c = open(url);
            try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(zip)) {
                copy(in, out, c.getContentLengthLong());
            }
            delete(tmp);
            delete(dir);
            tmp.mkdirs();
            unzip(zip, tmp);
            if (!new File(tmp, "index.html").isFile()) throw new IOException("в архиве нет index.html");
            if (!tmp.renameTo(dir)) throw new IOException("не удалось сохранить файлы");

            prefs.edit().putString("web_ver", version).putBoolean("web_ok", false).putInt("web_tries", 0).apply();
            File[] old = webRoot().listFiles();
            if (old != null) for (File f : old) if (!f.equals(dir)) delete(f);

            if (reload) runOnUiThread(this::loadWeb);
            else js("onWebReady", JSONObject.quote(version));
        } catch (Exception e) {
            delete(tmp);
            js("onUpdateError", JSONObject.quote(String.valueOf(e.getMessage())));
        } finally {
            zip.delete();
            updating = false;
        }
    }

    @Override
    protected void onDestroy() {
        endVoice(null);
        if (tts != null) tts.shutdown();
        super.onDestroy();
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        if (code != 2) return;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) beginVoice();
        else endVoice("Без доступа к микрофону голосовое управление не работает");
    }

    /* ---------- Голос и чтение вслух ---------- */

    private void beginVoice() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 2);
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            endVoice("На телефоне нет службы распознавания речи");
            return;
        }
        voiceOn = true;
        if (recognizer == null) {
            recognizer = SpeechRecognizer.createSpeechRecognizer(this);
            recognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onResults(Bundle b) {
                    ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (r != null && !r.isEmpty()) js("onVoice", JSONObject.quote(r.get(0)));
                    relisten();
                }
                @Override public void onError(int error) {
                    if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) endVoice("Нет доступа к микрофону");
                    else relisten(); // тишина или неразборчивая фраза — просто слушаем дальше
                }
                @Override public void onReadyForSpeech(Bundle b) { }
                @Override public void onBeginningOfSpeech() { }
                @Override public void onRmsChanged(float v) { }
                @Override public void onBufferReceived(byte[] bytes) { }
                @Override public void onEndOfSpeech() { }
                @Override public void onPartialResults(Bundle b) { }
                @Override public void onEvent(int type, Bundle b) { }
            });
        }
        listen();
        js("onVoiceState", "true");
    }

    private void listen() {
        if (!voiceOn || recognizer == null) return;
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ru-RU")
                .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
        try {
            recognizer.startListening(i);
        } catch (Exception e) {
            endVoice("Не удалось включить микрофон");
        }
    }

    private void relisten() {
        if (voiceOn) web.postDelayed(this::listen, 250);
    }

    private void endVoice(String message) {
        boolean was = voiceOn;
        voiceOn = false;
        if (recognizer != null) {
            recognizer.destroy();
            recognizer = null;
        }
        if (was || message != null) js("onVoiceState", "false" + (message != null ? ", " + JSONObject.quote(message) : ""));
    }

    private void say(String text) {
        if (tts == null) {
            pendingSpeech = text;
            tts = new TextToSpeech(this, status -> {
                if (status != TextToSpeech.SUCCESS) return;
                tts.setLanguage(new Locale("ru", "RU"));
                ttsReady = true;
                if (pendingSpeech != null) say(pendingSpeech);
                pendingSpeech = null;
            });
            return;
        }
        if (!ttsReady) {
            pendingSpeech = text;
            return;
        }
        if (text == null || text.isEmpty()) tts.stop();
        else tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "step");
    }

    /* ---------- Таймеры ---------- */

    /** У каждого таймера свой номер: он отличает будильники и уведомления друг от друга. */
    private PendingIntent alarmIntent(int id, String label) {
        Intent i = new Intent(this, TimerReceiver.class).putExtra("label", label).putExtra("id", id);
        return PendingIntent.getBroadcast(this, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Методы, которые вызывает интерфейс. */
    private class Bridge {
        // Таймер должен сработать, даже если приложение свёрнуто
        @JavascriptInterface
        public void startTimer(int id, int seconds, String label) {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33
                        && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1);
                }
                AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
                long at = System.currentTimeMillis() + seconds * 1000L;
                PendingIntent pi = alarmIntent(id, label);
                try {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                } catch (SecurityException e) {
                    // Точные будильники запрещены пользователем — ставим обычный
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                }
            });
        }

        @JavascriptInterface
        public void cancelTimer(int id) {
            runOnUiThread(() -> ((AlarmManager) getSystemService(Context.ALARM_SERVICE)).cancel(alarmIntent(id, "")));
        }

        @JavascriptInterface
        public void startVoice() {
            runOnUiThread(MainActivity.this::beginVoice);
        }

        @JavascriptInterface
        public void stopVoice() {
            runOnUiThread(() -> endVoice(null));
        }

        @JavascriptInterface
        public void speak(String text) {
            runOnUiThread(() -> say(text));
        }

        @JavascriptInterface
        public String getVersion() {
            return activeVersion;
        }

        @JavascriptInterface
        public int getShell() {
            return SHELL;
        }

        /** Страницы загрузились и работают — скачанный комплект можно считать исправным. */
        @JavascriptInterface
        public void webOk() {
            prefs.edit().putBoolean("web_ok", true).apply();
        }

        // Данные пользователя дублируются здесь: у страниц из APK и из скачанного комплекта разные адреса,
        // и хранилище браузера у них может не совпасть.
        @JavascriptInterface
        public void saveState(String json) {
            prefs.edit().putString("state", json).apply();
        }

        @JavascriptInterface
        public String loadState() {
            return prefs.getString("state", "");
        }

        private boolean begin(String url) {
            if (url == null || !url.startsWith(RELEASES)) {
                js("onUpdateError", JSONObject.quote("неверный адрес обновления"));
                return false;
            }
            if (updating) return false;
            updating = true;
            return true;
        }

        @JavascriptInterface
        public void installUpdate(String url) {
            if (begin(url)) new Thread(() -> downloadAndInstall(url)).start();
        }

        @JavascriptInterface
        public void installWeb(String url, String version, boolean reload) {
            if (version == null || !version.matches("\\d{1,4}\\.\\d{1,4}\\.\\d{1,4}")) {
                js("onUpdateError", JSONObject.quote("неверный номер версии"));
                return;
            }
            if (begin(url)) new Thread(() -> downloadWeb(url, version, reload)).start();
        }

        /** Перезагружает страницы — применяет комплект, скачанный в фоне. */
        @JavascriptInterface
        public void reloadWeb() {
            runOnUiThread(MainActivity.this::loadWeb);
        }
    }
}
