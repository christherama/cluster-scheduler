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
    worker.job.callback(worker, results);
  }
  worker.status = workerStatus;
};

class Scheduler {
  /**
   * Create a scheduler
   * @param {Object} o
   * @param {number} o.numWorkers Number of cluster workers (defaults to number of CPU cores)
   * @param {boolean} o.excludeDuplicateJobs Whether or not jobs of the same configuration should be excluded
   */
  constructor({
    numWorkers = os.cpus().length,
    excludeDuplicateJobs = false,
    workerTimeout = null
  }) {
    this.numWorkers = numWorkers;
    this.excludeDuplicateJobs = excludeDuplicateJobs;
    this.queue = new Queue();
    this.workerTimeout = workerTimeout;
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
        scheduler.enqueueJob(job);
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
          scheduler.enqueueJob(job);
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
          scheduler.enqueueJob(job);
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

  shouldEnqueueJob(job) {
    if (!this.excludeDuplicateJobs) {
      return true;
    }
    return !this.queue.contains(job);
  }

  enqueueJob(job) {
    if (this.shouldEnqueueJob(job)) {
      this.queue.push(job);
    }
  }

  /**
   * Create workers and listen to messages from workers
   */
  startWorkers() {
    for (let i = 0; i < this.numWorkers; i++) {
      this.startWorker();
    }
    cluster.on("message", processResult);
  }

  /**
   * Start a single worker
   */
  startWorker() {
    let clusterWorker = cluster.fork();
    workers.add(clusterWorker);
  }

  /**
   * Start listening and processing jobs in the queue
   * @param {Queue} queue Queue used for holding jobs to be processed
   */
  async listen() {
    while (true) {
      let worker = workers.nextAvailable();

      // Process jobs until all workers are busy
      while (!this.queue.empty() && worker) {
        let job = this.queue.pop();
        worker.status = BUSY;
        worker = worker.process(job);
      }

      this.respawnWorkers();
    }
  }

  respawnWorkers() {
    // Kill workers after timeout exceeded
    if (this.workerTimeout) {
      const now = Date.now();
      let totalKilled = 0;
      workers.forEach(w => {
        if (now - w.timeStarted >= this.workerTimeout) {
          w.kill();
          totalKilled++;
        }
      });

      // Start new workers if needed
      for (let i = 0; i < totalKilled; i++) {
        this.startWorker();
      }
    }
  }
}

export { Scheduler };
