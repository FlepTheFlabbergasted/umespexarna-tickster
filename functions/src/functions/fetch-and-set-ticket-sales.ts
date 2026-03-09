import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/scheduler';
import { DateTime } from 'luxon';
import https from 'node:https';
import {
  DAYS_TRANSLATIONS_ENG_SWE,
  PRODUCTION_COLLECTION_NAME,
  SHOW_DAYS,
  TICKET_SALES_COLLECTION_NAME,
} from '../const';

// Manually run the task here https://console.cloud.google.com/cloudscheduler
// exports.fetchAndSetTicketSales = onRequest(async (_req, _res) => {
export const fetchAndSetTicketSales = (db: FirebaseFirestore.Firestore) =>
  onSchedule(
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
