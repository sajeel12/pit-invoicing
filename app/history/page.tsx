import AppHeader from "../components/AppHeader";
import HistoryTable from "./HistoryTable";

export default function HistoryPage() {
  return (
    <>
      <AppHeader active="history" />
      <main className="container">
        <HistoryTable />
      </main>
    </>
  );
}
