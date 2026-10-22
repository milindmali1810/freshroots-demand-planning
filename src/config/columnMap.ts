// PROPOSED CSV → database mapping. Pending user approval (checkpoint A2.3).
// Files live in DATA_DIR. Column names are exactly as they appear in the CSV headers.

export const columnMap = {
  sku_master: {
    file: "sku_master.csv",
    table: "Sku",
    columns: {
      SKU_ID: "code",
      SKU_Name: "name",
      Category: "category",
      Perishability: "isPerishable", // "High" → true, "Low" → false
      Standard_Reorder_Qty: "standardReorderQty", // reference only; engine still uses Q_std = 4 × AVG12
      Unit_of_Measure: "unitOfMeasure",
      Distributor_ID: "primaryDistributorCode", // the SKU's supplying/primary distributor
    },
    notInFile: ["unitPrice", "casePack", "leadTimeWeeks"], // left null; casePack treated as 1
  },
  distributor_master: {
    file: "distributor_master.csv",
    table: "Distributor",
    columns: { Distributor_ID: "code", Distributor_Name: "name", Region: "region", Status: "status" },
    notInFile: ["tier"],
  },
  weekly_sales: {
    file: "weekly_sales.csv",
    table: "WeeklySale",
    columns: {
      SKU_ID: "sku",
      Week: "weekStart", // "2026-W42" (ISO week) → Monday date of that week
      Units_Sold: "units",
    },
    notInFile: ["distributor"], // sales are per SKU only, so E2 and the top-10 distributor check cannot run
  },
  current_inventory: {
    file: "current_inventory.csv",
    table: "InventorySnapshot",
    columns: { SKU_ID: "sku", Location: "location", Units_On_Hand: "onHand", As_Of_Date: "asOfDate" },
    notInFile: ["onOrder"], // treated as 0 and labelled "on-order unavailable"
  },
  calendar: {
    file: "calendar.csv",
    table: "Festival",
    columns: {
      Year_Month: "startDate/endDate", // first and last day of that month
      Is_Festival_Month: "(only TRUE rows become Festival windows)",
    },
    notInFile: ["name", "exact festival dates"], // F = 1.25 if the next 4 weeks overlap a festival month
  },
} as const;
