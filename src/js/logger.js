import winston from "winston";

const _loggers = {};

class Logger {
  constructor(name) {
    const { combine, timestamp, label, printf } = winston.format;
    const stdFormat = printf(({ level, message, label, timestamp }) => {
      return `${timestamp} [${label}] ${level}: ${message}`;
    });

    this.logger = winston.createLogger({
      format: combine(label({ label: name }), timestamp(), stdFormat),
      transports: [new winston.transports.Console()]
    });
  }

  info(message) {
    this.logger.info({ message });
  }

  error(message) {
    this.logger.error({ message });
  }
}

const getLogger = name => {
  if (_loggers[name] === undefined) {
    _loggers[name] = new Logger(name);
  }
  return _loggers[name];
};

export { getLogger };
