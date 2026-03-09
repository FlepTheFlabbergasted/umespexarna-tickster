import { onRequest } from 'firebase-functions/https';
import { DateTime } from 'luxon';
import { PRODUCTION_COLLECTION_NAME } from '../const';

const MIGRATE_SHOW_ORDER = [
  'Torsdag 19:00',
  'Fredag 19:00',
  'Lördag 13:00',
  'Lördag 18:00',
  'Söndag 15:00',
];

const PRODUCTION = {
  name: 'Alcatraz',
  year: 2025,
  ticksterSalesApiUrl:
    'https://manager.tickster.com/Statistics/SalesTracker/Api.ashx?keys=CEFA5J,4CG8L2',
  startDate: '2025-02-28',
  endDate: '2025-04-13',
};

// http://127.0.0.1:5001/umespexarna-tickster/europe-west3/migrate2025Collection
export const migrate2025Collection = (db: FirebaseFirestore.Firestore) =>
  onRequest(async (_req, res) => {
    const oldSnapshot = await db.collection('2025').get();

    const productionRef = db.collection(PRODUCTION_COLLECTION_NAME).doc('2025');

    // Create production metadata
    await productionRef.set(PRODUCTION);

    const batch = db.batch();

    oldSnapshot.docs.forEach((doc) => {
      const data = doc.data();

      const showsAndSales = MIGRATE_SHOW_ORDER.map((label, index) => ({
        ordinal: index,
        label,
        ticketSales: data[label] ?? 0,
      }));

      const newDocRef = productionRef
        .collection('ticketSales')
        .doc(DateTime.fromMillis(data.millis).toISODate() as string);

      batch.set(newDocRef, {
        label: data.date,
        date: DateTime.fromMillis(data.millis).toISODate(),
        showsAndSales,
        totalSales: showsAndSales.reduce((sum, s) => sum + s.ticketSales, 0),
      });
    });

    await batch.commit();

    res.send('Done!');
    console.log(`Migrated ${oldSnapshot.size} documents`);
  });
