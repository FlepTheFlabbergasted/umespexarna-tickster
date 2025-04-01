'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { collection, getDocs } from '@firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../lib/firebase.config';

import { LineChart } from '@/components/LineChart';

const chartdata = [
  {
    date: 'Jan 23',
    SolarPanels: 2890,
    Inverters: 2338,
  },
  {
    date: 'Feb 23',
    SolarPanels: 2756,
    Inverters: 2103,
  },
  {
    date: 'Mar 23',
    SolarPanels: 3322,
    Inverters: 2194,
  },
  {
    date: 'Apr 23',
    SolarPanels: 3470,
    Inverters: 2108,
  },
  {
    date: 'May 23',
    SolarPanels: 3475,
    Inverters: 1812,
  },
  {
    date: 'Jun 23',
    SolarPanels: 3129,
    Inverters: 1726,
  },
  {
    date: 'Jul 23',
    SolarPanels: 3490,
    Inverters: 1982,
  },
  {
    date: 'Aug 23',
    SolarPanels: 2903,
    Inverters: 2012,
  },
  {
    date: 'Sep 23',
    SolarPanels: 2643,
    Inverters: 2342,
  },
  {
    date: 'Oct 23',
    SolarPanels: 2837,
    Inverters: 2473,
  },
  {
    date: 'Nov 23',
    SolarPanels: 2954,
    Inverters: 3848,
  },
  {
    date: 'Dec 23',
    SolarPanels: 3239,
    Inverters: 3736,
  },
];

export default function Home() {
  const [items, setItems] = useState([] as any[]);

  useEffect(() => {
    const fetchItems = async () => {
      const querySnapshot = await getDocs(collection(db, '2025'));
      const sdfds = querySnapshot.docs.flatMap((doc) => {
        return {
          ...Object.entries(doc.data()).flatMap(([key, val]) => ({
            date: `${key.split(' ')[1]} ${key.split(' ')[2]}`,
            ...val.showsAndTicketsSold.reduce(
              (acc: any, curr: any) => ({
                ...acc,
                [curr.name]: curr.ticketsSold,
              }),
              {}
            ),
          }))[0],
        };
      });

      console.log(sdfds);
      setItems(sdfds);
    };

    console.log(items);

    fetchItems();
  }, []);

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <div className="w-96 text-center p-4">
          <LineChart
            className="h-80"
            data={items}
            index="date"
            categories={[
              'Alcatraz - Fredag 19:00',
              'Alcatraz - Lördag 13:00',
              'Alcatraz - Lördag 18:00',
              'Alcatraz - Söndag 15:00',
              'Alcatraz - Torsdag 19:00',
            ]}
            onValueChange={(v) => console.log(v)}
          />
        </div>
      </main>
    </div>
  );
}
