import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions';
import { createProduction } from './functions/create-production';
import { fetchAndSetTicketSales } from './functions/fetch-and-set-ticket-sales';
import { getTicketSales } from './functions/get-ticket-sales';
import { migrate2025Collection } from './migrations/migrate-2025-collection';

initializeApp();
setGlobalOptions({ region: 'europe-west3' });

const db = getFirestore();

// Requests
exports.getTicketSales = getTicketSales(db);
exports.createProduction = createProduction(db);

// Schedules
exports.fetchAndSetTicketSales = fetchAndSetTicketSales(db);

// Migrations
// TODO: How to run migrations without a function?
exports.migrate2025Collection = migrate2025Collection(db);
