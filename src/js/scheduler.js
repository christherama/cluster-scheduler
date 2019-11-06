import cluster from "cluster";
import os from "os";
import { getLogger } from "./logger.js";
import { Worker, READY, BUSY } from "./worker.js";

const logger = getLogger("scheduler");
const workers = [];

const getAvailableWorker = () => {
  return workers.find(({ status }) => status === READY);
};

const getWorkerByPid = id => {
  return workers.find(({ pid }) => pid == id);
};

const processResult = (worker, { status, result }, _) => {
  logger.info(
    `Worker ${worker.process.pid} finished job with results ${JSON.stringify(
      result
    )}`
  );
  logger.info(`Worker ${worker.process.pid} now has status ${status}`);
  getWorkerByPid(worker.process.pid).status = status;
};

class Scheduler {
  /**
   * Create a scheduler
   * @param {Object} o
   * @param {number} o.numWorkers Number of cluster workers (defaults to number of CPU cores)
   */
  constructor({ numWorkers = os.cpus().length } = {}) {
    this.numWorkers = numWorkers;
    this.startWorkers();
  }

  startWorkers() {
    for (let i = 0; i < this.numWorkers; i++) {
      let clusterWorker = cluster.fork();
      workers.push(new Worker({ clusterWorker }));
    }
    cluster.on("message", processResult);
  }

  /**
   * Start listening and processing jobs in the queue
   * @param {Queue} queue Queue used for holding jobs to be processed
   */
  async listen(queue) {
    this.queue = queue;

    setInterval(() => {
      const worker = getAvailableWorker();
      if (!queue.empty() && worker) {
        const job = queue.pop();
        worker.status = BUSY;
        worker.send({ job });
      }
    }, 1000);
  }
}

export default Scheduler;
