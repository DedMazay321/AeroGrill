#!/usr/bin/env bash
# Сборка версии для Windows: tools/build-exe.sh → AeroGrill.exe в корне проекта.
# Нужны .NET SDK (dotnet) и JDK (для упаковки страниц в архив).
set -euo pipefail
cd "$(dirname "$0")/.."

VER=$(sed -n "s/.*versionName '\([^']*\)'.*/\1/p" app/build.gradle)
export JAVA_HOME="${JAVA_HOME:-E:\AndroidSdk\jdk}"
mkdir -p desktop/obj
rm -f desktop/obj/www.zip
"$(cygpath -u "$JAVA_HOME")/bin/jar" cfM desktop/obj/www.zip -C app/src/main/assets/www .

dotnet build desktop/AeroGrill.csproj -c Release -nologo -v quiet -p:AppVersion="$VER" -p:WwwZip=obj/www.zip
cp desktop/bin/Release/net48/AeroGrill.exe AeroGrill.exe
echo "Готово: AeroGrill.exe, версия $VER, $(( $(stat -c %s AeroGrill.exe) / 1024 )) КБ"
