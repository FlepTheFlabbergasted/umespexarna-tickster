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
const TICKET_SALES_COLLECTION_NAME = 'ticketSales';
const SHOW_DAYS = ['Torsdag', 'Fredag', 'Lördag', 'Söndag'];
const DAYS_TRANSLATIONS_ENG_SWE = {
  Monday: 'Måndag',
  Tuesday: 'Tisdag',
  Wednesday: 'Onsdag',
  Thursday: 'Torsdag',
  Friday: 'Fredag',
  Saturday: 'Lördag',
  Sunday: 'Söndag',
};

//==========================================================//
//                       Get Sales                          //
//==========================================================//
// http://127.0.0.1:5001/umespexarna-tickster/europe-west3/getSales?year=2025
exports.getSales = onRequest(async (req, res) => {
  const year = req.query.year?.toString();

  if (!year) {
    res
      .status(400)
      .json({ error: 'Missing or invalid "year" query parameter.' });
    return;
  }

  try {
    const productionRef = db.collection(PRODUCTION_COLLECTION_NAME).doc(year);
    const productionDoc = await productionRef.get();

    if (!productionDoc.exists) {
      res.status(404).json({ error: `Production '${year}' not found.` });
      return;
    }

    const ticketSalesSnapshot = await productionRef
      .collection(TICKET_SALES_COLLECTION_NAME)
      .orderBy('date')
      .get();

    if (ticketSalesSnapshot.empty) {
      res.status(404).json({ error: 'No ticket sales data found.' });
      return;
    }

    const ticketSales = ticketSalesSnapshot.docs.map((doc) => ({
      id: doc.id, // date
      ...doc.data(),
    }));

    res.send({
      ...productionDoc.data(),
      ticketSales,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'An unexpected error occurred.' });
  }
});

//==========================================================//
//              Add Show and Tickets Sold Row               //
//==========================================================//
//
// Manually run the task here https://console.cloud.google.com/cloudscheduler
// exports.addShowAndTicketsSoldRow = onRequest(async (_req, _res) => {
exports.addShowAndTicketsSoldRow = onSchedule(
  {
    schedule: 'every hour from 08:00 to 00:00',
    timeZone: 'Europe/Stockholm',
  },
  async () => {
    try {
      // Find the latest production by year
      const productionsSnapshot = await db
        .collection(PRODUCTION_COLLECTION_NAME)
        .orderBy('year', 'desc')
        .limit(1)
        .get();

      if (productionsSnapshot.empty) {
        logger.log('No productions found.');
        return;
      }

      const productionDoc = productionsSnapshot.docs[0];
      const production = productionDoc.data();
      const now = DateTime.now();

      // Only run if within the date range
      if (
        !(
          now >= DateTime.fromISO(production.startDate) &&
          now <= DateTime.fromISO(production.endDate)
        )
      ) {
        logger.info(
          'Skipping function execution. Out of valid date range.',
          production.startDate,
          production.endDate
        );

        return;
      }

      // Fetch ticket sales from Tickster
      https
        .get(production.ticksterSalesApiUrl, async (incomingHttpMsg) => {
          const { statusCode } = incomingHttpMsg;
          const contentType = incomingHttpMsg.headers['content-type'];

          let error;
          if (statusCode !== 200) {
            error = new Error(`Request Failed. Status Code: ${statusCode}`);
          } else if (!/^application\/json/.test(contentType || '')) {
            error = new Error(
              `Invalid content-type. Expected application/json but received ${contentType}`
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

              // Filter and map shows
              const relevantShows = parsedData.filter((data: any) =>
                SHOW_DAYS.some(
                  (day) =>
                    data.name.startsWith(production.name) &&
                    data.name.includes(day)
                )
              );

              const showsAndSales = relevantShows.map(
                (data: any, index: number) => {
                  const dateTime = DateTime.fromISO(data.startLocal);
                  const dayKey = dateTime.toFormat(
                    'cccc'
                  ) as keyof typeof DAYS_TRANSLATIONS_ENG_SWE;
                  const label = `${DAYS_TRANSLATIONS_ENG_SWE[dayKey]} ${dateTime.toFormat('HH:mm')}`; // e.g. Fredag 19:00

                  return {
                    ordinal: index,
                    label,
                    ticketSales: data.sales.soldQtyNet,
                  };
                }
              );

              const totalSales = showsAndSales.reduce(
                (sum: number, showsAndSales: any) =>
                  sum + showsAndSales.ticketSales,
                0
              );

              // Use date as document ID (YYYY-MM-DD)
              const docId = DateTime.now().toISODate();

              const ticketSalesRef = db
                .collection(PRODUCTION_COLLECTION_NAME)
                .doc(productionDoc.id)
                .collection(TICKET_SALES_COLLECTION_NAME)
                .doc(docId);

              await ticketSalesRef.set(
                {
                  label: DateTime.now().toFormat('LLL dd'),
                  date: DateTime.now().toISODate(),
                  showsAndSales,
                  totalSales,
                },
                { merge: true }
              );

              logger.log(
                `Ticket sales updated for ${docId} (production ${productionDoc.id})`
              );
            } catch (err: any) {
              logger.error('Failed to parse or write data:', err.message);
            }
          });
        })
        .on('error', (err) => {
          logger.error('HTTP request failed:', err.message);
        });
    } catch (err: any) {
      logger.error('Unexpected error in scheduled function:', err.message);
    }
  }
);

//==========================================================//
//                    Create Production                     //
//==========================================================//
// http://127.0.0.1:5001/umespexarna-tickster/europe-west3/createProduction?year=2026&name=Picasso&ticksterSalesApiUrl=https://mobile.tickster.com/?keys=CU14NB&startDate=2026-03-01&endDate=2026-04-27
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
    logger.error(error);
    res.status(500).send('Failed to create production');
  }
});

//==========================================================//
//==========================================================//
//==========================================================//

// TODO: How to run migrations without a function?

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
exports.migrate2025Collection = onRequest(async (_req, res) => {
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
