'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { LineChart, TooltipProps } from '@/components/LineChart';
import { collection, getDocs } from '@firebase/firestore';
import { useEffect, useState } from 'react';
import '../lib/array.prototypes';
import { db } from '../lib/firebase.config';

const NR_SHOWS = 5;
const MAX_VALUE = 340;

const Tooltip = ({ payload, active, label }: TooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload
    .map((item) => ({
      category: item.category,
      value: item.value,
      percentage: ((item.value / MAX_VALUE) * 100).toFixed(0),
      color: item.color,
    }))
    // BUG: When using CustomTooltip the data is duplicated
    // The fix from here does not work https://github.com/recharts/recharts/issues/1625
    .removeDuplicates((a, b) => a.category === b.category);

  const totalValue = data.reduce((tot, item) => tot + item.value, 0);
  const totalPercentage = ((totalValue / (MAX_VALUE * NR_SHOWS)) * 100).toFixed(
    0
  );

  return (
    <>
      <div className="mb-1 w-60 rounded-md border border-gray-500/10 bg-blue-500 px-4 py-1.5 text-sm shadow-md dark:border-gray-200/30 dark:bg-[#040712]">
        <p className="flex items-center justify-between">
          <span className="text-gray-50 dark:text-gray-50">Datum</span>
          <span className="font-medium text-gray-50 dark:text-gray-50">
            {label}
          </span>
        </p>
      </div>

      <div className="space-y-1 rounded-md border border-gray-500/10 bg-white px-4 py-2 text-sm shadow-md dark:border-gray-200/30 dark:bg-[#040712]">
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
                <span className="font-medium text-gray-900 dark:text-gray-50">
                  {item.value}
                </span>
                <span className="text-gray-500 dark:text-gray-500">
                  ({item.percentage}&#37;)
                </span>
              </div>
            </div>
          </div>
        ))}

        <div className="mt-2 flex items-center space-x-2.5">
          <div className="flex w-full justify-between">
            <span className="text-gray-300">Totalt</span>

            <div className="flex items-center space-x-1">
              <span className="font-medium text-gray-900 dark:text-gray-50">
                {totalValue}
              </span>
              <span className="text-gray-500 dark:text-gray-500">
                ({totalPercentage}&#37;)
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// [
//   {
//       "date": "Mar 23",
//       "millis": 1742731268000,
//       "Lördag 13:00": 13,
//       "Lördag 18:00": 77,
//       "Fredag 19:00": 50,
//       "Torsdag 19:00": 77,
//       "Söndag 15:00": 8
//   },
//   {
//       "date": "Mar 24",
//       "millis": 1742817667000,
//       "Lördag 18:00": 87,
//       "Fredag 19:00": 50,
//       "Lördag 13:00": 18,
//       "Torsdag 19:00": 80,
//       "Söndag 15:00": 8
//   },
// ]

export default function Home() {
  const [items, setItems] = useState([] as any[]);

  useEffect(() => {
    const fetchItems = async () => {
      const querySnapshot = await getDocs(collection(db, '2025'));
      const collectionData = querySnapshot.docs
        .map((doc) => doc.data())
        .sort((a: any, b) => (a.millis > b.millis ? 1 : -1));

      setItems(collectionData);
    };

    fetchItems();
  }, []);

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-4 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="w-full lg:max-w-3/4  flex flex-col gap-[32px] row-start-2 items-center">
        <h1 className="text-2xl text-center">Umespexarna 2025 - Alcatraz</h1>
        <LineChart
          data={items}
          index="date"
          categories={[
            'Torsdag 19:00',
            'Fredag 19:00',
            'Lördag 13:00',
            'Lördag 18:00',
            'Söndag 15:00',
          ]}
          xAxisLabel="Datum"
          yAxisLabel="Biljetter sålda"
          maxValue={MAX_VALUE}
          onValueChange={(v) => v}
          customTooltip={Tooltip}
        />
      </main>
    </div>
  );
}
