import { logger } from 'firebase-functions';
import { onRequest } from 'firebase-functions/https';
import {
  PRODUCTION_COLLECTION_NAME,
  TICKET_SALES_COLLECTION_NAME,
} from '../const';

// http://127.0.0.1:5001/umespexarna-tickster/europe-west3/getSales?year=2025
export const getTicketSales = (db: FirebaseFirestore.Firestore) =>
  onRequest(async (req, res) => {
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
