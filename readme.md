# WB Tariffs Service

Сервис для автоматического сбора тарифов коробов Wildberries и экспорта в Google Sheets.

## Функционал

- Ежечасный сбор тарифов через WB API (`/api/v1/tariffs/box`)
- Сохранение данных в PostgreSQL с обновлением в рамках одного дня (upsert)
- Автоматический экспорт актуальных тарифов в N Google-таблиц (лист `stocks_coefs`)
- Данные сортируются по возрастанию коэффициента доставки

## Быстрый старт

### 1. Клонировать репозиторий

```bash
git clone <repo-url>
cd wb-tariffs-service
```

### 2. Настроить переменные окружения

```bash
cp example.env .env
```

Заполнить `.env`:

| Переменная | Описание | Пример |
|---|---|---|
| `POSTGRES_PORT` | Порт PostgreSQL | `5432` |
| `POSTGRES_DB` | Имя БД | `postgres` |
| `POSTGRES_USER` | Пользователь БД | `postgres` |
| `POSTGRES_PASSWORD` | Пароль БД | `postgres` |
| `APP_PORT` | Порт приложения | `5000` |
| `WB_API_TOKEN` | Токен WB API | JWT-токен |
| `GOOGLE_SHEET_IDS` | ID Google-таблиц через запятую | `abc123,def456` |
| `GOOGLE_CREDENTIALS_PATH` | Путь к файлу сервисного аккаунта | `credentials.json` |

### 3. Настроить Google Sheets API

1. Перейти в [Google Cloud Console](https://console.cloud.google.com/)
2. Создать проект (или выбрать существующий)
3. Включить **Google Sheets API**: API & Services -> Library -> Google Sheets API -> Enable
4. Создать сервисный аккаунт: API & Services -> Credentials -> Create Credentials -> Service Account
5. Создать ключ для аккаунта: выбрать аккаунт -> Keys -> Add Key -> JSON
6. Скачанный JSON-файл переименовать в `credentials.json` и положить в корень проекта
7. Скопировать email сервисного аккаунта (вида `name@project.iam.gserviceaccount.com`)
8. Открыть каждую Google-таблицу и дать доступ на редактирование этому email

ID таблицы находится в URL: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`

### 4. Запустить

```bash
docker compose up
```

Приложение автоматически:
- Применит миграции БД
- Выполнит первый сбор тарифов
- Запустит ежечасный цикл обновления

## Проверка работы

1. **Логи** — в консоли видны сообщения о сборе и экспорте данных
2. **БД** — подключиться к PostgreSQL и проверить таблицу `box_tariffs`:
   ```bash
   docker exec -it postgres psql -U postgres -c "SELECT warehouse_name, box_delivery_coef_expr FROM box_tariffs ORDER BY box_delivery_coef_expr ASC LIMIT 10;"
   ```
3. **Google Sheets** — открыть таблицу, проверить лист `stocks_coefs`

## Структура проекта

```
src/
  app.ts                  - точка входа, запуск cron-цикла
  config/
    env/env.ts            - валидация переменных окружения (zod)
    knex/knexfile.ts      - конфигурация knex
  postgres/
    knex.ts               - инстанс knex, утилиты миграций
    migrations/           - миграции БД
    seeds/                - сиды (spreadsheet_id)
  services/
    wb-api.ts             - получение тарифов с WB API
    tariff-storage.ts     - сохранение/получение тарифов из БД
    google-sheets.ts      - экспорт в Google Sheets
  utils/
    knex.ts               - CLI для миграций
```

## Технологии

- TypeScript
- Node.js 20
- PostgreSQL 16
- knex.js
- Google Sheets API (googleapis)
- Docker & Docker Compose
- zod (валидация)
- log4js (логирование)
