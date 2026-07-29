// Field names match the PRAL "Technical Specification for DI API" v1.12 exactly.
// Do not rename — FBR validates against these literal keys.

export type InvoiceType = "Sale Invoice" | "Debit Note";
export type RegistrationType = "Registered" | "Unregistered";

export interface InvoiceItem {
  hsCode: string;
  productDescription: string;
  rate: string; // e.g. "18%"
  uoM: string;
  quantity: number;
  totalValues: number; // total sales value including tax
  valueSalesExcludingST: number;
  fixedNotifiedValueOrRetailPrice: number;
  salesTaxApplicable: number;
  salesTaxWithheldAtSource: number;
  saleType: string;
  // optional fields
  extraTax?: number;
  furtherTax?: number;
  sroScheduleNo?: string;
  fedPayable?: number;
  discount?: number;
  sroItemSerialNo?: string;
}

export interface InvoicePayload {
  invoiceType: InvoiceType;
  invoiceDate: string; // yyyy-mm-dd
  sellerNTNCNIC: string;
  sellerBusinessName: string;
  sellerProvince: string;
  sellerAddress: string;
  buyerNTNCNIC?: string; // optional only when buyer is Unregistered
  buyerBusinessName: string;
  buyerProvince: string;
  buyerAddress: string;
  buyerRegistrationType: RegistrationType;
  invoiceRefNo?: string; // required only for Debit Note
  scenarioId?: string; // sandbox only
  items: InvoiceItem[];
}

// FBR response shapes (validate + post share the same structure).
export interface InvoiceStatus {
  itemSNo: string;
  statusCode: string; // "00" valid, "01" invalid
  status: string;
  invoiceNo?: string | null;
  errorCode?: string | null;
  error?: string;
}

export interface ValidationResponse {
  statusCode: string; // "00" valid, "01" invalid
  status: string;
  errorCode?: string | null;
  error?: string;
  invoiceStatuses?: InvoiceStatus[] | null;
}

export interface FbrInvoiceResponse {
  invoiceNumber?: string;
  dated?: string;
  validationResponse: ValidationResponse;
}

// One row in our local invoice log.
export interface LoggedInvoice {
  invoiceNumber: string;
  dated: string;
  invoiceType: InvoiceType;
  buyerBusinessName: string;
  buyerNTNCNIC?: string;
  total: number;
  scenarioId?: string;
  env: "sandbox" | "production";
  submittedAt: string; // ISO timestamp from our server
  rawResponse: FbrInvoiceResponse;
  // The full normalised invoice we sent — needed to render a printable invoice
  // (seller, buyer, all line items). Optional for rows logged before this field.
  payload?: InvoicePayload;
}
