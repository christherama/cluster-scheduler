import cluster from "cluster";
import os from "os";
import { getLogger } from "./logger";
import { Worker, workers, BUSY } from "./worker";
import { Queue } from "./queue";

const logger = getLogger("scheduler");

/**
 * Processes the result of a worker's job. This will be called when the cluster receives a message back from the worker.
 * @param {Worker} clusterWorker Worker that sent the message
 * @param {Object} o
 * @param {string} o.workerStatus Status of worker (should be "ready" or "busy")
 * @param {string} o.error Error message (if any) resulting from processing job
 * @param {*} o.result Result of job, which will be passed as the argument to the job's callback function
 */
const processResult = (
  clusterWorker,
  { workerStatus, error = null, results = null },
  _
) => {
  const worker = workers.byPid(clusterWorker.process.pid);
  if (error) {
    logger.error(
      `Worker ${worker.pid} encountered an error while processing job '${worker.job.name}': ${error})`
    );
  } else {
    logger.info(
      `Worker ${worker.pid} successfully processed job '${worker.job.name}'`
    );
  }
  logger.info(`Worker ${worker.pid} now has status ${workerStatus}`);
  if (worker.job.callback) {
    worker.job.callback(results);
  }
  worker.status = workerStatus;
};

class Scheduler {
  /**
   * Create a scheduler
   * @param {Object} o
   * @param {number} o.numWorkers Number of cluster workers (defaults to number of CPU cores)
   */
  constructor({ numWorkers = os.cpus().length }) {
    this.numWorkers = numWorkers;
    this.queue = new Queue();
    this.startWorkers();
    this.listen();
  }

  /**
   * Schedule a job now and/or in the future
   * @param {Job} job Job to schedule
   */
  schedule(job) {
    const scheduler = this;
    const builder = {
      /**
       * Schedule the job now
       */
      now: () => {
        scheduler.queue.push(job);
        return builder;
      },

      /**
       * Schedule the job at a specified interval
       * @param {Object} o
       * @param {number} o.ms Number of milliseconds in interval
       * @param {number} o.s Number of seconds in interval
       * @param {number} o.m Number of minutes in interval
       * @param {number} o.h Number of hours in interval
       * @returns The builder to optionally continue scheduling more runs for this job
       */
      every: ({ ms = 0, s = 0, m = 0, h = 0 }) => {
        ms += 1000 * s + 60 * 1000 * m + 60 * 60 * 1000 * h;
        setInterval(() => {
          scheduler.queue.push(job);
        }, ms);
        return builder;
      },

      /**
       * Schedule the job at a specified amount of time from now
       * @param {Object} o
       * @param {number} o.ms Number of milliseconds in interval
       * @param {number} o.s Number of seconds in interval
       * @param {number} o.m Number of minutes in interval
       * @param {number} o.h Number of hours in interval
       * @returns The builder to optionally continue scheduling more runs for this job
       */
      at: ({ ms = 0, s = 0, m = 0, h = 0 }) => {
        ms += 1000 * s + 60 * 1000 * m + 60 * 60 * 1000 * h;
        setTimeout(() => {
          scheduler.queue.push(job);
        }, ms);
      },

      /**
       * Specify additional scheduled runs of the same job
       * @returns The builder to optionally continue scheduling more runs for this job
       */
      and: () => {
        return builder;
      }
    };
    return builder;
  }

  /**
   * Create workers and listen to messages from workers
   */
  startWorkers() {
    for (let i = 0; i < this.numWorkers; i++) {
      let clusterWorker = cluster.fork();
      workers.add(clusterWorker);
    }
    cluster.on("message", processResult);
  }

  /**
   * Start listening and processing jobs in the queue
   * @param {Queue} queue Queue used for holding jobs to be processed
   */
  async listen() {
    setInterval(() => {
      let worker = workers.nextAvailable();
      while (!this.queue.empty() && worker) {
        let job = this.queue.pop();
        worker.tatus = BUSY;
        worker = worker.process(job);
      }
    }, 1000);
  }
}

export { Scheduler };
