# ЖКХ в MAX

Сервис обращений жителей в сфере ЖКХ через мессенджер MAX.
Мини-приложение для жителей и кабинет для управляющих компаний.

---

## Содержание

- [О решении](#о-решении)
- [Основной сценарий](#основной-сценарий)
- [Архитектура](#архитектура)
- [Запуск](#запуск)
- [Конфигурация](#конфигурация)
- [Возможности](#возможности)
- [Данные](#данные)
- [Проверка сценария](#проверка-сценария)
- [Внешние сервисы](#внешние-сервисы)
- [Эксплуатация](#эксплуатация)

---

## О решении

С 1 сентября 2026 года управляющие компании обязаны взаимодействовать
с собственниками помещений через многофункциональный сервис MAX.
**ЖКХ в MAX** закрывает эту задачу: житель отправляет обращение за
30 секунд, а УК получает структурированную очередь заявок с контролем
сроков и прозрачными статусами.

**Ключевая ценность:**

- Житель решает вопрос без звонков и бумаг — прямо в мессенджере.
- УК видит все обращения в одном месте, с адресом, фото и картой.
- Процесс прозрачен для обеих сторон: статусы, сроки, переписка.

---

## Основной сценарий

### Житель

1. Открывает мини-приложение через бота MAX.
2. При первом входе указывает адрес — дом и квартиру.
3. Создаёт обращение: категория, описание, фото, точка на карте.
4. Получает уведомление о регистрации заявки в MAX.
5. Следит за статусом и общается с УК в треде заявки.
6. При смене статуса получает уведомление в мессенджере.

### УК

1. Открывает кабинет через профиль.
2. Видит очередь обращений по своим домам.
3. Фильтрует по статусу, приоритету, сроку SLA.
4. Назначает исполнителя и меняет статус заявки.
5. Ведёт переписку с жителем в едином треде.

---

## Архитектура

### Компоненты

| Компонент  | Технология    | Назначение                            |
| ------------------- | ----------------------- | ----------------------------------------------- |
| Mini App            | Next.js 15 (App Router) | Интерфейс жителя и УК         |
| API                 | Next.js Route Handlers  | REST API                                        |
| БД                | PostgreSQL 16           | Хранение данных                   |
| ORM                 | Drizzle                 | Схема и миграции                  |
| Веб-сервер | Caddy 2                 | HTTPS, отдача файлов, reverse proxy |
| Бот              | MAX Bot API             | Уведомления и точка входа |

### Роли

| Роль                   | Возможности                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| Житель               | Создание обращений, переписка, отслеживание статуса        |
| УК                       | Очередь заявок, назначение исполнителей, смена статусов |
| Исполнитель     | Работа по назначенным заявкам                                                 |
| Администратор | Полный доступ к системе                                                             |

### Общая схема системы

```mermaid
flowchart TB
    Client["📱 Клиент MAX<br/>(мобильный или веб)"]

    subgraph Proxy["Caddy 2"]
        SSL["🔒 Let's Encrypt"]
        Static["📁 Раздача /uploads/*"]
        Reverse["🔄 Reverse proxy"]
    end

    subgraph App["Next.js Mini App"]
        ReactUI["⚛️ React UI"]
        APIRoutes["🔌 API Routes<br/>/api/*"]
    end

    subgraph Data["Хранилища"]
        PG[("🗄️ PostgreSQL 16<br/>profiles · houses · premises<br/>tickets · messages · events")]
        Files["📷 Docker volume<br/>uploads"]
    end

    Bot["🤖 MAX Bot API"]
    Notify["🔔 Уведомления<br/>жителю и УК"]

    Client -->|HTTPS / WebView| Proxy
    Proxy -->|reverse proxy| App
    Proxy -->|static| Files
    APIRoutes -->|SQL| PG
    APIRoutes -->|fetch| Bot
    Bot -->|send| Notify
    Notify -.->|доставка в MAX| Client

    style Client fill:#e1f5ff,stroke:#0288d1,stroke-width:2px
    style Proxy fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style App fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    style Data fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    style Bot fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    style Notify fill:#fff9c4,stroke:#fbc02d,stroke-width:2px
```

### Сценарий работы системы

```mermaid
sequenceDiagram
    autonumber
    actor Resident as 👤 Житель
    participant App as 📱 Mini App
    participant API as 🔌 API
    participant DB as 🗄️ PostgreSQL
    participant Bot as 🤖 MAX Bot API
    actor UK as 🏢 УК

    Resident->>App: Открывает Mini App
    App->>API: POST /api/auth
    API->>DB: Upsert профиля
    API-->>App: JWT + профиль

    Resident->>App: Онбординг: дом + квартира
    App->>API: POST /api/my/premises
    API->>DB: INSERT residencies
    API-->>App: OK

    Resident->>App: Создаёт обращение
    Note over App: Категория, описание,<br/>фото, точка на карте

    App->>API: POST /api/upload
    API->>API: Запись в /data/uploads
    API-->>App: URLs фото

    App->>API: POST /api/tickets
    API->>DB: INSERT tickets + events
    API->>DB: Автоназначение
    API->>Bot: Уведомление «Заявка принята»
    Bot-->>Resident: 📩 Сообщение в MAX
    API-->>App: 201 Created

    UK->>App: Открывает /uk
    App->>API: GET /api/uk/tickets
    API->>DB: SELECT по домам УК
    API-->>App: Очередь

    UK->>App: Назначает исполнителя + статус
    App->>API: PATCH /api/uk/tickets/:id/status
    API->>DB: UPDATE tickets + events
    API->>Bot: Уведомление «В работе»
    Bot-->>Resident: 📩 Смена статуса

    Resident->>App: Пишет в тред
    App->>API: POST /api/tickets/:id/messages
    API->>DB: INSERT messages
    API->>Bot: Уведомление УК
    Bot-->>UK: 📩 Новое сообщение

    UK->>App: Закрывает заявку
    App->>API: PATCH status = done
    API->>DB: UPDATE tickets
    API->>Bot: Уведомление «Выполнено»
    Bot-->>Resident: 📩 Заявка закрыта
```

### Поток данных при создании заявки

```mermaid
flowchart LR
    A["📱 Mini App<br/>/new"] -->|1. multipart<br/>фото| B["🔌 API<br/>/api/upload"]
    B -->|2. запись| C["📷 /data/uploads/<br/>tickets/uuid.jpg"]
    C -->|3. URL| B
    B -->|4. urls[]| A

    A -->|5. POST JSON<br/>title, photos,<br/>lat, lng| D["🔌 API<br/>/api/tickets"]
    D -->|6. INSERT| E[("🗄️ tickets")]
    D -->|7. INSERT| F[("📋 events")]
    D -->|8. автоназначение| G[("👤 assignee")]
    D -->|9. notify| H["🤖 MAX Bot API"]
    D -->|10. 201 ticket| A

    style A fill:#e1f5ff,stroke:#0288d1,stroke-width:2px
    style B fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    style C fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style D fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    style E fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    style F fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    style G fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    style H fill:#fce4ec,stroke:#c2185b,stroke-width:2px
```

### Работа с картой

```mermaid
flowchart TB
    Start["📱 /new<br/>Кнопка «Указать место»"]
    Open["🖥️ Полноэкранный оверлей<br/>LocationPicker"]
    Map["🗺️ Leaflet + OSM<br/>Прицел в центре<br/>Кнопка 🎯 «Моё место»"]
    Geo["🔌 /api/geocode<br/>Nominatim reverse"]
    Show["📍 Показ адреса<br/>«ул. Ленина, 15»"]
    Done["✅ Кнопка «Готово»"]
    Save["💾 Сохранение<br/>lat, lng, address"]

    Start --> Open
    Open --> Map
    Map -->|движение карты<br/>debounce 800мс| Geo
    Geo -->|shortAddress| Show
    Show --> Done
    Done --> Save

    style Start fill:#e1f5ff,stroke:#0288d1,stroke-width:2px
    style Open fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style Map fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    style Geo fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    style Show fill:#fff9c4,stroke:#fbc02d,stroke-width:2px
    style Done fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    style Save fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
```

### Развёртывание

```mermaid
flowchart TB
    subgraph Host["🖥️ Docker Host — Cloud.ru VM · Ubuntu 24.04"]
        subgraph Net["🌐 Docker Compose Network"]

            subgraph CaddyC["Caddy"]
                C1["🔒 :80 / :443<br/>SSL · reverse proxy"]
            end

            subgraph AppC["App"]
                A1["⚛️ Next.js :3000"]
            end

            subgraph DBC["Database"]
                D1["🗄️ PostgreSQL :5432"]
            end

            subgraph CronC["Cron"]
                CR1["⏰ Проверка SLA"]
            end

            C1 -->|reverse proxy| A1
            A1 -->|SQL| D1
            CR1 -->|HTTP| A1
        end

        subgraph Volumes["💾 Volumes"]
            V1["caddy_data"]
            V2["📷 uploads"]
            V3["🗄️ pgdata"]
        end

        subgraph Init["🚀 One-shot"]
            M1["migrate"]
            S1["seed"]
        end

        C1 -.-> V1
        C1 -.-> V2
        A1 -.-> V2
        D1 -.-> V3
        M1 -.-> D1
        S1 -.-> D1
    end

    Client["📱 Клиент MAX"] -->|HTTPS| C1

    style Host fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    style Net fill:#f1f8e9,stroke:#558b2f,stroke-width:2px
    style CaddyC fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style AppC fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    style DBC fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    style CronC fill:#fff9c4,stroke:#fbc02d,stroke-width:2px
    style Volumes fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    style Init fill:#e0f2f1,stroke:#00695c,stroke-width:2px
    style Client fill:#e1f5ff,stroke:#0288d1,stroke-width:2px
```

### Жизненный цикл заявки

```mermaid
stateDiagram-v2
    [*] --> New: Житель создаёт заявку

    New --> Accepted: УК принимает
    New --> Rejected: УК отклоняет
    New --> Escalated: Просрочка SLA

    Accepted --> InProgress: Исполнитель взял в работу
    Accepted --> Done: Быстрое выполнение

    InProgress --> Done: Работа выполнена
    InProgress --> Escalated: Просрочка SLA

    Escalated --> InProgress: Взяли в работу
    Escalated --> Done: Решено

    Done --> [*]
    Rejected --> [*]

    note right of New
        Автоназначение
        по роли категории
    end note

    note right of Escalated
        Системная эскалация
        при просрочке SLA
    end note
```

### Роли и права

```mermaid
flowchart LR
    subgraph Resident["👤 Житель"]
        R1["Создание обращений"]
        R2["Фото и карта"]
        R3["Переписка в треде"]
        R4["Отслеживание статуса"]
    end

    subgraph UK["🏢 УК"]
        U1["Очередь по домам"]
        U2["Фильтры и SLA"]
        U3["Назначение исполнителей"]
        U4["Смена статусов"]
    end

    subgraph Contractor["🔧 Исполнитель"]
        C1["Заявки по назначению"]
        C2["Смена статуса"]
        C3["Комментарии"]
    end

    subgraph Admin["⚙️ Администратор"]
        A1["Управление домами"]
        A2["Управление УК"]
        A3["Полный доступ"]
    end

    style Resident fill:#e1f5ff,stroke:#0288d1,stroke-width:2px
    style UK fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    style Contractor fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    style Admin fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
```

---

## Запуск

### Требования

- Docker ≥ 24
- Docker Compose ≥ 2.20

### Одна команда для запуска всех компонентов

```bash
docker compose up -d --build
```

### Первичная инициализация

```bash
docker compose run --rm migrate   # схема БД
docker compose run --rm seed      # стартовые данные
```

### Проверка

```bash
docker compose ps
```

Все сервисы (`db`, `app`, `caddy`, `cron`) — в статусе `running`.

---

## Конфигурация

### Файл `.env`

Размещается рядом с `docker-compose.yml`. Шаблон — в `.env.example`.

### Переменные окружения

| Переменная        | Назначение                         |
| --------------------------- | -------------------------------------------- |
| `APP_DOMAIN`              | Домен сервиса для Caddy       |
| `NEXT_PUBLIC_APP_URL`     | Публичный URL приложения  |
| `POSTGRES_USER`           | Пользователь БД                |
| `POSTGRES_PASSWORD`       | Пароль БД                            |
| `POSTGRES_DB`             | Имя базы                              |
| `APP_JWT_SECRET`          | Секрет для подписи JWT       |
| `MAX_BOT_TOKEN`           | Токен бота MAX                      |
| `MAX_WEBHOOK_SECRET`      | Секрет вебхука                  |
| `NEXT_PUBLIC_MAX_BOT_URL` | Ссылка на бота                   |
| `CRON_SECRET`             | Секрет для планировщика |

### Порты

| Порт | Назначение                       |
| -------- | ------------------------------------------ |
| 80       | HTTP (редирект)                    |
| 443      | HTTPS                                      |
| 5432     | PostgreSQL (внутренняя сеть) |
| 3000     | Next.js (внутренняя сеть)    |

Наружу открыты **только 80 и 443**.

---

## Возможности

### Для жителей

- **Быстрое создание обращения** — категория, описание, приоритет.
- **Фото до 5 штук** — с автоматическим сжатием на клиенте.
- **Место на карте** — точка с определением адреса.
- **Прозрачные статусы** — от «Новое» до «Выполнено».
- **Уведомления в MAX** — при регистрации и смене статуса.
- **Переписка с УК** — в едином треде заявки.

### Для управляющих компаний

- **Очередь обращений** по всем домам компании.
- **Фильтры** по статусу, приоритету, сроку SLA.
- **Назначение исполнителей** из справочника сотрудников.
- **Управление статусами** с историей изменений.
- **Контроль SLA** — подсветка просроченных заявок.
- **Автоназначение** по роли категории.

---

## Данные

### Схема БД

| Таблица      | Содержание                                    |
| ------------------- | ------------------------------------------------------- |
| `profiles`        | Пользователи системы                 |
| `houses`          | Реестр домов                                 |
| `premises`        | Квартиры и помещения                  |
| `residencies`     | Привязка жителей к помещениям |
| `categories`      | Категории обращений                   |
| `tickets`         | Обращения                                      |
| `ticket_messages` | Сообщения в тредах                      |
| `ticket_events`   | История изменения статусов      |

### Связи таблиц

```mermaid
erDiagram
    PROFILES ||--o{ HOUSES : "управляет (uk_id)"
    PROFILES ||--o{ RESIDENCIES : "привязан"
    PROFILES ||--o{ TICKETS : "создаёт"
    PROFILES ||--o{ TICKETS : "назначен (assignee_id)"
    PROFILES ||--o{ TICKET_MESSAGES : "пишет"
    HOUSES ||--o{ PREMISES : "содержит"
    PREMISES ||--o{ RESIDENCIES : "привязано"
    PREMISES ||--o{ TICKETS : "место"
    CATEGORIES ||--o{ TICKETS : "категория"
    TICKETS ||--o{ TICKET_MESSAGES : "содержит"
    TICKETS ||--o{ TICKET_EVENTS : "история"

    PROFILES {
        uuid id PK
        bigint max_user_id
        text first_name
        text last_name
        enum role
    }
    HOUSES {
        uuid id PK
        text address
        uuid uk_id FK
        numeric lat
        numeric lng
    }
    PREMISES {
        uuid id PK
        uuid house_id FK
        text number
        text type
    }
    RESIDENCIES {
        uuid id PK
        uuid profile_id FK
        uuid premise_id FK
        boolean verified
    }
    CATEGORIES {
        serial id PK
        text code
        text name
        int default_sla_hours
    }
    TICKETS {
        uuid id PK
        uuid author_id FK
        uuid premise_id FK
        int category_id FK
        uuid assignee_id FK
        text title
        enum status
        enum priority
        numeric lat
        numeric lng
        text location_address
        timestamptz sla_deadline
    }
    TICKET_MESSAGES {
        uuid id PK
        uuid ticket_id FK
        uuid author_id FK
        text body
        text_array attachments
    }
    TICKET_EVENTS {
        bigserial id PK
        uuid ticket_id FK
        uuid actor_id FK
        enum from_status
        enum to_status
    }
```

### Файловое хранилище

Фотографии сохраняются в отдельный Docker volume и отдаются через
Caddy по защищённому пути `/uploads/*`.

### Миграции

```bash
docker compose run --rm migrate
```

### Стартовые данные

```bash
docker compose run --rm seed
```

Создаёт базовый реестр для проверки сценария:

- 8 категорий обращений (вода, отопление, электрика, лифт, кровля,
  мусор, придомовая территория, домофон).
- 5 домов с 40 квартирами в каждом.
- Профили управляющих компаний, исполнителей и тестового жителя.

---

## Проверка сценария

### 1. Открытие сервиса

Откройте `https://<APP_DOMAIN>` — увидите страницу входа в MAX.

### 2. Открытие мини-приложения

Через бота MAX откройте мини-приложение. При первом входе —
онбординг: выбор дома и квартиры.

### 3. Создание обращения

- Категория, заголовок, описание.
- Прикрепите 1–2 фотографии.
- Укажите место на карте.
- Нажмите «Отправить».

**Ожидаемое поведение:**

- Уведомление «Обращение отправлено».
- Заявка появляется в списке на главной.
- В MAX приходит сообщение от бота.

### 4. Просмотр заявки

Откройте заявку из списка. Видно:

- Статус и категорию.
- Адрес и карту.
- Фотографии.
- Поле для сообщений.

### 5. Работа управляющей компании

Через профиль откройте кабинет УК:

- Очередь обращений с фильтрами.
- Карточка заявки с действиями: назначение исполнителя, смена
  статуса, комментарий.
- Переписка с жителем.

При смене статуса автор получает уведомление в MAX, а в треде
появляется системное сообщение.

---

## Внешние сервисы

### MAX Bot API

Обеспечивает отправку уведомлений жителям и УК, а также приём
вебхуков от платформы. Точка входа в мини-приложение.

Для работы необходим аккаунт в MAX и зарегистрированный бот.

### Карты и геокодирование

Для указания места на карте используются открытые картографические
данные OpenStreetMap и сервис обратного геокодирования Nominatim.

Обеспечивают отображение карты, выбор точки и определение
человекочитаемого адреса по координатам.

---

## Эксплуатация

### Обновление

```bash
cd maxhackathon
git pull
cd ..
docker compose up -d --build
```

### Логи

```bash
docker compose logs -f app
docker compose logs -f caddy
docker compose logs -f db
docker compose logs -f cron
```

### Остановка

```bash
docker compose down          # сохраняет данные
docker compose down -v       # удаляет данные
```

### Повторный запуск

```bash
docker compose up -d
```

### Перезапуск отдельных сервисов

```bash
docker compose restart app
docker compose restart caddy
```

---

## Разработано для

Хакатона по цифровизации сферы ЖКХ.
Хостинг — Cloud.ru. Мини-приложение доступно в MAX через бота
команды.

---

## Лицензия

MIT.
