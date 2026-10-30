"""Construye el paquete de escritorio de GoCafe.

Uso:  python desktop/build.py [carpeta_destino]      (por defecto C:\\ProgramasJorge\\cafeLocal)

Resultado en <destino>/GoCafe:
    GoCafe.exe, _internal/       lanzador (PyInstaller + pywebview)
    app/                         API compilada + node_modules de producción + frontend en public/
    runtime/node, runtime/pgsql  Node.js y PostgreSQL portátiles
    config.env                   usuario administrador y opciones (no se sobrescribe)
La carpeta datos/ (base de datos y respaldos) nunca se modifica.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
BACKEND = REPO / "backend"
FRONTEND = REPO / "frontend"
DESKTOP = REPO / "desktop"
DESTINO = Path(sys.argv[1] if len(sys.argv) > 1 else r"C:\ProgramasJorge\cafeLocal")
BUILD = DESTINO / "_build"
PAQUETE = DESTINO / "GoCafe"
PG_ORIGEN = Path(os.environ.get("PG_HOME", r"C:\Program Files\PostgreSQL\16"))
VC_RUNTIME = ("vcruntime140.dll", "vcruntime140_1.dll", "msvcp140.dll", "msvcp140_1.dll", "msvcp140_2.dll", "concrt140.dll")
NODE_ORIGEN = Path(shutil.which("node") or r"C:\Program Files\nodejs\node.exe")


def sh(cmd: list[str] | str, cwd: Path | None = None, env: dict | None = None) -> None:
    print(f"\n>>> {cmd if isinstance(cmd, str) else ' '.join(cmd)}", flush=True)
    subprocess.run(cmd, cwd=cwd, env=env, check=True, shell=isinstance(cmd, str))


def reemplazar_dir(origen: Path, destino: Path, ignore=None) -> None:
    if destino.exists():
        shutil.rmtree(destino)
    shutil.copytree(origen, destino, ignore=ignore)


def leer_env(path: Path) -> dict[str, str]:
    datos = {}
    if path.exists():
        for linea in path.read_text(encoding="utf-8").splitlines():
            if "=" in linea and not linea.lstrip().startswith("#"):
                k, v = linea.split("=", 1)
                datos[k.strip()] = v.strip().strip('"')
    return datos


def construir_frontend() -> None:
    env = {**os.environ}
    env.pop("VITE_API_URL", None)
    sh("npm run build", cwd=FRONTEND, env=env)


def construir_backend(app: Path) -> None:
    sh("npm run build", cwd=BACKEND)
    sh("npx esbuild prisma/seed.ts --bundle --platform=node --target=node20 "
       f"--external:@prisma/client --external:bcryptjs --outfile=\"{app / 'seed.js'}\"", cwd=BACKEND)
    reemplazar_dir(BACKEND / "dist", app / "dist")
    (app / "prisma").mkdir(parents=True, exist_ok=True)
    shutil.copy2(BACKEND / "prisma" / "schema.prisma", app / "prisma" / "schema.prisma")
    reemplazar_dir(BACKEND / "prisma" / "migrations", app / "prisma" / "migrations")

    pkg = json.loads((BACKEND / "package.json").read_text(encoding="utf-8"))
    dev = pkg.get("devDependencies", {})
    produccion = {
        "name": pkg["name"],
        "version": pkg["version"],
        "private": True,
        "type": pkg.get("type", "commonjs"),
        "scripts": {"postinstall": "prisma generate"},
        "dependencies": {**pkg["dependencies"], "prisma": dev["prisma"]},
    }
    (app / "package.json").write_text(json.dumps(produccion, indent=2), encoding="utf-8")
    shutil.copy2(BACKEND / "package-lock.json", app / "package-lock.json")
    sh("npm install --omit=dev --no-audit --no-fund", cwd=app)
    for tmp in (app / "node_modules" / ".prisma" / "client").glob("*.tmp*"):
        tmp.unlink(missing_ok=True)


def copiar_runtime() -> None:
    node_dir = PAQUETE / "runtime" / "node"
    node_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(NODE_ORIGEN, node_dir / "node.exe")
    pg = PAQUETE / "runtime" / "pgsql"
    for sub in ("bin", "lib", "share"):
        reemplazar_dir(PG_ORIGEN / sub, pg / sub, ignore=shutil.ignore_patterns("*.pdb", "pgAdmin*", "stackbuilder*"))
    # PostgreSQL depende del runtime de Visual C++; se incluye para PCs que no lo tengan instalado.
    system32 = Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32"
    for dll in VC_RUNTIME:
        if (system32 / dll).exists():
            shutil.copy2(system32 / dll, pg / "bin" / dll)


def construir_lanzador() -> None:
    venv = BUILD / "venv"
    py = venv / "Scripts" / "python.exe"
    if not py.exists():
        sh([sys.executable, "-m", "venv", str(venv)])
        sh([str(py), "-m", "pip", "install", "--upgrade", "pip"])
    sh([str(py), "-m", "pip", "install", "pyinstaller", "pywebview"])
    sh([str(py), "-m", "PyInstaller", "--noconfirm", "--clean", "--windowed", "--name", "GoCafe",
        "--icon", str(DESKTOP / "gocafe.ico"),
        "--distpath", str(BUILD / "dist"), "--workpath", str(BUILD / "work"), "--specpath", str(BUILD),
        str(DESKTOP / "launcher.py")])
    salida = BUILD / "dist" / "GoCafe"
    shutil.copy2(salida / "GoCafe.exe", PAQUETE / "GoCafe.exe")
    reemplazar_dir(salida / "_internal", PAQUETE / "_internal")


def escribir_extras() -> None:
    config = PAQUETE / "config.env"
    if not config.exists():
        semilla = leer_env(BACKEND / ".env")
        config.write_text(
            "# Configuración de Go Café. Se lee cada vez que se abre el programa.\n"
            "# Usuario administrador: si cambia la contraseña aquí, se actualiza al abrir el programa.\n"
            f"USUARIO={semilla.get('SEED_USERNAME', '')}\n"
            f"CONTRASENA={semilla.get('SEED_PASSWORD', '')}\n"
            "\n# si = permite entrar desde celulares y tablets conectados al mismo Wi-Fi.\n"
            "ACCESO_RED=no\n",
            encoding="utf-8",
        )


def main() -> None:
    PAQUETE.mkdir(parents=True, exist_ok=True)
    app = PAQUETE / "app"
    app.mkdir(exist_ok=True)
    construir_frontend()
    construir_backend(app)
    reemplazar_dir(FRONTEND / "dist", app / "public")
    copiar_runtime()
    construir_lanzador()
    escribir_extras()
    print(f"\nListo: {PAQUETE / 'GoCafe.exe'}")


if __name__ == "__main__":
    main()
