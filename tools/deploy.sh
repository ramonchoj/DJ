#!/usr/bin/env bash
# Despliegue de Cabina a cabina.softmotion.mx con rutas versionadas.
#
# Problema que resuelve: el dominio está detrás de Cloudflare, que cachea
# los .js/.css 4 h ignorando el Cache-Control del origen. Si se sobrescriben
# los archivos en el mismo path, los visitantes reciben mezcla de HTML nuevo
# con JS viejo (p. ej. "el botón DJ no funciona").
#
# Solución: cada versión vive en r/<version>/ (URLs nuevas = caché frío).
# index.html (que Cloudflare no cachea) carga r/<version>/ y un import map
# redirige TODOS los imports de módulos ES a esa carpeta. sw.js se registra
# como sw.js?v=<version>. Los assets (audio) van en assets/ (inmutables).
#
# Uso: tools/deploy.sh            (usa la versión de app/package.json)
#      tools/deploy.sh 3.0.1-rc1  (versión explícita)
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
APP="$REPO/app"
VER="${1:-$(py -3 -c "import json,sys;print(json.load(open(sys.argv[1],encoding='utf-8'))['version'])" "$APP/package.json")}"
HOST="k313aoe6wjqm@p3plzcpnl506144.prod.phx3.secureserver.net"
KEY="$HOME/.ssh/cabina_softmotion"
REMOTO="~/cabina.softmotion.mx"
STAGE="$(mktemp -d)"
ORIGEN_URL="https://cabina.softmotion.mx"

echo "== Cabina deploy v$VER =="
mkdir -p "$STAGE/r/$VER" "$STAGE/assets"
cp -r "$APP/src" "$STAGE/r/$VER/src"
cp "$APP/estilos.css" "$STAGE/r/$VER/estilos.css"
cp -r "$APP/assets/." "$STAGE/assets/"
rm -rf "$STAGE/assets/pruebas"
cp "$APP/.htaccess" "$STAGE/.htaccess"

# index.html: import map + rutas versionadas + sw.js?v=
py -3 - "$APP/index.html" "$STAGE/index.html" "$VER" "$ORIGEN_URL" << 'PY'
import sys, re
src, dst, ver, origen = sys.argv[1:5]
s = open(src, encoding='utf-8').read()
importmap = f'''<script type="importmap">{{"imports":{{"{origen}/src/":"{origen}/r/{ver}/src/","/src/":"/r/{ver}/src/","./src/":"./r/{ver}/src/"}}}}</script>
'''
s = s.replace('<link rel="stylesheet" href="estilos.css">', f'<link rel="stylesheet" href="r/{ver}/estilos.css">\n' + importmap)
s = s.replace('<script type="module" src="src/main.js"></script>', f'<script type="module" src="r/{ver}/src/main.js"></script>')
s = re.sub(r'<span class="pie-version">v[^<]*</span>', f'<span class="pie-version">v{ver}</span>', s)
import datetime, zoneinfo
ahora = datetime.datetime.now(zoneinfo.ZoneInfo('America/Mexico_City'))
meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
legible = f"{ahora.day} {meses[ahora.month-1]} {ahora.year} · {ahora:%H:%M} CDMX"
s = s.replace('{{PUBLICADO_ISO}}', ahora.isoformat(timespec='minutes')).replace('{{PUBLICADO}}', legible)
assert f'r/{ver}/src/main.js' in s and 'importmap' in s
open(dst, 'w', encoding='utf-8', newline='\n').write(s)
PY

# main.js: registrar sw.js?v=VER (misma lógica, URL distinta por versión)
py -3 - "$STAGE/r/$VER/src/main.js" "$VER" << 'PY'
import sys
p, ver = sys.argv[1:3]
s = open(p, encoding='utf-8').read()
s = s.replace("navigator.serviceWorker.register('./sw.js')", f"navigator.serviceWorker.register('/sw.js?v={ver}')")
open(p, 'w', encoding='utf-8', newline='\n').write(s)
PY

# sw.js: VERSION y rutas del shell apuntando a r/VER
py -3 - "$APP/sw.js" "$STAGE/sw.js" "$VER" << 'PY'
import sys, re
src, dst, ver = sys.argv[1:4]
s = open(src, encoding='utf-8').read()
s = re.sub(r"const VERSION = '[^']*';", f"const VERSION = 'cabina-v{ver}';", s)
s = s.replace("'./src/", f"'./r/{ver}/src/").replace("'./estilos.css'", f"'./r/{ver}/estilos.css'")
open(dst, 'w', encoding='utf-8', newline='\n').write(s)
PY

TAR="$STAGE/cabina-$VER.tar.gz"
( cd "$STAGE" && tar -czf "$TAR" index.html sw.js .htaccess r assets )
echo "paquete: $(du -h "$TAR" | cut -f1)"
scp -q -i "$KEY" -o BatchMode=yes "$TAR" "$HOST:$REMOTO/cabina.tar.gz"
ssh -i "$KEY" -o BatchMode=yes "$HOST" "cd $REMOTO && tar -xzf cabina.tar.gz && rm cabina.tar.gz && ls r | sort -V | head -n -3 | xargs -r -I{} rm -rf r/{} && echo 'versiones en servidor:' && ls r" 2>&1 | grep -v tput
rm -rf "$STAGE"

echo "== verificación =="
for u in "" "r/$VER/src/main.js" "r/$VER/estilos.css" "sw.js?v=$VER"; do
  printf "%-40s " "/$u"; curl -s -o /dev/null -w "%{http_code} cf=%{header_json}\n" "$ORIGEN_URL/$u" | sed -E 's/cf=.*"cf-cache-status":\["([^"]+)"\].*/cf=\1/; s/cf=\{.*/cf=?/'
done
curl -s "$ORIGEN_URL/" | grep -o "r/$VER/src/main.js" | head -1 | sed 's/^/index.html apunta a: /'
