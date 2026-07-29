// SQLite-backed invoice log. Each successfully submitted invoice is stored as a
// row in data/invoices.db. Server-side only. Public API (async) is unchanged so
// the API routes don't need to change.

import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type {
  LoggedInvoice,
  FbrInvoiceResponse,
  InvoiceType,
  InvoicePayload,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "invoices.db");

// Shape of a row as stored in SQLite (rawResponse kept as JSON text).
interface InvoiceRow {
  id: number;
  invoiceNumber: string;
  dated: string;
  invoiceType: string;
  buyerBusinessName: string;
  buyerNTNCNIC: string | null;
  total: number;
  scenarioId: string | null;
  env: string;
  submittedAt: string;
  rawResponse: string;
  payload: string | null;
}

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_FILE);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceNumber    TEXT NOT NULL,
      dated            TEXT,
      invoiceType      TEXT,
      buyerBusinessName TEXT,
      buyerNTNCNIC     TEXT,
      total            REAL,
      scenarioId       TEXT,
      env              TEXT,
      submittedAt      TEXT,
      rawResponse      TEXT,
      payload          TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_invoices_env ON invoices(env);
    CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoiceNumber);
  `);
  // Add the payload column to DBs created before it existed.
  const cols = db.prepare("PRAGMA table_info(invoices)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "payload")) {
    db.exec("ALTER TABLE invoices ADD COLUMN payload TEXT");
  }
  migrateFromJsonIfPresent(db);
  return db;
}

// One-time migration: if an old data/invoices.json exists and the table is
// empty, import its rows, then rename the file so it isn't imported again.
function migrateFromJsonIfPresent(database: Database.Database): void {
  const legacy = path.join(DATA_DIR, "invoices.json");
  if (!fs.existsSync(legacy)) return;

  const count = (database.prepare("SELECT COUNT(*) AS n FROM invoices").get() as { n: number }).n;
  if (count > 0) return;

  try {
    const parsed = JSON.parse(fs.readFileSync(legacy, "utf8"));
    if (Array.isArray(parsed)) {
      const insert = prepareInsert(database);
      const tx = database.transaction((rows: LoggedInvoice[]) => {
        for (const r of rows) insert.run(toParams(r));
      });
      tx(parsed as LoggedInvoice[]);
    }
    fs.renameSync(legacy, legacy + ".migrated");
  } catch {
    // If the legacy file is malformed, leave it untouched and continue.
  }
}

function prepareInsert(database: Database.Database) {
  return database.prepare(`
    INSERT INTO invoices
      (invoiceNumber, dated, invoiceType, buyerBusinessName, buyerNTNCNIC,
       total, scenarioId, env, submittedAt, rawResponse, payload)
    VALUES
      (@invoiceNumber, @dated, @invoiceType, @buyerBusinessName, @buyerNTNCNIC,
       @total, @scenarioId, @env, @submittedAt, @rawResponse, @payload)
  `);
}

function toParams(entry: LoggedInvoice) {
  return {
    invoiceNumber: entry.invoiceNumber,
    dated: entry.dated ?? "",
    invoiceType: entry.invoiceType,
    buyerBusinessName: entry.buyerBusinessName ?? "",
    buyerNTNCNIC: entry.buyerNTNCNIC ?? null,
    total: entry.total ?? 0,
    scenarioId: entry.scenarioId ?? null,
    env: entry.env,
    submittedAt: entry.submittedAt,
    rawResponse: JSON.stringify(entry.rawResponse ?? {}),
    payload: entry.payload ? JSON.stringify(entry.payload) : null,
  };
}

function rowToInvoice(row: InvoiceRow): LoggedInvoice {
  let rawResponse: FbrInvoiceResponse;
  try {
    rawResponse = JSON.parse(row.rawResponse) as FbrInvoiceResponse;
  } catch {
    rawResponse = { validationResponse: { statusCode: "", status: "" } };
  }
  let payload: InvoicePayload | undefined;
  if (row.payload) {
    try {
      payload = JSON.parse(row.payload) as InvoicePayload;
    } catch {
      payload = undefined;
    }
  }
  return {
    invoiceNumber: row.invoiceNumber,
    dated: row.dated,
    invoiceType: row.invoiceType as InvoiceType,
    buyerBusinessName: row.buyerBusinessName,
    buyerNTNCNIC: row.buyerNTNCNIC ?? undefined,
    total: row.total,
    scenarioId: row.scenarioId ?? undefined,
    env: row.env as "sandbox" | "production",
    submittedAt: row.submittedAt,
    rawResponse,
    payload,
  };
}

export async function readInvoices(): Promise<LoggedInvoice[]> {
  const rows = getDb()
    .prepare("SELECT * FROM invoices ORDER BY id DESC")
    .all() as InvoiceRow[];
  return rows.map(rowToInvoice);
}

export async function getInvoice(invoiceNumber: string): Promise<LoggedInvoice | null> {
  const row = getDb()
    .prepare("SELECT * FROM invoices WHERE invoiceNumber = ? ORDER BY id DESC LIMIT 1")
    .get(invoiceNumber) as InvoiceRow | undefined;
  return row ? rowToInvoice(row) : null;
}

export async function appendInvoice(entry: LoggedInvoice): Promise<void> {
  prepareInsert(getDb()).run(toParams(entry));
}
