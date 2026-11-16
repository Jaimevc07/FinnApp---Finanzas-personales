-- Esquema de la base de datos de Finanzas del Hogar (SQLite)

CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ingresos (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT    NOT NULL,
  valor  REAL    NOT NULL DEFAULT 0,
  orden  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gastos_fijos (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT    NOT NULL,
  valor  REAL    NOT NULL DEFAULT 0,
  orden  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS deudas (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre  TEXT    NOT NULL,
  moneda  TEXT    NOT NULL DEFAULT 'COP' CHECK (moneda IN ('COP','USD')),
  saldo   REAL    NOT NULL DEFAULT 0,
  interes REAL    NOT NULL DEFAULT 0,      -- tasa mensual en %
  orden   INTEGER NOT NULL DEFAULT 0       -- prioridad de pago
);

CREATE TABLE IF NOT EXISTS gastos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha       TEXT NOT NULL,               -- AAAA-MM-DD
  descripcion TEXT NOT NULL,
  categoria   TEXT NOT NULL,
  medio       TEXT NOT NULL,
  valor       REAL NOT NULL DEFAULT 0,
  creado      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha);

CREATE TABLE IF NOT EXISTS pasos (
  clave TEXT PRIMARY KEY,
  hecho INTEGER NOT NULL DEFAULT 0
);
