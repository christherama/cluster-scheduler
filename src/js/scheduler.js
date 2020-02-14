import cluster from "cluster";
import os from "os";
import { getLogger } from "./logger";
import { Worker, workers, BUSY } from "./worker";
import { Queue } from "./queue";
import { isArray } from "util";

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

  // Ignore messages that don't match the format expected or worker was already killed,
  if (!clusterWorker || !workerStatus || !worker) {
    return;
  }

  if (error) {
    logger.error(
      `Worker ${clusterWorker.process.pid} encountered an error while processing job '${worker.job.name}': ${error})`
    );
  } else {
    logger.info(
      `Worker ${clusterWorker.process.pid} successfully processed job '${worker.job.name}'`
    );
  }

  if (worker.job.callback) {
    worker.job.callback(worker, results);
  }

  // Kill lazy workers
  if (worker.lazy) {
    worker.kill();
    logger.info(`Lazy worker ${worker.pid} killed`);
  } else {
    worker.status = workerStatus;
    logger.info(`Worker ${worker.pid} now has status ${workerStatus}`);
  }
};

class Scheduler {
  /**
   * Create a scheduler
   * @param {Object} o
   * @param {number} o.numWorkers Number of cluster workers (defaults to number of CPU cores)
   * @param {boolean} o.continuous Whether or not jobs should be processed continuously instead of being scheduled at a set interval
   * @param {boolean} o.excludeDuplicateJobs Whether or not jobs of the same configuration should be excluded
   * @param {boolean} o.lazy When true, spawns a process to complete a scheduled job, then kills the process. Defaults to false.
   * @param {number} o.workerTimeout Number of milliseconds to wait after the last job a worker started before killing and respawning the worker
   */
  constructor({
    numWorkers = os.cpus().length,
    continuous = false,
    excludeDuplicateJobs = false,
    lazy = false,
    workerTimeout = null
  }) {
    this.numWorkers = numWorkers;
    this.continuous = continuous;
    this.excludeDuplicateJobs = excludeDuplicateJobs;
    this.lazy = lazy;
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
    if (this.continuous) {
      const jobs = isArray(job) ? job : [job];
      this._processContinuously(jobs);
      return;
    }

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

  /**
   * Enqueues all jobs to be processed on a continual basis, without regard to any time interval
   * @param {Job[]} jobs Array of jobs to process continuously
   */
  _processContinuously(jobs) {
    this.queue.push(jobs);
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
    if (!this.lazy) {
      for (let i = 0; i < this.numWorkers; i++) {
        this.startWorker();
      }
    }
    cluster.on("message", processResult);
  }

  /**
   * Start a single worker
   */
  startWorker(lazy = false) {
    let clusterWorker = cluster.fork();
    const worker = workers.add(clusterWorker, lazy);
    logger.info(
      `${lazy ? "Lazy worker" : "Worker"} started on PID ${worker.pid}`
    );
    return worker;
  }

  /**
   * Start listening and processing jobs in the queue
   * @param {Queue} queue Queue used for holding jobs to be processed
   */
  async listen() {
    setInterval(() => {
      while (!this.queue.empty()) {
        let job;
        if (this.lazy && workers.length() < this.numWorkers) {
          // Lazy mode: start worker if limit hasn't been reached and process job
          job = this.queue.pop();
          const lazyWorker = this.startWorker(true);
          lazyWorker.process(job);
          lazyWorker.status = BUSY;
        } else if (!this.lazy) {
          // Non-lazy mode: process jobs until all workers are busy
          const availableWorker = workers.nextAvailable();
          if (availableWorker) {
            job = this.queue.pop();
            availableWorker.process(job);
            availableWorker.status = BUSY;
          }
        } else {
          // No workers available or limit reached: try again during next call to setInterval
          break;
        }

        // If continuous mode, place job back on queue
        if (job && this.continuous) {
          this.enqueueJob(job);
        }
      }

      this.respawnWorkers();
    }, 1000);
  }

  respawnWorkers() {
    // Kill workers after timeout exceeded
    if (this.workerTimeout) {
      const now = Date.now();
      let totalKilled = 0;
      workers.forEach(w => {
        if (w.timeStarted && now - w.timeStarted >= this.workerTimeout) {
          logger.info(`Killing worker on PID ${w.pid}`);
          w.kill();
          totalKilled++;
        }
      });

      // Start new workers if needed
      if (!this.lazy) {
        for (let i = 0; i < totalKilled; i++) {
          this.startWorker();
        }
      }
    }
  }
}

export { Scheduler };
