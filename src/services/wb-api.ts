import env from "#config/env/env.js";
import log4js from "log4js";

const logger = log4js.getLogger("wb-api");

interface WbWarehouse {
    boxDeliveryBase: string;
    boxDeliveryCoefExpr: string;
    boxDeliveryLiter: string;
    boxDeliveryMarketplaceBase: string;
    boxDeliveryMarketplaceCoefExpr: string;
    boxDeliveryMarketplaceLiter: string;
    boxStorageBase: string;
    boxStorageCoefExpr: string;
    boxStorageLiter: string;
    geoName: string;
    warehouseName: string;
}

interface WbApiResponse {
    response: {
        data: {
            dtNextBox: string;
            dtTillMax: string;
            warehouseList: WbWarehouse[];
        };
    };
}

export interface BoxTariffRow {
    date: string;
    warehouse_name: string;
    geo_name: string;
    box_delivery_base: number | null;
    box_delivery_liter: number | null;
    box_delivery_coef_expr: number | null;
    box_delivery_marketplace_base: number | null;
    box_delivery_marketplace_liter: number | null;
    box_delivery_marketplace_coef_expr: number | null;
    box_storage_base: number | null;
    box_storage_liter: number | null;
    box_storage_coef_expr: number | null;
    dt_next_box: string;
    dt_till_max: string;
}

function parseWbNumber(value: string): number | null {
    if (!value || value === "-") return null;
    return parseFloat(value.replace(",", "."));
}

function getTodayDate(): string {
    return new Date().toISOString().split("T")[0];
}

export async function fetchBoxTariffs(): Promise<BoxTariffRow[]> {
    const date = getTodayDate();
    const url = `https://common-api.wildberries.ru/api/v1/tariffs/box?date=${date}`;

    logger.info(`Fetching box tariffs for date: ${date}`);

    const response = await fetch(url, {
        headers: {
            Authorization: env.WB_API_TOKEN,
        },
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`WB API error ${response.status}: ${text}`);
    }

    const json = (await response.json()) as WbApiResponse;
    const data = json.response.data;

    logger.info(`Received ${data.warehouseList.length} warehouses`);

    return data.warehouseList.map((wh) => ({
        date,
        warehouse_name: wh.warehouseName,
        geo_name: wh.geoName || "",
        box_delivery_base: parseWbNumber(wh.boxDeliveryBase),
        box_delivery_liter: parseWbNumber(wh.boxDeliveryLiter),
        box_delivery_coef_expr: parseWbNumber(wh.boxDeliveryCoefExpr),
        box_delivery_marketplace_base: parseWbNumber(wh.boxDeliveryMarketplaceBase),
        box_delivery_marketplace_liter: parseWbNumber(wh.boxDeliveryMarketplaceLiter),
        box_delivery_marketplace_coef_expr: parseWbNumber(wh.boxDeliveryMarketplaceCoefExpr),
        box_storage_base: parseWbNumber(wh.boxStorageBase),
        box_storage_liter: parseWbNumber(wh.boxStorageLiter),
        box_storage_coef_expr: parseWbNumber(wh.boxStorageCoefExpr),
        dt_next_box: data.dtNextBox || "",
        dt_till_max: data.dtTillMax || "",
    }));
}
