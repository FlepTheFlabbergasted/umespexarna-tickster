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

const TICKSTER_SALES_API_URL =
  'https://manager.tickster.com/Statistics/SalesTracker/Api.ashx?keys=CEFA5J,4CG8L2';
const COLLECTION_NAME = '2025';
const SHOW_NAME_PREFIX = 'Alcatraz';

// GMT+0100 (Central European Time, Standard Time, winter)
// GMT+0200 (Central European Summer Time)
const START_DATE = new Date('2025-02-28T00:00:00+01:00'); // Biljetsläpp
const END_DATE = new Date('2025-04-13T23:59:59+02:00');

initializeApp();
setGlobalOptions({ region: 'europe-west3' });

const db = getFirestore();

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

// exports.reWrite2025Collection = onRequest(async (_req, res) => {
//   await db
//     .collection(COLLECTION_NAME)
//     .get()
//     .then((querySnapshot) =>
//       querySnapshot.forEach(function (doc) {
//         const data = doc.data();

//         if (!Object.keys(data)[0].includes('12:01')) {
//           doc.ref.delete();
//         } else {
//           doc.ref.set({
//             ...Object.entries(data).flatMap(([key, val]) => ({
//               date: DateTime.fromJSDate(new Date(key)).toFormat('LLL dd'),
//               millis: DateTime.fromJSDate(new Date(key)).toMillis(),
//               ...val.showsAndTicketsSold.reduce(
//                 (acc: any, curr: any) => ({
//                   ...acc,
//                   [curr.name.replace(`${SHOW_NAME_PREFIX} - `, '')]:
//                     curr.ticketsSold,
//                 }),
//                 {}
//               ),
//             }))[0],
//           });
//         }
//       })
//     );

//   res.send('Done!');
// });

// Manually run the task here https://console.cloud.google.com/cloudscheduler
exports.addShowAndTicketsSoldRow = onSchedule(
  { schedule: 'every day 12:00', timeZone: 'Europe/Stockholm' },
  async () => {
    const now = new Date();

    // Only run if within the date range
    if (!(now >= START_DATE && now <= END_DATE)) {
      logger.info(
        'Skipping function execution. Out of valid date range.',
        START_DATE,
        END_DATE
      );
      return;
    }

    https
      .get(TICKSTER_SALES_API_URL, async (incomingHttpMsg) => {
        const { statusCode } = incomingHttpMsg;
        const contentType = incomingHttpMsg.headers['content-type'];

        let error;
        // Any 2xx status code signals a successful response but
        // here we're only checking for 200.
        if (statusCode !== 200) {
          error = new Error('Request Failed.\n' + `Status Code: ${statusCode}`);
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
                  data.name.startsWith(`${SHOW_NAME_PREFIX} - Torsdag`) ||
                  data.name.startsWith(`${SHOW_NAME_PREFIX} - Fredag`) ||
                  data.name.startsWith(`${SHOW_NAME_PREFIX} - Lördag`) ||
                  data.name.startsWith(`${SHOW_NAME_PREFIX} - Söndag`)
              )
              .reduce(
                (obj: any, data: any) => ({
                  ...obj,
                  [data.name.replace(`${SHOW_NAME_PREFIX} - `, '')]:
                    data.sales.soldQtyNet,
                }),
                {}
              );

            const newCollection = {
              date: DateTime.now().toFormat('LLL dd'),
              millis: DateTime.now().toMillis(),
              ...showsAndTicketsSold,
            };

            await getFirestore().collection(COLLECTION_NAME).add(newCollection);

            // If calling manually
            // res.json(newCollection);
          } catch (error: any) {
            logger.error(error.message);
          }
        });
      })
      .on('error', (error) => {
        logger.error(error.message);
      });
  }
);
