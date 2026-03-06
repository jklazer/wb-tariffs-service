import knex from "#postgres/knex.js";
import type { BoxTariffRow } from "./wb-api.js";
import log4js from "log4js";

const logger = log4js.getLogger("tariff-storage");

export async function upsertTariffs(rows: BoxTariffRow[]): Promise<void> {
    if (rows.length === 0) {
        logger.warn("No tariff rows to upsert");
        return;
    }

    logger.info(`Upserting ${rows.length} tariff rows for date ${rows[0].date}`);

    const rowsWithTimestamp = rows.map((r) => ({ ...r, updated_at: knex.fn.now() }));

    await knex("box_tariffs")
        .insert(rowsWithTimestamp)
        .onConflict(["date", "warehouse_name"])
        .merge([
            "geo_name",
            "box_delivery_base",
            "box_delivery_liter",
            "box_delivery_coef_expr",
            "box_delivery_marketplace_base",
            "box_delivery_marketplace_liter",
            "box_delivery_marketplace_coef_expr",
            "box_storage_base",
            "box_storage_liter",
            "box_storage_coef_expr",
            "dt_next_box",
            "dt_till_max",
            "updated_at",
        ]);

    logger.info("Upsert complete");
}

export async function getTodayTariffsSorted(): Promise<BoxTariffRow[]> {
    const today = new Date().toISOString().split("T")[0];

    return knex("box_tariffs")
        .where("date", today)
        .orderBy("box_delivery_coef_expr", "asc")
        .select("*");
}
