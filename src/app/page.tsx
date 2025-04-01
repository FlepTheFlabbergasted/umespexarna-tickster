'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { collection, getDocs } from '@firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../lib/firebase.config';

import { LineChart } from '@/components/LineChart';

// const chartdata = [
//   {
//     date: 'Jan 23',
//     SolarPanels: 2890,
//     Inverters: 2338,
//   },
//   {
//     date: 'Feb 23',
//     SolarPanels: 2756,
//     Inverters: 2103,
//   },
//   {
//     date: 'Mar 23',
//     SolarPanels: 3322,
//     Inverters: 2194,
//   },
//   {
//     date: 'Apr 23',
//     SolarPanels: 3470,
//     Inverters: 2108,
//   },
//   {
//     date: 'May 23',
//     SolarPanels: 3475,
//     Inverters: 1812,
//   },
//   {
//     date: 'Jun 23',
//     SolarPanels: 3129,
//     Inverters: 1726,
//   },
//   {
//     date: 'Jul 23',
//     SolarPanels: 3490,
//     Inverters: 1982,
//   },
//   {
//     date: 'Aug 23',
//     SolarPanels: 2903,
//     Inverters: 2012,
//   },
//   {
//     date: 'Sep 23',
//     SolarPanels: 2643,
//     Inverters: 2342,
//   },
//   {
//     date: 'Oct 23',
//     SolarPanels: 2837,
//     Inverters: 2473,
//   },
//   {
//     date: 'Nov 23',
//     SolarPanels: 2954,
//     Inverters: 3848,
//   },
//   {
//     date: 'Dec 23',
//     SolarPanels: 3239,
//     Inverters: 3736,
//   },
// ];

export default function Home() {
  const [items, setItems] = useState([] as any[]);

  useEffect(() => {
    const fetchItems = async () => {
      const querySnapshot = await getDocs(collection(db, '2025'));
      const collectionData = querySnapshot.docs
        .map((doc) => doc.data())
        .sort((a: any, b) => (a.millis > b.millis ? 1 : -1));

      // console.log(
      //   collectionData.sort((data: any) =>
      //     DateTime.fromFormat(data.date, 'LLL dd') ? 1 : -1
      //   )
      // );
      setItems(collectionData);
    };

    fetchItems();
  }, []);

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-4 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="w-full lg:max-w-3/4  flex flex-col gap-[32px] row-start-2 items-center">
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
          xAxisLabel="Dag"
          yAxisLabel="Biljetter sålda"
          maxValue={400}
          onValueChange={(v) => console.log(v)}
        />
      </main>
    </div>
  );
}
