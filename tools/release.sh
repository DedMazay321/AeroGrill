#!/usr/bin/env bash
# Выпуск новой версии: tools/release.sh 1.2.0 "Что изменилось"
set -euo pipefail
cd "$(dirname "$0")/.."

VER="${1:?Укажите версию, например 1.2.0}"
NOTES="${2:?Укажите описание изменений}"
REPO="DedMazay321/AeroGrill"
[[ "$VER" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Версия должна быть вида 1.2.0"; exit 1; }
if git rev-parse -q --verify "refs/tags/v$VER" >/dev/null; then echo "Версия $VER уже выпущена"; exit 1; fi
[ -f signing/aerogrill.keystore ] || { echo "Нет ключа signing/aerogrill.keystore — обновление не установится поверх старой версии"; exit 1; }

# Номер версии: versionName — для людей, versionCode — счётчик, по которому Android сравнивает сборки
CODE=$(( $(sed -n 's/.*versionCode \([0-9]*\).*/\1/p' app/build.gradle) + 1 ))
sed -i -E "s/versionCode [0-9]+/versionCode $CODE/; s/versionName '[^']*'/versionName '$VER'/" app/build.gradle
# Номер версии для сайта и его кэша
sed -i -E "s/const WEB_VERSION = '[^']*';/const WEB_VERSION = '$VER';/" app/src/main/assets/www/js/version.js
sed -i -E "s/const VERSION = '[^']*';/const VERSION = '$VER';/" app/src/main/assets/www/sw.js

VER="$VER" NOTES="$NOTES" node -e '
  const fs = require("fs"), f = "CHANGELOG.md", head = "# История версий\n\n";
  const entry = "## " + process.env.VER + " — " + new Date().toISOString().slice(0, 10) + "\n" + process.env.NOTES.trim() + "\n\n";
  fs.writeFileSync(f, head + entry + fs.readFileSync(f, "utf8").replace(head, ""));'

# Версия оболочки растёт, только когда с прошлого релиза менялся Java-код, манифест или ресурсы.
# Пока она прежняя, телефоны обновляются архивом страниц — без переустановки APK.
MAIN=app/src/main/java/ru/aerogrill/app/MainActivity.java
SHELL_VER=$(sed -n 's/.*int SHELL = \([0-9]*\);.*/\1/p' "$MAIN")
LAST=$(git describe --tags --abbrev=0 2>/dev/null || true)
if [ -n "$LAST" ] && ! git diff --quiet "$LAST" -- app/src/main/java app/src/main/AndroidManifest.xml app/src/main/res; then
  SHELL_VER=$((SHELL_VER + 1))
  sed -i -E "s/int SHELL = [0-9]+;/int SHELL = $SHELL_VER;/" "$MAIN"
  echo "Оболочка изменилась: это обновление потребует установки APK (оболочка $SHELL_VER)"
fi

export JAVA_HOME="${JAVA_HOME:-E:\\AndroidSdk\\jdk}"
./gradlew.bat assembleDebug -q --console=plain
cp app/build/outputs/apk/debug/app-debug.apk AeroGrill.apk
WEB="www-shell$SHELL_VER.zip"
rm -f www-shell*.zip
"$(cygpath -u "$JAVA_HOME")/bin/jar" cfM "$WEB" -C app/src/main/assets/www .

git add -A
git commit -q -m "Версия $VER" -m "$NOTES" ${COMMIT_TRAILER:+-m "$COMMIT_TRAILER"}
git tag "v$VER"
git push -q origin HEAD "v$VER"

# Токен берётся из сохранённого входа git и никуда не записывается
TOKEN=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill | sed -n 's/^password=//p')
API=(-fsS -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json")
# Тело запроса идёт через поток: в аргументах командной строки Windows портит кириллицу
ID=$(VER="$VER" NOTES="$NOTES" node -e 'process.stdout.write(JSON.stringify({ tag_name: "v" + process.env.VER, name: "Версия " + process.env.VER, body: process.env.NOTES }))'   | curl "${API[@]}" -X POST -H "Content-Type: application/json; charset=utf-8" "https://api.github.com/repos/$REPO/releases" --data-binary @- | node -e 'console.log(JSON.parse(require("fs").readFileSync(0, "utf8")).id)')
curl "${API[@]}" -X POST -H "Content-Type: application/vnd.android.package-archive" --data-binary @AeroGrill.apk \
  "https://uploads.github.com/repos/$REPO/releases/$ID/assets?name=AeroGrill.apk" >/dev/null
curl "${API[@]}" -X POST -H "Content-Type: application/zip" --data-binary @"$WEB" \
  "https://uploads.github.com/repos/$REPO/releases/$ID/assets?name=$WEB" >/dev/null

echo "Готово: версия $VER (сборка $CODE, оболочка $SHELL_VER) — https://github.com/$REPO/releases/tag/v$VER"
