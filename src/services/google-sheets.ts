import { google } from "googleapis";
import env from "#config/env/env.js";
import { getTodayTariffsSorted } from "./tariff-storage.js";
import log4js from "log4js";
import fs from "fs";

const logger = log4js.getLogger("google-sheets");

const SHEET_NAME = "stocks_coefs";

const HEADERS = [
    "Дата",
    "Склад",
    "Регион",
    "Доставка база",
    "Доставка литр",
    "Доставка коэф",
    "Доставка МП база",
    "Доставка МП литр",
    "Доставка МП коэф",
    "Хранение база",
    "Хранение литр",
    "Хранение коэф",
    "Дата след. короба",
    "Дата макс.",
];

function getAuth() {
    const credPath = env.GOOGLE_CREDENTIALS_PATH || "credentials.json";

    if (!fs.existsSync(credPath)) {
        throw new Error(`Google credentials file not found: ${credPath}`);
    }

    return new google.auth.GoogleAuth({
        keyFile: credPath,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
}

async function getSpreadsheetIds(): Promise<string[]> {
    const envIds = env.GOOGLE_SHEET_IDS;
    if (envIds) {
        return envIds.split(",").map((id) => id.trim()).filter(Boolean);
    }
    return [];
}

async function ensureSheet(
    sheets: ReturnType<typeof google.sheets>,
    spreadsheetId: string,
): Promise<void> {
    try {
        const res = await sheets.spreadsheets.get({ spreadsheetId });
        const exists = res.data.sheets?.some(
            (s) => s.properties?.title === SHEET_NAME,
        );
        if (!exists) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [
                        {
                            addSheet: {
                                properties: { title: SHEET_NAME },
                            },
                        },
                    ],
                },
            });
            logger.info(`Created sheet "${SHEET_NAME}" in ${spreadsheetId}`);
        }
    } catch (err) {
        logger.error(`Failed to ensure sheet in ${spreadsheetId}:`, err);
        throw err;
    }
}

export async function exportToGoogleSheets(): Promise<void> {
    const spreadsheetIds = await getSpreadsheetIds();

    if (spreadsheetIds.length === 0) {
        logger.warn("No spreadsheet IDs configured, skipping export");
        return;
    }

    const tariffs = await getTodayTariffsSorted();

    if (tariffs.length === 0) {
        logger.warn("No tariffs to export");
        return;
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const formatDate = (d: unknown) =>
        d instanceof Date ? d.toISOString().split("T")[0] : String(d ?? "");

    const rows = tariffs.map((t) => [
        formatDate(t.date),
        t.warehouse_name,
        t.geo_name,
        t.box_delivery_base,
        t.box_delivery_liter,
        t.box_delivery_coef_expr,
        t.box_delivery_marketplace_base,
        t.box_delivery_marketplace_liter,
        t.box_delivery_marketplace_coef_expr,
        t.box_storage_base,
        t.box_storage_liter,
        t.box_storage_coef_expr,
        t.dt_next_box,
        t.dt_till_max,
    ]);

    const values = [HEADERS, ...rows];

    for (const spreadsheetId of spreadsheetIds) {
        try {
            await ensureSheet(sheets, spreadsheetId);

            await sheets.spreadsheets.values.clear({
                spreadsheetId,
                range: `${SHEET_NAME}!A:Z`,
            });

            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${SHEET_NAME}!A1`,
                valueInputOption: "RAW",
                requestBody: { values },
            });

            logger.info(
                `Exported ${tariffs.length} rows to spreadsheet ${spreadsheetId}`,
            );
        } catch (err) {
            logger.error(`Failed to export to ${spreadsheetId}:`, err);
        }
    }
}
