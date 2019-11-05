import cluster from "cluster";
import os from "os";
import { getLogger } from "./logger.js";

const logger = getLogger("scheduler");
const READY = "ready";

class Scheduler {
  /**
   * Create a scheduler
   * @param {Object} o
   * @param {function} o.processJob Function for processing job
   * @param {number} o.numWorkers Number of cluster workers (defaults to number of CPU cores)
   */
  constructor({ processJob, numWorkers = os.cpus().length }) {
    this.numWorkers = numWorkers;
    this.processJob = processJob;
    this.workers = [];
    this.startWorkers();
  }

  startWorkers() {
    for (let i = 0; i < this.numWorkers; i++) {
      let worker = cluster.fork();
      worker.process.on("message", this.processJob);
      worker.on("message", this.processResult);
      this.workers.push({ status: READY, worker });
    }
  }

  async processJob({ name, config }) {
    const result = await this.processJob(config);
    process.send({ status: READY, result });
  }

  processResult(worker, {status, result}, handle) {
    logger.info(`Worker ${worker.process.pid} finished job with results ${JSON.stringify(result)}}`);
    logger.info(`Worker ${worker.process.pid} now has status ${status}`);
  }

  /**
   * Start listening and processing jobs in the queue
   * @param {Queue} queue Queue used to hold jobs to be processed
   */
  async listen(queue) {
    this.queue = queue;

    // TODO Continually check for queued jobs
    const worker = this.getAvailableWorker();
    logger.info(`Available worker found with PID ${worker.process.pid}`);
    if (!queue.empty() && worker) {
      const job = queue.pop();
      worker.send(job);
    }
  }

  getAvailableWorker() {
    const worker = this.workers.find(({ status }) => status === READY);
    return worker ? worker.worker : null;
  }
}

export default Scheduler;
