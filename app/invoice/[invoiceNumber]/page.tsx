import PrintableInvoice from "./PrintableInvoice";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ invoiceNumber: string }>;
}) {
  const { invoiceNumber } = await params;
  return <PrintableInvoice invoiceNumber={decodeURIComponent(invoiceNumber)} />;
}
