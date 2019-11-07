const cluster = require("cluster");
const { Scheduler, getLogger, Job, READY } = require("../dist/js/index");

const logger = getLogger("index");

const processJob = job => {
  
  logger.info(`Processing job '${job.name}'`);
  setTimeout(() => {
    process.send({
      workerStatus: READY,
      results: job.config.greeting
    });
  }, 2000);
};

const handleResult = (results) => {
  logger.info(`Results are in: ${results}`);
};

if (cluster.isMaster) {
  const scheduler = new Scheduler({ numWorkers: 2 });
  scheduler
    .schedule(
      new Job({
        name: "sample-job",
        config: { greeting: "hello #1" },
        callback: handleResult
      })
    )
    .now();
  scheduler
    .schedule(
      new Job({
        name: "sample-job",
        config: { greeting: "hello #2" },
        callback: handleResult
      })
    )
    .now()
    .and()
    .every({ s: 10 });
} else {
  logger.info(`Worker started on PID ${process.pid}`);
  process.on("message", processJob);
}
