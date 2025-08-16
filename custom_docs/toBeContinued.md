# Идеи

## Заменить Map на AsyncLocalStorage
*Что даст:* Полную async-изоляцию контекста.

Сейчас реализовано на Map, а не AsyncLocalStorage — это работает, если вызовы синхронны или контекст пробрасывается вручную (что делаем через middleware). 
Для полной изоляции на уровне асинхронности можно перейти на AsyncLocalStorage.

## logger.child() per request
*Что даст:* Более тонкое разделение по модулям

## Формат logfmt или structured JSON
*Что даст:* Для совместимости с observability tools

## Интеграция с Sentry, Datadog
*Что даст:* Deep linking логов и алертов

---

## Уровни логов динамически через ENV
*Что даст:* Легче менять поведение без redeploy

Сейчас динамическое управление уровнем логирования через переменную окружения НЕ реализовано в полном смысле.

**Как сейчас работает:**

Уровень логирования определяется функцией level() в коде.

Эта функция смотрит только на NODE_ENV:
* если development → уровень всегда debug
* если production → уровень всегда info

Значение из process.env.LOG_LEVEL НЕ используется! Даже если ты задашь переменную окружения LOG_LEVEL, она никак не повлияет на уровень логирования.

**Что даст реализация поддержки LOG_LEVEL через ENV:**

Можно будет менять уровень логов (например, на debug, warn, error и т.д.) динамически, просто изменив переменную окружения и перезапустив процесс (без перекомпиляции и деплоя).

Это даст гибкость для продакшена/стейджинга: можно быстро включить подробное логирование или наоборот уменьшить шум.

---

## Интеграция с Kibana
*Что даст:* Deep linking and visualization логов и алертов

---

## Соответствие DataOps
### Минусы / ограничения:
1. Нет встроенных metrics (latency, errors, throughput) — это разные инструменты (Prometheus, CloudWatch Metrics).
2. Нет поддержки distributed tracing (например, OpenTelemetry, X-Ray), только простая context.
3. Не реализована log sampling, rate limiting — важно при high-volume потоках, чтобы не перегружать storage.

Оценка: Интеграция лога подходит для DataOps, но требует расширения наблюдаемости и метрик.

---

## Варианты логирования в GCP (по аналогии с AWS)

Ниже приведены два рекомендуемых подхода для отправки логов в Google Cloud Logging (ex-Stackdriver). Оба варианта совместимы с текущей архитектурой (Winston + контекст через AsyncLocalStorage) и учитывают безопасность и эксплуатацию.

### Вариант A. Стандартный для GKE/GCE/Cloud Run: JSON в stdout/stderr

Суть: писать структурированные JSON-логи в stdout/stderr. В средах GCP (GKE, GCE, Cloud Run, App Engine) агент Cloud Logging автоматически подберёт их и отправит в Cloud Logging.

Плюсы:
- Минимум зависимостей и кода, нативная интеграция
- Масштабируемость и надёжность (агент/платформа буферизуют)
- Простая локальная разработка

Как использовать в проекте:
- Уже есть формат JSON: `LOG_FORMAT=json` в env, в проде по умолчанию json и так выбран. Убедиться, что включены нужные поля контекста (traceId, requestId, operationId, deviceId, userId), что уже делается через `addMetadata()`.
- Никаких дополнительных зависимостей не требуется.

Рекомендованные переменные окружения:
- `LOG_FORMAT=json` — принудительно включить JSON там, где нужно
- `LOG_LEVEL=info|warn|error|debug` — динамическое управление уровнем (нужно реализовать поддержку, см. выше)

Безопасность/качество:
- Поля уже санитизируются через `sanitizeForLogging` — продолжать не логировать секреты/PII, добавив маскирование по allowlist/denylist при необходимости
- Для Kubernetes добавить лейблы/аннотации на Pod/Deployment, чтобы в Cloud Logging было удобно фильтровать (namespace, app, version)

Когда выбрать этот вариант: дефолт для Kubernetes/Cloud Run, если не нужны особые фичи клиентской библиотеки (например, задание нестандартных resource labels из приложения).

### Вариант B. Нативный транспорт @google-cloud/logging-winston

Суть: добавить транспорт Winston, который пишет напрямую в Cloud Logging API. Подходит для случаев, когда нужно гибко управлять ресурсами/лейблами/лог-именами из приложения.

Зависимость (docs):
- `@google-cloud/logging-winston` (официальный транспорт)

Пример конфигурации (в стиле текущего кода):
- Переменные окружения:
  - `GCP_LOGGING_ENABLED=true`
  - `GCP_PROJECT_ID=<project-id>` (необязательно при ADC в GCP средах)
  - `GCP_LOG_NAME=<имя_лога>` (например, `${SERVICE}-app`)
  - `GCP_RESOURCE_TYPE=generic_node` (или `k8s_container`, если задаёте вручную)
  - `GCP_RESOURCE_LABELS="{\"location\":\"europe-west1\",\"namespace_name\":\"default\",\"cluster_name\":\"prod\"}"` (опционально)
  - Настройки буферизации при необходимости: `GCP_BUFFER_INTERVAL_MS=1000`, `GCP_MAX_ENTRY_SIZE=256000`

- Псевдокод интеграции с существующим логгером (идея для реализации):
  1) Установить зависимость: `pnpm add @google-cloud/logging-winston`
  2) В месте, где формируется список `transports`, добавить условие по `GCP_LOGGING_ENABLED` и создать транспорт `LoggingWinston` с маппингом контекста:
     - Использовать уже существующий `addMetadata()` для добавления `service`, `hostname`, `environment`, `traceId/requestId/userId/deviceId`
     - Формат — JSON
     - Имя лога — из `GCP_LOG_NAME` или по умолчанию `${service}`
     - Ресурс и лейблы — если нужно задать явно, иначе Cloud Logging их автоопределит (особенно в GKE/Cloud Run)
  3) В `graceful-shutdown` добавить аналог CloudWatch-хука: сохранить ссылку на GCP транспорт и в shutdown вызывать его `flush()`/`close()` при наличии, с таймаутом и обработкой ошибок

- Аутентификация и секреты:
  - В GCP средах использовать Application Default Credentials (ADC) — не хранить ключи в репозитории
  - Для локальной разработки: `gcloud auth application-default login`
  - Если требуется ключ сервисного аккаунта — инжектировать через Secret Manager/Kubernetes Secret, читать путь из env, не логировать содержимое

- Управление стоимостью/шумом:
  - Использовать уже имеющийся rate limiting/sampling; ввести sampling per-level в проде (например, `debug` только с sampling)
  - Короткие сообщения, без больших payload; большие объекты — через ссылку/идентификатор

- Набросок кода (для справки, не копировать буквально):
  ```ts
  import { LoggingWinston } from '@google-cloud/logging-winston';
  // ...
  if (process.env.GCP_LOGGING_ENABLED === 'true') {
    try {
      const loggingWinston = new LoggingWinston({
        projectId: process.env.GCP_PROJECT_ID,
        logName: process.env.GCP_LOG_NAME || `${service}`,
        // resource detect auto; можно задать вручную через options.resource
        // default/monitored resource labels — при необходимости
      });

      transports.push(
        new loggingWinston as unknown as winston.transport // типизация под текущий код
      );
    } catch (err) {
      console.error('Failed to initialize GCP Logging transport:', err);
    }
  }
  ```

Когда выбрать этот вариант: нужны явные логи по именам, специальные resource/labels, расширенные фичи клиента или единый подход для сред вне GCP.

### Сопоставление уровней и полей
- Уровни Winston уже настроены; Cloud Logging поддерживает severity. `@google-cloud/logging-winston` маппит автоматически (`info` → `INFO`, `error` → `ERROR`, и т.д.)
- Поля контекста уже попадают в запись через `addMetadata()`; они будут видны как jsonPayload в Cloud Logging
- Trace correlation: при наличии `traceId` можно настроить сопоставление с Cloud Trace (формат `projects/<PROJECT_ID>/traces/<TRACE_ID>`), если будет интеграция с OpenTelemetry/Trace

### Рекомендации по безопасности и best practices
- Не логировать секреты/токены/пароли; ввести маскирование по списку чувствительных ключей (authorization, cookie, x-api-key, password, token, secret, privateKey)
- Санитизация уже есть — распространить на метаданные/объекты, добавить ограничение размера сообщений и глубины сериализации
- Для файловых логов: права доступа 640/600, ротация включена (есть maxsize/maxFiles), хранение в отдельном каталоге сервиса
- Добавить поддержку `LOG_LEVEL` env (безопасное значение по умолчанию — `info` в проде)
- Грациозное завершение: для CloudWatch уже есть; добавить такой же для GCP транспорта (flush с таймаутом и обработкой ошибок)
- Снижение стоимости: включить sampling для `debug`/`http` в проде; фильтры на уровне ингеста через Log Router (синки)

---

## Планы развития (GCP + Observability)
- Добавить OpenTelemetry для trace/span и связки логов с трассировками
- Настроить Log Router sinks в BigQuery/Storage/SIEM (ретеншн/архив)
- Ввести глобальный correlation-id между микросервисами
- Готовые дашборды/алерты в Cloud Monitoring на основе лог-селекторов
