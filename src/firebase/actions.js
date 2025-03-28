/**
 * Followed tutorials from:
 * - https://firebase.google.com/docs/functions/get-started?gen=2nd
 * - https://firebase.google.com/docs/firestore/quickstart#web
 * - https://firebase.google.com/docs/functions/typescript
 * - https://firebase.google.com/docs/firestore/query-data/get-data#node.js
 * - https://firebase.google.com/docs/functions/schedule-functions?gen=2nd
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger, setGlobalOptions } from 'firebase-functions';
import { onRequest } from 'firebase-functions/https';
import { onSchedule } from 'firebase-functions/scheduler';
import https from 'https'; // Node.js

const TICKSTER_SALES_API_URL =
  'https://manager.tickster.com/Statistics/SalesTracker/Api.ashx?keys=CEFA5J,4CG8L2';
const COLLECTION_NAME = '2025';
const SHOW_NAME_PREFIX = 'Alcatraz';

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

// Run once a day at midnight, to clean up the users
// Manually run the task here https://console.cloud.google.com/cloudscheduler
exports.addShowAndTicketsSoldRow = onSchedule(
  'every 1 hours from 00:01 to 23:01',
  async () => {
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
                (data) =>
                  data.name.startsWith(`${SHOW_NAME_PREFIX} - Torsdag`) ||
                  data.name.startsWith(`${SHOW_NAME_PREFIX} - Fredag`) ||
                  data.name.startsWith(`${SHOW_NAME_PREFIX} - Lördag`) ||
                  data.name.startsWith(`${SHOW_NAME_PREFIX} - Söndag`)
              )
              .map((data) => ({
                name: data.name,
                ticketsSold: data.sales.soldQtyNet,
              }));

            const showAndTicketsSoldRow = {
              timeStamp: new Date(),
              totalCapacity: parsedData[0].sales.totCapacity,
              showsAndTicketsSold,
            };

            await getFirestore()
              .collection(COLLECTION_NAME)
              .add({
                [showAndTicketsSoldRow.timeStamp.toString()]:
                  showAndTicketsSoldRow,
              });

            // res.json({ msg: 'New row added', showAndTicketsSoldRow });
          } catch (error) {
            logger.error(error.message);
          }
        });
      })
      .on('error', (error) => {
        logger.error(error.message);
      });
  }
);
