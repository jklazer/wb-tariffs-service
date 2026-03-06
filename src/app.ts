import knex, { migrate, seed } from "#postgres/knex.js";
import env from "#config/env/env.js";
import { fetchBoxTariffs } from "./services/wb-api.js";
import { upsertTariffs } from "./services/tariff-storage.js";
import { exportToGoogleSheets } from "./services/google-sheets.js";
import log4js from "log4js";

log4js.configure({
    appenders: {
        console: { type: "console" },
    },
    categories: {
        default: { appenders: ["console"], level: "info" },
    },
});

const logger = log4js.getLogger("app");

const HOUR_MS = 60 * 60 * 1000;
const INTERVAL = env.FETCH_INTERVAL_MS ?? HOUR_MS;

async function collectAndExport(): Promise<void> {
    try {
        logger.info("Starting tariff collection cycle...");

        const tariffs = await fetchBoxTariffs();
        await upsertTariffs(tariffs);
        await exportToGoogleSheets();

        logger.info("Tariff collection cycle complete");
    } catch (err) {
        logger.error("Error in tariff collection cycle:", err);
    }
}

async function waitForDb(retries = 10, delayMs = 3000): Promise<void> {
    for (let i = 1; i <= retries; i++) {
        try {
            await knex.raw("SELECT 1");
            return;
        } catch {
            logger.warn(`Waiting for database... attempt ${i}/${retries}`);
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
    throw new Error("Database not available after retries");
}

async function main(): Promise<void> {
    logger.info("Starting WB Tariffs Service...");

    await waitForDb();

    await migrate.latest();
    await seed.run();

    logger.info("Database ready");

    await collectAndExport();

    setInterval(collectAndExport, INTERVAL);
    logger.info(`Scheduled tariff collection every ${INTERVAL / 1000}s`);
}

main().catch((err) => {
    logger.fatal("Fatal error:", err);
    process.exit(1);
});
