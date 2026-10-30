# Go Café · Guía de desarrollo

Sistema de gestión de producción de Go Café: clientes y órdenes de procesamiento, producción propia (Gourmet y Blend), inventario, cobros y control de gastos.

## Estructura

```
backend/    API REST · Express, TypeScript, Prisma (PostgreSQL)
frontend/   Interfaz web · React, Vite, TypeScript, Tailwind CSS
docker-compose.yml   Base de datos PostgreSQL para desarrollo
```

### Backend (`backend/src`)

| Ruta | Contenido |
|---|---|
| `modules/auth` | Inicio de sesión y emisión de JWT (usuario administrador único) |
| `modules/clientes` | Clientes |
| `modules/ordenes` | Órdenes de procesamiento de café de clientes (folio `GC-0001`) |
| `modules/produccion` | Lotes de producción propia: Gourmet (`GG-0001`) y Blend (`GB-0001`) |
| `modules/inventario` | Existencias, Kardex, inventario de bolsas y gastos de compras |
| `middleware` | Autenticación, manejo de errores y controladores asíncronos |
| `utils` | Folios, estados de orden y cálculos de producción |

### Frontend (`frontend/src`)

| Ruta | Contenido |
|---|---|
| `pages` | Pantallas del sistema |
| `components` | Componentes compartidos (calendarios, formularios, diseño) |
| `store` | Estado y acceso a la API por módulo |
| `api` | Cliente HTTP y manejo de la sesión |
| `types` | Tipos y reglas de negocio compartidas |
| `utils` | Fechas, moneda, cálculos de producción y comprobantes PDF |

## Reglas de negocio relevantes

- El inventario solo se modifica al finalizar una orden o un lote, dentro de una transacción.
- El Kardex es de solo inserción: las correcciones se registran como movimientos nuevos.
- Los folios se derivan de una secuencia autoincremental de PostgreSQL.
- Una orden o un lote finalizado no puede eliminarse.

## Requisitos

- Node.js 20 o superior
- Docker Desktop (para PostgreSQL)

## Instalación

```bash
# Base de datos
cp .env.example .env
docker compose up -d

# Backend
cd backend
cp .env.example .env        # definir JWT_SECRET, SEED_USERNAME y SEED_PASSWORD
npm install
npx prisma migrate deploy
npm run seed
npm run dev                 # http://localhost:4000

# Frontend
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Si el puerto 5432 está ocupado por otra instancia de PostgreSQL, cambie `POSTGRES_PORT` en `.env` y el puerto de `DATABASE_URL` en `backend/.env`.

## Versión de escritorio (.exe)

`desktop/` contiene el lanzador de Windows: una ventana nativa (pywebview) que inicia una base PostgreSQL portátil, aplica las migraciones, ejecuta el seed y levanta la API, que también sirve el frontend compilado. Al cerrar la ventana se detiene todo.

```bash
python desktop/build.py                      # genera C:\ProgramasJorge\cafeLocal\GoCafe
python desktop/build.py D:\otra\carpeta      # destino alternativo
```

Requiere en la PC de compilación Node.js, Python 3 y PostgreSQL 16 instalado (de él se copian `bin`, `lib` y `share`; otra ruta con `PG_HOME`).

| Ruta en el paquete | Contenido |
|---|---|
| `GoCafe.exe` | Lanzador |
| `config.env` | Usuario administrador (`USUARIO`, `CONTRASENA`) y `ACCESO_RED=si` para entrar desde celulares en la misma red |
| `datos/` | Base de datos, respaldo diario (`respaldos/`, se conservan 30) y registros (`registros/`); se crea en el primer arranque |

Puertos: interfaz `http://127.0.0.1:4080`, PostgreSQL `5544` (solo local). Para instalar en otra PC se copia la carpeta `GoCafe` **sin** `datos/` y se crea un acceso directo a `GoCafe.exe` en el escritorio (el .exe no puede moverse fuera de su carpeta).

## Comandos del backend

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga automática |
| `npm run build` / `npm start` | Compilación a `dist/` y ejecución |
| `npm run seed` | Crea o actualiza el usuario administrador y las existencias iniciales |
| `npx prisma migrate dev --name <nombre>` | Genera una migración tras modificar `schema.prisma` |
| `npx prisma studio` | Explorador de la base de datos |
| `npm test` | Pruebas de integración (Vitest + Supertest) |
| `npm run test:typecheck` | Verificación de tipos de `src/` y `test/` |

## Pruebas

Las pruebas se ejecutan contra una base de datos independiente (`gocafe_test`), nunca contra la de desarrollo. Configuración inicial:

```bash
cd backend
cp .env.test.example .env.test
docker exec gocafe-db-1 psql -U gocafe -d postgres -c "CREATE DATABASE gocafe_test OWNER gocafe;"
DATABASE_URL="postgresql://gocafe:gocafe@localhost:5432/gocafe_test?schema=public" npx prisma migrate deploy
```

Cada prueba vacía la base de datos antes de ejecutarse. Cuando cambie el esquema, vuelva a aplicar `prisma migrate deploy` sobre `gocafe_test`.
