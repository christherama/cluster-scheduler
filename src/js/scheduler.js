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
      worker.on("message", async ({ name, config }) => {
        process.stdout.write(
          `Worker ${worker.process.pid} processing job ${name}`
        );
        const result = await this.processJob(config);
        process.send({ status: READY, result });
      });
      this.workers.push({status: READY, worker, send: worker.send});
    }
  }

  /**
   * Start listening and processing jobs in the queue
   * @param {Queue} queue Queue used to hold jobs to be processed
   */
  async listen(queue) {
    this.queue = queue;

    // TODO Continually check for queued jobs
    const worker = this.getAvailableWorker();
    logger.info(`Available worker found with PID ${worker.worker.process.pid}`);
    if(!queue.empty() && worker) {
        const job = queue.pop();
        worker.send(job);
    }
  }

  getAvailableWorker() {
    return this.workers.find(({status}) => status === READY);
  }
}

export default Scheduler;
