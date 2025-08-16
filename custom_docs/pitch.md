## russian pitch
Я разработал TypeScript-библиотеку логирования (@vitaly-yosef/node-smart-logger), основанную на Winston. 
Она поддерживает вывод в несколько получателей: вывод в консоль (в цвете для облегчения восприятия), в локальные файлы .log и в AWS CloudWatch.
Моя библиотека умеет работать с контекстом запроса (traceId, userId), расширяя таким образом стандартный Winson, и связывает логи одного запроса, даже если они происходят в разных слоях приложения.
Библиотека включает middleware для Express. Всё типизировано, легко расширяется и уже используется в продакшене.
Это мой подход к надёжному и масштабируемому логированию.

## english pitch
I developed a TypeScript logging library (@vitaly-yosef/node-smart-logger) based on Winston. 
It supports output to multiple destinations: console output (colored for easier reading), local .log files, and AWS CloudWatch.
My library can work with request context (traceId, userId), thus extending standard Winson, and links logs from a single request, even if they occur in different layers of the application.
The library includes middleware for Express. Everything is typed, easily extensible, and already in use in production.
This is my approach to reliable and scalable logging.

