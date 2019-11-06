import cluster from "cluster";
import os from "os";
import { getLogger } from "./logger.js";
import { READY } from "./job.js";

const logger = getLogger("scheduler");

class Scheduler {
  /**
   * Create a scheduler
   * @param {Object} o
   * @param {number} o.numWorkers Number of cluster workers (defaults to number of CPU cores)
   */
  constructor({ numWorkers = os.cpus().length } = {}) {
    this.numWorkers = numWorkers;
    this.workers = [];
    this.startWorkers();
  }

  startWorkers() {
    for (let i = 0; i < this.numWorkers; i++) {
      let worker = cluster.fork();
      this.workers.push({ status: READY, worker });
    }
    cluster.on("message", this.processResult);
  }

  processResult(worker, { status, result }, handler) {
    logger.info(
      `Worker ${worker.process.pid} finished job with results ${JSON.stringify(
        result
      )}}`
    );
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
      logger.info(`Job found in queue: ${JSON.stringify(job)}`);
      worker.send({ job });
    }
  }

  getAvailableWorker() {
    const worker = this.workers.find(({ status }) => status === READY);
    return worker ? worker.worker : null;
  }
}

export default Scheduler;
