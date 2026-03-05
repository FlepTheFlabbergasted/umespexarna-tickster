/**
 * Followed tutorials from:
 * - https://firebase.google.com/docs/functions/get-started?gen=2nd
 * - https://firebase.google.com/docs/firestore/quickstart#web
 * - https://firebase.google.com/docs/functions/typescript
 * - https://firebase.google.com/docs/firestore/query-data/get-data#node.js
 * - https://firebase.google.com/docs/functions/schedule-functions?gen=2nd
 *
 * - https://firebase.google.com/codelabs/firebase-nextjs#0
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger, setGlobalOptions } from 'firebase-functions';
import { onRequest } from 'firebase-functions/https';
import { onSchedule } from 'firebase-functions/scheduler';
import https from 'https'; // Node.js
import { DateTime } from 'luxon';

initializeApp();
setGlobalOptions({ region: 'europe-west3' });

const db = getFirestore();

//==========================================================//
//==========================================================//
//==========================================================//

const PRODUCTION_COLLECTION_NAME = 'productions';
const COLLECTION_MAP = {
  2025: {
    name: 'Alcatraz',
    year: 2025,
    ticksterSalesApiUrl:
      'https://manager.tickster.com/Statistics/SalesTracker/Api.ashx?keys=CEFA5J,4CG8L2',
    // GMT+0100 (Central European Time, Standard Time, winter)
    // GMT+0200 (Central European Summer Time)
    startDate: new Date('2025-02-28T00:00:00+01:00'), // Biljetsläpp
    endDate: new Date('2025-04-13T23:59:59+02:00'),
    ticketSales: [],
  },
  // 2026: {
  //   name: 'Picasso',
  //   year: 2026,
  //   ticksterSalesApiUrl:
  //     'https://manager.tickster.com/Statistics/SalesTracker/Api.ashx?keys=',
  //   startDate: new Date('2026-03-01T00:00:00+01:00'), // Biljetsläpp
  //   endDate: new Date('2026-04-26T23:59:59+02:00'),
  //   ticketSales: [],
  // },
};

//==========================================================//
//==========================================================//
//==========================================================//

export interface TicketSaleDataPoint {
  // 'Torsdag 19:00': number,
  // 'Fredag 19:00': number,
  // 'Lördag 13:00': number,
  // 'Lördag 18:00': number,
  // 'Söndag 15:00': number,
  showsAndSales: [{ ordinal: number; label: string; ticketSales: number }];
  date: string; // Apr 04
  millis: number; // 213313442
}

export interface Production {
  name: string; // Alcatraz
  year: number; // 2025
  ticksterSalesApiUrl: string; // https://manager.tickster.com...
  startDate: Date; // Fri Feb 28 2025 00:00:00 GMT+0100 (Central European Standard Time)
  endDate: Date; // Fri Feb 28 2025 00:00:00 GMT+0100 (Central European Standard Time)
  ticketSales: TicketSaleDataPoint[]; // [...]
}

//==========================================================//
//                       Get Sales                          //
//==========================================================//
exports.getSales = onRequest(async (req, res) => {
  const collectionName = req.query.year?.toString();

  if (!collectionName) {
    // No collection name provided (year)
    res
      .status(400)
      .json({ error: 'Missing or invalid "year" query parameter.' });
    return;
  }

  let collectionRef;

  try {
    collectionRef = db.collection(collectionName);
    const snapshot = await collectionRef.limit(1).get();

    if (snapshot.empty) {
      // Collection does not exist (or is empty)
      res.status(404).json({ error: 'Collection not found or empty.' });
      return;
    }
  } catch (error) {
    res.status(500).json({ error: 'An unexpected error occurred.' });
    return;
  }

  const snapshot = await collectionRef.get();
  const collectionData = snapshot.docs.map((doc) => doc.data());

  res.send(collectionData);
});

// Manually run the task here https://console.cloud.google.com/cloudscheduler
//==========================================================//
//              Add Show and Tickets Sold Row               //
//==========================================================//
exports.addShowAndTicketsSoldRow = onSchedule(
  {
    schedule: 'every hour from 08:00 to 00:00',
    timeZone: 'Europe/Stockholm',
  },
  async () => {
    const now = new Date();

    // Only run if within the date range
    if (
      !(
        now >= COLLECTION_MAP[2025].startDate &&
        now <= COLLECTION_MAP[2025].endDate
      )
    ) {
      logger.info(
        'Skipping function execution. Out of valid date range.',
        COLLECTION_MAP[2025].startDate,
        COLLECTION_MAP[2025].endDate
      );
      return;
    }

    https
      .get(
        COLLECTION_MAP[2025].ticksterSalesApiUrl,
        async (incomingHttpMsg) => {
          const { statusCode } = incomingHttpMsg;
          const contentType = incomingHttpMsg.headers['content-type'];

          let error;
          // Any 2xx status code signals a successful response but
          // here we're only checking for 200.
          if (statusCode !== 200) {
            error = new Error(
              'Request Failed.\n' + `Status Code: ${statusCode}`
            );
          } else if (!/^application\/json/.test(contentType || '')) {
            error = new Error(
              'Invalid content-type.\n' +
                `Expected application/json but received ${contentType}`
            );
          }

          if (error) {
            logger.error(error.message);
            // Consume response data to free up memory
            incomingHttpMsg.resume();
            return;
          }

          incomingHttpMsg.setEncoding('utf8');
          let rawData = '';
          incomingHttpMsg.on('data', (chunk) => {
            rawData += chunk;
          });

          incomingHttpMsg.on('end', async () => {
            try {
              const parsedData = JSON.parse(rawData);
              const showsAndTicketsSold = parsedData
                .filter(
                  (data: any) =>
                    data.name.startsWith(
                      `${COLLECTION_MAP[2025].name} - Torsdag`
                    ) ||
                    data.name.startsWith(
                      `${COLLECTION_MAP[2025].name} - Fredag`
                    ) ||
                    data.name.startsWith(
                      `${COLLECTION_MAP[2025].name} - Lördag`
                    ) ||
                    data.name.startsWith(
                      `${COLLECTION_MAP[2025].name} - Söndag`
                    )
                )
                .reduce(
                  (obj: any, data: any) => ({
                    ...obj,
                    [data.name.replace(`${COLLECTION_MAP[2025].name} - `, '')]:
                      data.sales.soldQtyNet,
                  }),
                  {}
                );

              const newCollection = {
                date: DateTime.now().toFormat('LLL dd'),
                millis: DateTime.now().toMillis(),
                ...showsAndTicketsSold,
              };

              const collectionRef = db.collection(COLLECTION_MAP[2025].name);
              const snapshot = await collectionRef.get();
              const previousDoc = snapshot.docs.find(
                (doc) => doc.data().date === newCollection.date
              );

              if (previousDoc) {
                console.log(
                  await collectionRef
                    .doc(previousDoc.id)
                    .update({ ...newCollection })
                );
              } else {
                await collectionRef.add(newCollection);
              }

              // If calling manually
              // res.json(newCollection);
            } catch (error: any) {
              logger.error(error.message);
            }
          });
        }
      )
      .on('error', (error) => {
        logger.error(error.message);
      });
  }
);

//==========================================================//
//                    Create Production                     //
//==========================================================//
exports.createProduction = onRequest(async (req, res) => {
  try {
    const { name, year, ticksterSalesApiUrl, startDate, endDate } =
      req.method === 'POST' ? req.body : req.query;

    if (!name || !year || !ticksterSalesApiUrl || !startDate || !endDate) {
      res
        .status(400)
        .send(
          'Missing required fields: name, year, ticksterSalesApiUrl, startDate, endDate'
        );
      return;
    }

    const productionRef = db
      .collection(PRODUCTION_COLLECTION_NAME)
      .doc(String(year));

    if ((await productionRef.get()).exists) {
      res.status(400).send(`Production '${year}' already exists`);
      return;
    }

    const production = {
      name,
      year: Number(year),
      ticksterSalesApiUrl: ticksterSalesApiUrl,
      startDate,
      endDate,
    };

    await productionRef.set(production);

    res.send({
      message: `Production '${year}' created`,
      production,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to create production');
  }
});

//==========================================================//
//==========================================================//
//==========================================================//
const SHOW_ORDER = [
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
  startDate: new Date('2025-02-28T00:00:00+01:00'),
  endDate: new Date('2025-04-13T23:59:59+02:00'),
};

exports.migrate2025Collection = onRequest(async (_req, res) => {
  const oldSnapshot = await db.collection('2025').get();

  const productionRef = db.collection(PRODUCTION_COLLECTION_NAME).doc('2025');

  // Create production metadata
  await productionRef.set(PRODUCTION);

  const batch = db.batch();

  oldSnapshot.docs.forEach((doc) => {
    const data = doc.data();

    const showsAndSales = SHOW_ORDER.map((label, index) => ({
      ordinal: index,
      label,
      ticketSales: data[label] ?? 0,
    }));

    const newDocRef = productionRef.collection('ticketSales').doc(doc.id);

    batch.set(newDocRef, {
      date: data.date,
      millis: data.millis,
      showsAndSales,
    });
  });

  await batch.commit();

  res.send('Done!');
  console.log(`Migrated ${oldSnapshot.size} documents`);
});
