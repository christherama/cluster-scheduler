// Include this for forking processes
const cluster = require("cluster");

const { Scheduler, getLogger, Job, READY } = require("cluster-scheduler");
const logger = getLogger("index");

/*
 * Declare a function that a worker will use for processing a job. This function will be
 * called by a worker when it receives a message from the master process.
 *
 * This function takes one argument, which is the `Job` object scheduled below
 */
const processJob = job => {
  logger.info(`Processing job '${job.name}'`);

  // Do something that takes awhile
  setTimeout(() => {
    process.send({
      workerStatus: READY,
      results: job.config.greeting // this is the argument passed to the `handleResult` function below
    });
  }, 2000);
};

/*
 * Declare a function to handle the result of the job. This function will be called
 * upon receiving a message back from a cluster worker.
 *
 * This function accepts one argument, which is a arbitrary object sent as the `results`
 * property in the message sent by the worker above
 */
const handleResult = results => {
  logger.info(`Results are in: ${results}`);
};

if (cluster.isMaster) {
  // Start the scheduler on the master process, with one worker per underlying core
  const scheduler = new Scheduler({});
  logger.info(`Scheduler started. Spawning ${scheduler.numWorkers} processes.`);

  // Schedule a job now and every 2s
  scheduler
    .schedule(
      new Job({
        name: "sample-job",
        config: { greeting: "hello" },
        callback: handleResult
      })
    )
    .now()
    .and()
    .every({ s: 2 });
} else {
  // For worker processes, listen for messages (jobs) from the master process
  logger.info(`Worker started on PID ${process.pid}`);
  process.on("message", processJob);
}
