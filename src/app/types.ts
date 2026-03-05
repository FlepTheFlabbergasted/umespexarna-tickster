export interface ShowsAndSalePoint {
  ordinal: number; // 0
  label: string; // Torsdag 19:00
  ticketSales: number; // 999
}

export interface TicketSaleDataPoint {
  label: string; // Apr 04
  date: string; // 2025-04-04
  totalSales: number; // 999

  showsAndSales: ShowsAndSalePoint[];
}

export interface Production {
  name: string; // Alcatraz
  year: number; // 2025
  ticksterSalesApiUrl: string; // https://manager.tickster.com...
  startDate: Date; // Fri Feb 28 2025 00:00:00 GMT+0100 (Central European Standard Time)
  endDate: Date; // Fri Feb 28 2025 00:00:00 GMT+0100 (Central European Standard Time)

  // In own collection
  ticketSales: TicketSaleDataPoint[] | undefined; // [...]
}
