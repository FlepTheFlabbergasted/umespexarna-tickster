import { logger } from 'firebase-functions';
import { onRequest } from 'firebase-functions/https';
import { PRODUCTION_COLLECTION_NAME } from '../const';

// http://127.0.0.1:5001/umespexarna-tickster/europe-west3/createProduction?year=2026&name=Picasso&ticksterSalesApiUrl=https://manager.tickster.com/Statistics/SalesTracker/Api.ashx?keys=CU14NB,CEFA5J&startDate=2026-03-01&endDate=2026-04-27
export const createProduction = (db: FirebaseFirestore.Firestore) =>
  onRequest(async (req, res) => {
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
