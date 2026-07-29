import AppHeader from "./components/AppHeader";
import InvoiceForm from "./components/InvoiceForm";

export default function Home() {
  return (
    <>
      <AppHeader active="new" />
      <main className="container">
        <InvoiceForm />
      </main>
    </>
  );
}
