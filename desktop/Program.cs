using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace AeroGrill
{
    static class Program
    {
        /// <summary>Папка приложения: скачанные страницы, данные пользователя и профиль браузера.</summary>
        public static readonly string DataDir =
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AeroGrill");

        public static byte[] Resource(string name)
        {
            using (var s = Assembly.GetExecutingAssembly().GetManifestResourceStream(name))
            {
                if (s == null) return null;
                using (var m = new MemoryStream())
                {
                    s.CopyTo(m);
                    return m.ToArray();
                }
            }
        }

        [STAThread]
        static void Main()
        {
            // Библиотеки WebView2 лежат внутри exe. Обработчик должен быть установлен до первого обращения к ним,
            // поэтому окно создаётся в отдельном методе.
            AppDomain.CurrentDomain.AssemblyResolve += (s, e) =>
            {
                var dll = Resource(new AssemblyName(e.Name).Name + ".dll");
                return dll == null ? null : Assembly.Load(dll);
            };
            using (var once = new Mutex(true, "AeroGrill.Desktop", out bool first))
            {
                if (!first) return; // приложение уже открыто
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Run();
            }
        }

        [MethodImpl(MethodImplOptions.NoInlining)]
        static void Run()
        {
            Application.Run(new MainForm());
        }
    }

    class MainForm : Form
    {
        const string Host = "aerogrill.app";
        const string Origin = "https://" + Host + "/";
        /// <summary>Обновления принимаются только из релизов этого репозитория.</summary>
        const string Releases = "https://github.com/DedMazay321/AeroGrill/releases/download/";

        readonly WebView2 web = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.FromArgb(20, 20, 22) };
        readonly string wwwRoot = Path.Combine(Program.DataDir, "www");
        readonly string stateFile = Path.Combine(Program.DataDir, "state.json");
        readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
        CoreWebView2 core;
        string shimId, shownVersion;
        bool updating;

        public MainForm()
        {
            Text = "АэроГриль";
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            BackColor = Color.FromArgb(20, 20, 22);
            StartPosition = FormStartPosition.CenterScreen;
            float k = DeviceDpi / 96f;
            int h = Math.Min((int)(900 * k), Screen.PrimaryScreen.WorkingArea.Height - 40);
            ClientSize = new Size((int)(440 * k), h);
            MinimumSize = new Size((int)(360 * k), (int)(560 * k));
            Controls.Add(web);
            Load += async (s, e) => await Init();
        }

        async Task Init()
        {
            try
            {
                ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
                Directory.CreateDirectory(wwwRoot);

                // Системная часть WebView2 ищет свою библиотеку на диске — выкладываем её рядом с данными
                string bin = Path.Combine(Program.DataDir, "bin"), loader = Path.Combine(bin, "WebView2Loader.dll");
                byte[] dll = Program.Resource("WebView2Loader.dll");
                Directory.CreateDirectory(bin);
                if (!File.Exists(loader) || new FileInfo(loader).Length != dll.Length) File.WriteAllBytes(loader, dll);
                CoreWebView2Environment.SetLoaderDllFolderPath(bin);

                var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(Program.DataDir, "WebView2"));
                await web.EnsureCoreWebView2Async(env);
                core = web.CoreWebView2;
                core.Settings.AreDefaultContextMenusEnabled = false;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.IsZoomControlEnabled = false;
                core.Settings.AreBrowserAcceleratorKeysEnabled = false;
                core.WebMessageReceived += OnMessage;
                // Внешние ссылки (источники фото) открываются в обычном браузере
                core.NavigationStarting += (s, e) =>
                {
                    if (e.Uri.StartsWith(Origin, StringComparison.OrdinalIgnoreCase)) return;
                    e.Cancel = true;
                    OpenExternal(e.Uri);
                };
                core.NewWindowRequested += (s, e) =>
                {
                    e.Handled = true;
                    OpenExternal(e.Uri);
                };

                UnpackBuiltIn();
                await LoadWeb();
            }
            catch (Exception ex)
            {
                MessageBox.Show(this, "Не удалось запустить приложение.\n\n" + ex.Message +
                    "\n\nНужен компонент Microsoft Edge WebView2 Runtime — в Windows 10 и 11 он обычно уже установлен.",
                    "АэроГриль", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
            }
        }

        static void OpenExternal(string uri)
        {
            if (!uri.StartsWith("https://", StringComparison.OrdinalIgnoreCase) && !uri.StartsWith("http://", StringComparison.OrdinalIgnoreCase)) return;
            try { Process.Start(new ProcessStartInfo(uri) { UseShellExecute = true }); }
            catch (Exception) { /* браузер не найден */ }
        }

        /* ---------- Какие страницы показывать ---------- */

        static string BuiltInVersion()
        {
            Version v = Assembly.GetExecutingAssembly().GetName().Version;
            return v.Major + "." + v.Minor + "." + v.Build;
        }

        /// <summary>Страницы, встроенные в exe, распаковываются в общую папку версий при первом запуске.</summary>
        void UnpackBuiltIn()
        {
            string dir = Path.Combine(wwwRoot, BuiltInVersion());
            // Если уже есть эта или более новая (скачанная) версия, встроенная не нужна
            if (Versions().Any(v => new Version(v) >= new Version(BuiltInVersion()))) return;
            string zip = Path.Combine(Program.DataDir, "builtin.zip");
            File.WriteAllBytes(zip, Program.Resource("www.zip"));
            try { Unzip(zip, dir); }
            finally { File.Delete(zip); }
        }

        /// <summary>Самая новая исправная версия страниц: встроенная в exe или скачанная из релиза.</summary>
        IEnumerable<string> Versions()
        {
            return Directory.GetDirectories(wwwRoot)
                .Select(Path.GetFileName)
                .Where(n => Regex.IsMatch(n, @"^\d+\.\d+\.\d+$") && File.Exists(Path.Combine(wwwRoot, n, "index.html")));
        }

        string ActiveVersion()
        {
            return Versions().OrderByDescending(n => new Version(n)).First();
        }

        async Task LoadWeb()
        {
            string version = ActiveVersion();
            // Страницы ждут тот же «мост», что и на Android. Здесь его заменяет этот скрипт:
            // версию и сохранённые данные он получает сразу, остальное передаёт программе сообщениями.
            string state = File.Exists(stateFile) ? File.ReadAllText(stateFile) : "";
            string shim = @"(function () {
  var post = function (m) { window.chrome.webview.postMessage(m); };
  window.AndroidBridge = {
    getVersion: function () { return '" + version + @"'; },
    getShell: function () { return 999; },
    webOk: function () {}, startTimer: function () {}, cancelTimer: function () {},
    loadState: function () { return '" + HttpUtility.JavaScriptStringEncode(state) + @"'; },
    saveState: function (j) { post({ cmd: 'save', json: j }); },
    installWeb: function (url, version, reload) { post({ cmd: 'web', url: url, version: version, reload: !!reload }); },
    reloadWeb: function () { post({ cmd: 'reload' }); }
  };
})();";
            if (shimId != null) core.RemoveScriptToExecuteOnDocumentCreated(shimId);
            shimId = await core.AddScriptToExecuteOnDocumentCreatedAsync(shim);

            if (shownVersion != null && shownVersion != version)
                await core.Profile.ClearBrowsingDataAsync(CoreWebView2BrowsingDataKinds.DiskCache); // иначе останутся старые скрипты
            core.SetVirtualHostNameToFolderMapping(Host, Path.Combine(wwwRoot, version), CoreWebView2HostResourceAccessKind.Allow);
            shownVersion = version;
            core.Navigate(Origin + "index.html?v=" + version);

            // Старые версии страниц больше не нужны
            foreach (string dir in Directory.GetDirectories(wwwRoot))
                if (Path.GetFileName(dir) != version)
                    try { Directory.Delete(dir, true); } catch (Exception) { /* занято — удалим в другой раз */ }
        }

        /* ---------- Сообщения от страниц ---------- */

        async void OnMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                var m = json.Deserialize<Dictionary<string, object>>(e.WebMessageAsJson);
                switch (m["cmd"] as string)
                {
                    case "save":
                        File.WriteAllText(stateFile, (string)m["json"]);
                        break;
                    case "reload":
                        await LoadWeb();
                        break;
                    case "web":
                        await InstallWeb((string)m["url"], (string)m["version"], (bool)m["reload"]);
                        break;
                }
            }
            catch (Exception ex)
            {
                updating = false;
                Js("onUpdateError", ex.Message);
            }
        }

        void Js(string fn, string text)
        {
            core.ExecuteScriptAsync("window." + fn + " && window." + fn + "('" + HttpUtility.JavaScriptStringEncode(text) + "')");
        }

        /// <summary>Скачивает из релиза архив со страницами и рецептами и делает его активным.</summary>
        async Task InstallWeb(string url, string version, bool reload)
        {
            if (!url.StartsWith(Releases) || !Regex.IsMatch(version, @"^\d{1,4}\.\d{1,4}\.\d{1,4}$"))
                throw new InvalidOperationException("неверный адрес обновления");
            if (updating) return;
            updating = true;
            string zip = Path.Combine(Program.DataDir, "update.zip"), tmp = Path.Combine(wwwRoot, version + ".tmp"), dir = Path.Combine(wwwRoot, version);
            try
            {
                using (var client = new WebClient())
                {
                    int shown = -1;
                    client.DownloadProgressChanged += (s, p) =>
                    {
                        int pct = Math.Min(99, p.ProgressPercentage);
                        if (pct != shown) core.ExecuteScriptAsync("window.onUpdateProgress && window.onUpdateProgress(" + (shown = pct) + ")");
                    };
                    await client.DownloadFileTaskAsync(new Uri(url), zip);
                }
                if (Directory.Exists(tmp)) Directory.Delete(tmp, true);
                if (Directory.Exists(dir)) Directory.Delete(dir, true);
                Unzip(zip, tmp);
                if (!File.Exists(Path.Combine(tmp, "index.html"))) throw new InvalidDataException("в архиве нет index.html");
                Directory.Move(tmp, dir);
            }
            finally
            {
                File.Delete(zip);
                if (Directory.Exists(tmp)) Directory.Delete(tmp, true);
                updating = false;
            }
            if (reload) await LoadWeb();
            else Js("onWebReady", version);
        }

        /// <summary>Распаковывает архив в папку, не выпуская файлы за её пределы.</summary>
        static void Unzip(string zip, string dir)
        {
            string root = Path.GetFullPath(dir) + Path.DirectorySeparatorChar;
            using (var archive = ZipFile.OpenRead(zip))
            {
                foreach (var entry in archive.Entries)
                {
                    string path = Path.GetFullPath(Path.Combine(root, entry.FullName));
                    if (!path.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("недопустимый путь в архиве");
                    if (entry.FullName.EndsWith("/") || entry.FullName.EndsWith("\\"))
                    {
                        Directory.CreateDirectory(path);
                        continue;
                    }
                    Directory.CreateDirectory(Path.GetDirectoryName(path));
                    entry.ExtractToFile(path, true);
                }
            }
        }
    }
}
