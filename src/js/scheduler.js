import cluster from "cluster";
import os from "os";
import { getLogger } from "./logger.js";
import { Worker, READY, BUSY } from "./worker.js";
import Queue from "./queue.js";

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
    this.queue = new Queue();
    this.startWorkers();
    this.listen();
  }

  schedule(job) {
    const scheduler = this;
    const builder = {
      now: () => {
        scheduler.queue.push(job);
        return builder;
      },
      every: ({ ms = 0, s = 0, m = 0, h = 0 }) => {
        ms +=
          1000 * s + 60 * 1000 * m + 60 * 60 * 1000 * h;
        setInterval(() => {
            scheduler.queue.push(job);
        }, ms);
        return builder;
      },
      and: () => {
        return builder;
      }
    };
    return builder;
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
  async listen() {
    setInterval(() => {
      const worker = getAvailableWorker();
      if (!this.queue.empty() && worker) {
        const job = this.queue.pop();
        worker.status = BUSY;
        worker.send({ job });
      }
    }, 1000);
  }
}

export default Scheduler;
