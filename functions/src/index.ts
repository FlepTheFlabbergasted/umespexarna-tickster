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

  // In own collection
  ticketSales: TicketSaleDataPoint[]; // [...]
}

//==========================================================//
//                       Get Sales                          //
//==========================================================//
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
      .orderBy('millis')
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

// import { onSchedule } from "firebase-functions/v2/scheduler";
// import * as admin from "firebase-admin";
// import * as https from "https";
// import { DateTime } from "luxon";

// const db = admin.firestore();

// const SHOW_ORDER = ["Torsdag", "Fredag", "Lördag", "Söndag"];

// exports.addShowAndTicketsSoldRow = onSchedule(
//   {
//     schedule: "every hour from 08:00 to 00:00",
//     timeZone: "Europe/Stockholm",
//   },
//   async () => {
//     try {
//       // 1️⃣ Find the latest production by year
//       const productionsSnapshot = await db
//         .collection("productions")
//         .orderBy("year", "desc")
//         .limit(1)
//         .get();

//       if (productionsSnapshot.empty) {
//         console.log("No productions found.");
//         return;
//       }

//       const productionDoc = productionsSnapshot.docs[0];
//       const production = productionDoc.data();

//       const now = new Date();

//       // 2️⃣ Only run if within the date range
//       if (now < production.startDate.toDate ? production.startDate.toDate() : production.startDate || now ||
//           now > production.endDate.toDate ? production.endDate.toDate() : production.endDate) {
//         console.log(
//           "Skipping function. Out of valid date range.",
//           production.startDate,
//           production.endDate
//         );
//         return;
//       }

//       // 3️⃣ Fetch ticket sales from Tickster
//       https
//         .get(production.ticksterSalesApiUrl, async (incomingHttpMsg) => {
//           const { statusCode } = incomingHttpMsg;
//           const contentType = incomingHttpMsg.headers["content-type"];

//           let error;
//           if (statusCode !== 200) {
//             error = new Error(`Request Failed. Status Code: ${statusCode}`);
//           } else if (!/^application\/json/.test(contentType || "")) {
//             error = new Error(
//               `Invalid content-type. Expected application/json but received ${contentType}`
//             );
//           }

//           if (error) {
//             console.error(error.message);
//             incomingHttpMsg.resume();
//             return;
//           }

//           incomingHttpMsg.setEncoding("utf8");
//           let rawData = "";
//           incomingHttpMsg.on("data", (chunk) => {
//             rawData += chunk;
//           });

//           incomingHttpMsg.on("end", async () => {
//             try {
//               const parsedData = JSON.parse(rawData);

//               // 4️⃣ Filter and map shows
//               const relevantShows = parsedData.filter((data: any) =>
//                 SHOW_ORDER.some((day) =>
//                   data.name.startsWith(`${production.name} - ${day}`)
//                 )
//               );

//               const showsAndSales = relevantShows.map((data: any, index: number) => ({
//                 ordinal: index,
//                 label: data.name.replace(`${production.name} - `, ""),
//                 ticketSales: data.sales.soldQtyNet,
//               }));

//               const totalSales = showsAndSales.reduce(
//                 (sum, s) => sum + s.ticketSales,
//                 0
//               );

//               // 5️⃣ Use date as document ID (YYYY-MM-DD)
//               const docId = DateTime.now().toISODate();

//               const ticketSalesRef = db
//                 .collection("productions")
//                 .doc(productionDoc.id)
//                 .collection("ticketSales")
//                 .doc(docId);

//               await ticketSalesRef.set(
//                 {
//                   date: DateTime.now().toFormat("LLL dd"),
//                   millis: DateTime.now().toMillis(),
//                   showsAndSales,
//                   totalSales,
//                 },
//                 { merge: true }
//               );

//               console.log(`Ticket sales updated for ${docId} (production ${productionDoc.id})`);
//             } catch (err: any) {
//               console.error("Failed to parse or write data:", err.message);
//             }
//           });
//         })
//         .on("error", (err) => {
//           console.error("HTTP request failed:", err.message);
//         });
//     } catch (err: any) {
//       console.error("Unexpected error in scheduled function:", err.message);
//     }
//   }
// );

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
    logger.error(error);
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

    const newDocRef = productionRef.collection('ticketSales').doc(data.date);

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
