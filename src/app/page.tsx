'use client';

import { LineChart, TooltipProps } from '@/components/LineChart';
import { collection, getDocs, orderBy, query } from '@firebase/firestore';
import { useEffect, useState } from 'react';
import '../lib/array.prototypes';
import { db } from '../lib/firebase.config';
import { Production, TicketSaleDataPoint } from './types';

const NR_SHOWS = 5;
const MAX_NR_SEATS = 340;

const Tooltip = ({ payload, active, label }: TooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload
    .map((item) => ({
      category: item.category,
      value: item.value,
      percentage: ((item.value / MAX_NR_SEATS) * 100).toFixed(0),
      color: item.color,
    }))
    // BUG: When using CustomTooltip the data is duplicated
    // The fix from here does not work https://github.com/recharts/recharts/issues/1625
    .removeDuplicates((a, b) => a.category === b.category);

  const totalValue = data.reduce((tot, item) => tot + item.value, 0);
  const totalPercentage = (
    (totalValue / (MAX_NR_SEATS * NR_SHOWS)) *
    100
  ).toFixed(0);

  return (
    <>
      <div className="mb-1 w-60 rounded-md border px-4 py-1.5 text-sm shadow-md border-gray-200/30 bg-[#040712]">
        <p className="flex items-center justify-between">
          <span className="text-gray-50">Datum</span>
          <span className="font-medium text-gray-50">{label}</span>
        </p>
      </div>

      <div className="space-y-1 rounded-md border px-4 py-2 text-sm shadow-md border-gray-200/30 bg-[#040712]">
        {data.map((item, index) => (
          <div key={index} className="flex items-center space-x-2.5">
            <div className="flex w-full justify-between">
              <div className="flex items-center space-x-1">
                <span
                  className={`h-[3px] w-3.5 shrink-0 rounded-full bg-${item.color}-500 opacity-100`}
                  aria-hidden="true"
                ></span>
                <span className="text-gray-300">{item.category}</span>
              </div>

              <div className="flex items-center space-x-1">
                <span className="font-medium text-gray-50">{item.value}</span>
                <span className="text-gray-500">({item.percentage}&#37;)</span>
              </div>
            </div>
          </div>
        ))}

        <div className="mt-2 flex items-center space-x-2.5">
          <div className="flex w-full justify-between">
            <span className="text-gray-300">Totalt</span>

            <div className="flex items-center space-x-1">
              <span className="font-medium text-gray-50">{totalValue}</span>
              <span className="text-gray-500">({totalPercentage}&#37;)</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default function Home() {
  const [showRelativeMax, setRelativeMax] = useState(false);
  const [productions, setProductions] = useState<Production[]>([]);
  const [selectedProduction, setSelectedProduction] = useState<
    Production | undefined
  >(undefined);

  useEffect(() => {
    const fetchProductions = async () => {
      const productionsSnapshot = await getDocs(collection(db, 'productions'));

      const productions: Production[] = await Promise.all(
        productionsSnapshot.docs.map(async (doc) => {
          const prod: Production = {
            ...(doc.data() as Omit<Production, 'ticketSales'>),
            ticketSales: undefined,
          };

          // Fetch ticketSales for this production
          const ticketSalesSnapshot = await getDocs(
            query(
              collection(
                db,
                'productions',
                prod.year.toString(),
                'ticketSales'
              ),
              orderBy('date', 'asc')
            )
          );

          prod.ticketSales = ticketSalesSnapshot.docs.map(
            (doc) => doc.data() as TicketSaleDataPoint
          );

          return prod;
        })
      );

      // Sort productions by year descending
      productions.sort((a, b) => b.year - a.year);

      setProductions(productions);
      setSelectedProduction(productions[0]); // default to latest production
    };

    fetchProductions();
  }, []);

  if (!selectedProduction) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-lg">Loading...</div>
      </div>
    );
  }

  // Extract categories dynamically from selectedProduction.showsAndSales
  const categories =
    selectedProduction.ticketSales?.[0].showsAndSales?.map((s) => s.label) ||
    [];

  // Transform ticketSales into a format the chart can use
  const chartData = selectedProduction.ticketSales?.map((day) => {
    const row: Record<string, number | string> = { label: day.label };
    day.showsAndSales.forEach((show) => {
      row[show.label] = show.ticketSales;
    });

    return row;
  });

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-4 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="w-full lg:max-w-3/4 flex flex-col gap-[32px] row-start-2 items-center">
        <div className="relative">
          <select
            value={selectedProduction.year}
            onChange={(e) => {
              const year = e.target.value;
              const production = productions.find(
                (p) => p.year.toString() === year
              );

              if (production) {
                setSelectedProduction(production);
              }
            }}
            className="
            text-2xl
            text-center
            border
            rounded-md
            w-max
            bg-[#04030c]
            text-[#ededed]
            border-gray-200/30
            py-3
            px-6
            pr-12
            appearance-none
            cursor-pointer
            focus:outline-none
            relative
          "
          >
            {productions.map((p) => (
              <option key={p.year} value={p.year}>
                Umespexarna {p.year} - {p.name}
              </option>
            ))}
          </select>

          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-50 text-sm">
            ▼
          </span>
        </div>

        <LineChart
          data={chartData || []}
          index="label"
          categories={categories}
          xAxisLabel="Datum"
          yAxisLabel="Biljetter sålda"
          maxValue={showRelativeMax ? MAX_NR_SEATS : undefined}
          onValueChange={(v) => v}
          customTooltip={Tooltip}
        />

        <div className="w-full flex flex-row justify-center">
          <label>
            <input
              className="mr-2"
              type="checkbox"
              onChange={(e) => setRelativeMax(e.target.checked)}
            />
            Visa relativt max
          </label>
        </div>
      </main>
    </div>
  );
}
