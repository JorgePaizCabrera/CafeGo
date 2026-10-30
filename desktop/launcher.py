"""Punto de entrada del programa empaquetado (GoCafe.exe).

Levanta PostgreSQL (portátil, dentro de la carpeta del programa), aplica las
migraciones, inicia la API de Node que también sirve la interfaz, y abre una
ventana de escritorio nativa. Al cerrar la ventana se detiene todo.

Estructura esperada junto al .exe:
    app/            API compilada, node_modules, prisma/ y public/ (frontend)
    runtime/node/   node.exe
    runtime/pgsql/  bin/, lib/, share/ de PostgreSQL
    config.env      usuario administrador y opciones
    datos/          se crea en el primer arranque (base de datos, respaldos, registros)
"""

from __future__ import annotations

import ctypes
import datetime as dt
import json
import os
import secrets
import socket
import subprocess
import sys
import threading
import time
import urllib.request
from pathlib import Path
from typing import Callable

import webview

APP_PORT = 4080
DB_PORT = 5544
DB_NAME = "gocafe"
DB_USER = "gocafe"
RESPALDOS_A_CONSERVAR = 30

BASE = Path(os.environ.get("GOCAFE_HOME") or Path(sys.executable if getattr(sys, "frozen", False) else __file__).resolve().parent)
APP = BASE / "app"
NODE = BASE / "runtime" / "node" / "node.exe"
PG_BIN = BASE / "runtime" / "pgsql" / "bin"
DATOS = BASE / "datos"
PGDATA = DATOS / "pgdata"
LOGS = DATOS / "registros"
RESPALDOS = DATOS / "respaldos"
SECRETOS = DATOS / "secretos.json"
CONFIG = BASE / "config.env"

NO_WINDOW = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0


def log(msg: str) -> None:
    LOGS.mkdir(parents=True, exist_ok=True)
    with open(LOGS / "gocafe.log", "a", encoding="utf-8") as f:
        f.write(f"{dt.datetime.now():%Y-%m-%d %H:%M:%S}  {msg}\n")


def leer_config() -> dict[str, str]:
    datos: dict[str, str] = {}
    if CONFIG.exists():
        for linea in CONFIG.read_text(encoding="utf-8").splitlines():
            linea = linea.strip()
            if linea and not linea.startswith("#") and "=" in linea:
                clave, valor = linea.split("=", 1)
                datos[clave.strip()] = valor.strip().strip('"')
    return datos


def leer_secretos() -> dict[str, str]:
    if SECRETOS.exists():
        return json.loads(SECRETOS.read_text(encoding="utf-8"))
    valores = {"jwt": secrets.token_hex(48), "db": secrets.token_hex(24)}
    DATOS.mkdir(parents=True, exist_ok=True)
    SECRETOS.write_text(json.dumps(valores), encoding="utf-8")
    return valores


def run(args: list[str], env: dict[str, str] | None = None, check: bool = True) -> subprocess.CompletedProcess:
    # Las herramientas de PostgreSQL escriben en la página de códigos de la consola (OEM).
    codificacion = "oem" if Path(args[0]).parent == PG_BIN else "utf-8"
    res = subprocess.run(args, env=env, capture_output=True, text=True, encoding=codificacion, errors="replace",
                         stdin=subprocess.DEVNULL, creationflags=NO_WINDOW)
    salida = (res.stdout + res.stderr).strip()
    log(f"$ {Path(args[0]).name} {' '.join(args[1:3])} -> {res.returncode}" + (f"\n{salida}" if salida else ""))
    if check and res.returncode != 0:
        raise RuntimeError(f"Falló {Path(args[0]).name}: {salida[-600:]}")
    return res


def puerto_ocupado(puerto: int) -> bool:
    with socket.socket() as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", puerto)) == 0


def api_lista() -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{APP_PORT}/health", timeout=0.7) as r:
            return r.status == 200
    except Exception:
        return False


_mutex = None


def tomar_instancia_unica() -> bool:
    """True si esta es la única ventana de GoCafe que administra la base y la API.

    Abrir el programa varias veces seguidas (mientras carga) iniciaba dos bases/APIs a la vez y, al cerrar,
    una de las API quedaba viva sin base de datos.
    """
    global _mutex
    if os.name != "nt":
        return True
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.CreateMutexW.restype = ctypes.c_void_p
    _mutex = kernel32.CreateMutexW(None, False, "Local\\GoCafeLanzador")
    return ctypes.get_last_error() != 183  # ERROR_ALREADY_EXISTS


def job_que_muere_con_el_lanzador():
    """Job de Windows: los procesos asignados se cierran solos si GoCafe.exe termina (aunque sea de golpe)."""
    if os.name != "nt":
        return None
    from ctypes import wintypes

    class Basica(ctypes.Structure):
        _fields_ = [("PerProcessUserTimeLimit", ctypes.c_int64), ("PerJobUserTimeLimit", ctypes.c_int64),
                    ("LimitFlags", wintypes.DWORD), ("MinimumWorkingSetSize", ctypes.c_size_t),
                    ("MaximumWorkingSetSize", ctypes.c_size_t), ("ActiveProcessLimit", wintypes.DWORD),
                    ("Affinity", ctypes.c_size_t), ("PriorityClass", wintypes.DWORD), ("SchedulingClass", wintypes.DWORD)]

    class Extendida(ctypes.Structure):
        _fields_ = [("BasicLimitInformation", Basica), ("IoInfo", ctypes.c_uint64 * 6),
                    ("ProcessMemoryLimit", ctypes.c_size_t), ("JobMemoryLimit", ctypes.c_size_t),
                    ("PeakProcessMemoryUsed", ctypes.c_size_t), ("PeakJobMemoryUsed", ctypes.c_size_t)]

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.CreateJobObjectW.restype = wintypes.HANDLE
    kernel32.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
    job = kernel32.CreateJobObjectW(None, None)
    if not job:
        return None
    info = Extendida()
    info.BasicLimitInformation.LimitFlags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    if not kernel32.SetInformationJobObject(job, 9, ctypes.byref(info), ctypes.sizeof(info)):  # ExtendedLimitInformation
        return None
    return job


def asignar_a_job(job, proceso: subprocess.Popen) -> None:
    if job is None:
        return
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.AssignProcessToJobObject.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
    if not kernel32.AssignProcessToJobObject(job, int(proceso._handle)):  # type: ignore[attr-defined]
        log(f"Aviso: no se pudo ligar la API al lanzador (error {ctypes.get_last_error()})")


class Servidor:
    def __init__(self) -> None:
        self.node: subprocess.Popen | None = None
        self.job = job_que_muere_con_el_lanzador()
        self.pg_iniciado = False
        self.secretos = leer_secretos()
        self.config = leer_config()
        self.pg_env = {**os.environ, "PGPASSWORD": self.secretos["db"]}

    @property
    def database_url(self) -> str:
        return f"postgresql://{DB_USER}:{self.secretos['db']}@127.0.0.1:{DB_PORT}/{DB_NAME}?schema=public"

    def node_env(self) -> dict[str, str]:
        acceso_red = self.config.get("ACCESO_RED", "no").lower() in ("si", "sí", "1", "true")
        return {
            **os.environ,
            "NODE_ENV": "production",
            "DATABASE_URL": self.database_url,
            "JWT_SECRET": self.secretos["jwt"],
            "PORT": str(APP_PORT),
            "HOST": "0.0.0.0" if acceso_red else "127.0.0.1",
            "STATIC_DIR": str(APP / "public"),
            "CORS_ORIGIN": f"http://127.0.0.1:{APP_PORT}",
            "SEED_USERNAME": self.config.get("USUARIO", ""),
            "SEED_PASSWORD": self.config.get("CONTRASENA", ""),
            "CHECKPOINT_DISABLE": "1",
            "PRISMA_HIDE_UPDATE_MESSAGE": "1",
        }

    def inicializar_base(self) -> None:
        log("Primer arranque: creando la base de datos")
        PGDATA.parent.mkdir(parents=True, exist_ok=True)
        pwfile = DATOS / "pw.tmp"
        pwfile.write_text(self.secretos["db"], encoding="utf-8")
        try:
            run([str(PG_BIN / "initdb.exe"), "-D", str(PGDATA), "-U", DB_USER, f"--pwfile={pwfile}",
                 "-A", "scram-sha-256", "-E", "UTF8", "--locale=C"])
        finally:
            pwfile.unlink(missing_ok=True)
        with open(PGDATA / "postgresql.conf", "a", encoding="utf-8") as f:
            f.write(f"\n# GoCafe\nport = {DB_PORT}\nlisten_addresses = '127.0.0.1'\n")

    def iniciar_postgres(self) -> None:
        if not (PGDATA / "PG_VERSION").exists():
            self.inicializar_base()
        estado = run([str(PG_BIN / "pg_ctl.exe"), "status", "-D", str(PGDATA)], check=False)
        if estado.returncode != 0:
            if puerto_ocupado(DB_PORT):
                raise RuntimeError(f"El puerto {DB_PORT} está ocupado por otro programa.")
            # Sin capturar la salida: el servidor hereda los descriptores y la lectura nunca terminaría.
            res = subprocess.run([str(PG_BIN / "pg_ctl.exe"), "start", "-D", str(PGDATA), "-w", "-t", "60",
                                  "-l", str(LOGS / "postgres.log")],
                                 stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                 creationflags=NO_WINDOW)
            log(f"$ pg_ctl.exe start -> {res.returncode}")
            if res.returncode != 0:
                raise RuntimeError("PostgreSQL no arrancó. Revise datos/registros/postgres.log.")
        self.pg_iniciado = True
        existe = run([str(PG_BIN / "psql.exe"), "-h", "127.0.0.1", "-p", str(DB_PORT), "-U", DB_USER, "-d", "postgres",
                      "-tAc", f"SELECT 1 FROM pg_database WHERE datname = '{DB_NAME}'"], env=self.pg_env)
        if existe.stdout.strip() != "1":
            run([str(PG_BIN / "createdb.exe"), "-h", "127.0.0.1", "-p", str(DB_PORT), "-U", DB_USER, DB_NAME], env=self.pg_env)

    def migrar(self) -> None:
        run([str(NODE), str(APP / "node_modules" / "prisma" / "build" / "index.js"), "migrate", "deploy",
             "--schema", str(APP / "prisma" / "schema.prisma")], env=self.node_env())

    def sembrar(self) -> None:
        run([str(NODE), str(APP / "seed.js")], env=self.node_env())

    def respaldar(self) -> None:
        RESPALDOS.mkdir(parents=True, exist_ok=True)
        destino = RESPALDOS / f"gocafe_{dt.date.today():%Y-%m-%d}.dump"
        if destino.exists():
            return
        run([str(PG_BIN / "pg_dump.exe"), "-h", "127.0.0.1", "-p", str(DB_PORT), "-U", DB_USER,
             "-Fc", "-f", str(destino), DB_NAME], env=self.pg_env, check=False)
        for viejo in sorted(RESPALDOS.glob("gocafe_*.dump"))[:-RESPALDOS_A_CONSERVAR]:
            viejo.unlink(missing_ok=True)

    def iniciar_api(self) -> None:
        if puerto_ocupado(APP_PORT):
            raise RuntimeError(f"El puerto {APP_PORT} está ocupado por otro programa "
                               "(puede ser una copia anterior de GoCafe que quedó abierta: reinicie la PC).")
        salida = open(LOGS / "api.log", "a", encoding="utf-8")
        self.node = subprocess.Popen([str(NODE), str(APP / "dist" / "index.js")], cwd=str(APP), env=self.node_env(),
                                     stdout=salida, stderr=subprocess.STDOUT, creationflags=NO_WINDOW)
        asignar_a_job(self.job, self.node)
        limite = time.monotonic() + 30
        while time.monotonic() < limite:
            if api_lista():
                return
            if self.node.poll() is not None:
                break
            time.sleep(0.25)
        raise RuntimeError("La API no respondió. Revise datos/registros/api.log.")

    def iniciar(self, avance: Callable[[int, int, str], None]) -> None:
        log("Iniciando GoCafe")
        avance(4, 12, "Preparando…")
        if not (PGDATA / "PG_VERSION").exists():
            avance(12, 38, "Creando la base de datos (solo la primera vez)…")
        else:
            avance(12, 38, "Abriendo la base de datos…")
        self.iniciar_postgres()
        avance(40, 62, "Actualizando la base de datos…")
        self.migrar()
        avance(64, 76, "Verificando usuario e inventario…")
        self.sembrar()
        avance(78, 86, "Guardando el respaldo del día…")
        self.respaldar()
        avance(88, 98, "Iniciando el sistema…")
        self.iniciar_api()
        avance(100, 100, "¡Listo!")
        log("GoCafe listo")

    def detener(self) -> None:
        if self.node and self.node.poll() is None:
            self.node.terminate()
            try:
                self.node.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.node.kill()
        if self.pg_iniciado:
            run([str(PG_BIN / "pg_ctl.exe"), "stop", "-D", str(PGDATA), "-m", "fast", "-w"], check=False)
        log("GoCafe detenido")


ESTILO = """
html,body{margin:0;height:100%;font-family:'Segoe UI',system-ui,sans-serif;color:#f5ede4;overflow:hidden;
  background:radial-gradient(ellipse at 75% 10%,#4a2c17 0%,transparent 55%),radial-gradient(ellipse at 15% 95%,#3a2212 0%,transparent 50%),linear-gradient(160deg,#2b1a10,#1c120c 50%,#0c0806)}
.c{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;padding:24px;box-sizing:border-box}
.logo{position:relative;width:150px;height:150px;border-radius:50%;padding:4px;background:linear-gradient(135deg,#fcd34d,#f59e0b 45%,#b45309);
  box-shadow:0 0 0 1px #ffffff14,0 18px 50px -10px #000c,0 0 70px -6px #f59e0b66;animation:latido 2.4s ease-in-out infinite}
.logo img{width:100%;height:100%;border-radius:50%;display:block;background:#111;border:3px solid #1c120c;box-sizing:border-box}
@keyframes latido{50%{box-shadow:0 0 0 1px #ffffff14,0 18px 50px -10px #000c,0 0 95px 4px #f59e0b88}}
.marca{margin:0;font-size:12px;font-weight:700;letter-spacing:.28em;text-transform:uppercase;color:#fcd34dbb}
h1{margin:-14px 0 0;font-size:30px;font-weight:700;letter-spacing:-.01em}
.caja{width:min(420px,82vw);margin-top:6px}
.fila{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;gap:12px}
#txt{font-size:14px;color:#d6c4b1;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#pct{font-size:22px;font-weight:700;color:#fbbf24;font-variant-numeric:tabular-nums;min-width:62px;text-align:right}
.barra{position:relative;height:12px;border-radius:999px;background:#ffffff14;box-shadow:inset 0 1px 3px #0008;overflow:hidden}
#fill{position:absolute;inset:0 auto 0 0;width:0;border-radius:999px;background:linear-gradient(90deg,#b45309,#f59e0b 55%,#fcd34d);box-shadow:0 0 16px #f59e0b99}
#fill::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,#ffffff66 50%,transparent 70%);background-size:200% 100%;animation:brillo 1.4s linear infinite}
@keyframes brillo{from{background-position:150% 0}to{background-position:-50% 0}}
.pie{font-size:12px;color:#a8927d}
.err h1{margin:0;font-size:24px} .err p{margin:0;color:#d6c4b1;max-width:560px;line-height:1.5} code{color:#fbbf24}
"""

SCRIPT_PROGRESO = """
let mostrado = 0, techo = 0;
function pintar() {
  const fill = document.getElementById('fill'), pct = document.getElementById('pct');
  if (!fill) return;
  // Avanza rápido hasta el paso actual y luego se acerca lento al techo del paso, sin alcanzarlo.
  const falta = techo - mostrado;
  if (falta > 0) mostrado += techo === 100 ? Math.max(falta * 0.15, 0.6) : Math.max(falta * (mostrado < techo - 8 ? 0.12 : 0.012), 0.02);
  if (mostrado > techo) mostrado = techo;
  fill.style.width = mostrado.toFixed(2) + '%';
  pct.textContent = Math.floor(mostrado) + '%';
  requestAnimationFrame(pintar);
}
window.avance = (desde, hasta, texto) => {
  if (desde > mostrado) mostrado = Math.max(mostrado, desde - 6);
  techo = Math.max(techo, hasta === 100 ? 100 : hasta - 0.5);
  if (desde === 100) mostrado = Math.max(mostrado, 92);
  document.getElementById('txt').textContent = texto;
};
requestAnimationFrame(pintar);
"""


def logo_data_uri() -> str:
    import base64
    ruta = APP / "public" / "images" / "cafelogo.jpg"
    try:
        return "data:image/png;base64," + base64.b64encode(ruta.read_bytes()).decode()
    except OSError:
        return ""


def documento(cuerpo: str, script: str = "") -> str:
    return (f'<!doctype html><html lang="es"><head><meta charset="utf-8"><style>{ESTILO}</style></head>'
            f'<body><div class="c">{cuerpo}</div><script>{script}</script></body></html>')


def pantalla_carga() -> str:
    return documento(
        f'<div class="logo"><img src="{logo_data_uri()}" alt=""></div>'
        '<p class="marca">Go Café</p><h1>Sistema de producción</h1>'
        '<div class="caja"><div class="fila"><span id="txt">Preparando…</span><span id="pct">0%</span></div>'
        '<div class="barra"><div id="fill"></div></div></div>'
        '<p class="pie">Esto toma unos segundos</p>',
        SCRIPT_PROGRESO,
    )


def pantalla_error(msg: str) -> str:
    from html import escape
    return documento(f'<div class="err"><h1>No se pudo iniciar Go Café</h1><p>{escape(msg)}</p>'
                     f'<p>Detalles en <code>{escape(str(LOGS))}</code></p></div>')


def main() -> None:
    webview.settings["ALLOW_DOWNLOADS"] = True
    # Solo la primera ventana administra la base y la API; las demás se conectan a ella.
    principal = tomar_instancia_unica()
    ya_abierto = not principal and api_lista()
    servidor = Servidor() if principal else None

    window = webview.create_window(
        "Go Café · Sistema de producción",
        url=f"http://127.0.0.1:{APP_PORT}/" if ya_abierto else None,
        html=None if ya_abierto else pantalla_carga(),
        width=1360, height=860, min_size=(420, 640),
        background_color="#1c120c",
    )

    def arrancar() -> None:
        if ya_abierto:
            return
        if servidor is None:
            # Otra ventana de GoCafe está iniciando el sistema: se espera a que termine en lugar de iniciarlo otra vez.
            try:
                window.evaluate_js("window.avance(10, 95, 'GoCafe se está abriendo en otra ventana…')")
            except Exception:  # noqa: BLE001  la pantalla de carga es solo informativa
                pass
            limite = time.monotonic() + 180
            while time.monotonic() < limite:
                if api_lista():
                    window.load_url(f"http://127.0.0.1:{APP_PORT}/")
                    return
                time.sleep(0.5)
            window.load_html(pantalla_error("GoCafe ya se está abriendo en otra ventana. Cierre todas las ventanas de GoCafe y ábralo de nuevo."))
            return
        def avance(desde: int, hasta: int, texto: str) -> None:
            try:
                window.evaluate_js(f"window.avance({desde}, {hasta}, {json.dumps(texto)})")
            except Exception:  # noqa: BLE001  la pantalla de carga es solo informativa
                pass

        try:
            inicio = time.monotonic()
            servidor.iniciar(avance)
            # Deja ver la barra completa antes de entrar.
            time.sleep(max(0.0, 1.6 - (time.monotonic() - inicio)) + 0.7)
            window.load_url(f"http://127.0.0.1:{APP_PORT}/")
        except Exception as e:  # noqa: BLE001
            log(f"ERROR: {e}")
            window.load_html(pantalla_error(str(e)))

    try:
        webview.start(arrancar, private_mode=True)
    finally:
        if servidor is not None:
            servidor.detener()


if __name__ == "__main__":
    main()
