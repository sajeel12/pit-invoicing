// Sandbox scenario list (SN001–SN028) from PRAL DI API spec v1.12, Section 9.
// scenarioId is required for sandbox submissions; which ones apply depends on
// your Business Activity + Sector (spec Section 10).

export interface Scenario {
  id: string;
  description: string;
  saleType: string;
}

export const SCENARIOS: Scenario[] = [
  { id: "SN001", description: "Goods at standard rate to registered buyers", saleType: "Goods at Standard Rate (default)" },
  { id: "SN002", description: "Goods at standard rate to unregistered buyers", saleType: "Goods at Standard Rate (default)" },
  { id: "SN003", description: "Sale of Steel (Melted and Re-Rolled)", saleType: "Steel Melting and re-rolling" },
  { id: "SN004", description: "Sale by Ship Breakers", saleType: "Ship breaking" },
  { id: "SN005", description: "Reduced rate sale", saleType: "Goods at Reduced Rate" },
  { id: "SN006", description: "Exempt goods sale", saleType: "Exempt Goods" },
  { id: "SN007", description: "Zero rated sale", saleType: "Goods at zero-rate" },
  { id: "SN008", description: "Sale of 3rd schedule goods", saleType: "3rd Schedule Goods" },
  { id: "SN009", description: "Cotton Spinners purchase from Cotton Ginners (Textile Sector)", saleType: "Cotton Ginners" },
  { id: "SN010", description: "Telecom services rendered or provided", saleType: "Telecommunication services" },
  { id: "SN011", description: "Toll Manufacturing sale by Steel sector", saleType: "Toll Manufacturing" },
  { id: "SN012", description: "Sale of Petroleum products", saleType: "Petroleum Products" },
  { id: "SN013", description: "Electricity Supply to Retailers", saleType: "Electricity Supply to Retailers" },
  { id: "SN014", description: "Sale of Gas to CNG stations", saleType: "Gas to CNG stations" },
  { id: "SN015", description: "Sale of mobile phones", saleType: "Mobile Phones" },
  { id: "SN016", description: "Processing / Conversion of Goods", saleType: "Processing/ Conversion of Goods" },
  { id: "SN017", description: "Sale of Goods where FED is charged in ST mode", saleType: "Goods (FED in ST Mode)" },
  { id: "SN018", description: "Services rendered or provided where FED is charged in ST mode", saleType: "Services (FED in ST Mode)" },
  { id: "SN019", description: "Services rendered or provided", saleType: "Services" },
  { id: "SN020", description: "Sale of Electric Vehicles", saleType: "Electric Vehicle" },
  { id: "SN021", description: "Sale of Cement /Concrete Block", saleType: "Cement /Concrete Block" },
  { id: "SN022", description: "Sale of Potassium Chlorate", saleType: "Potassium Chlorate" },
  { id: "SN023", description: "Sale of CNG", saleType: "CNG Sales" },
  { id: "SN024", description: "Goods sold that are listed in SRO 297(1)/2023", saleType: "Goods as per SRO.297(|)/2023" },
  { id: "SN025", description: "Drugs sold at fixed ST rate under serial 81 of Eighth Schedule Table 1", saleType: "Non-Adjustable Supplies" },
  { id: "SN026", description: "Sale to End Consumer by retailers (standard rate)", saleType: "Goods at Standard Rate (default)" },
  { id: "SN027", description: "Sale to End Consumer by retailers (3rd schedule)", saleType: "3rd Schedule Goods" },
  { id: "SN028", description: "Sale to End Consumer by retailers (reduced rate)", saleType: "Goods at Reduced Rate" },
];
