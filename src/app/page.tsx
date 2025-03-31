'use client';

import { collection, getDocs } from '@firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../lib/firebase.config';

export default function Home() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState([] as any[]);

  useEffect(() => {
    const fetchItems = async () => {
      const querySnapshot = await getDocs(collection(db, '2025'));
      setItems(
        querySnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }))
      );
    };

    fetchItems();
  }, []);

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <div className="border w-96 text-center p-4">
          <h2>List of Items</h2>
          <ul>
            {items.map((item) => (
              <li key={item.id}>{item.id}</li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
