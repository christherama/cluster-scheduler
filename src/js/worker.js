const READY = "ready";
const BUSY = "busy";

const _workers = [];

/**
 * Defines a worker, encapsulating a cluster worker and its status ("ready" or "busy")
 */
class Worker {
  constructor({ status = READY, clusterWorker }) {
    this.status = status;
    this._worker = clusterWorker;
    this.pid = clusterWorker.process.pid;
    this.job = null;
  }

  /**
   * Process a job
   * @param {Job} job Job for worker to process
   * @returns {Worker} Next available worker or `undefined` if no available workers
   */
  process(job) {
    this.job = job;
    this._worker.send(job);
    return workers.nextAvailable();
  }
}

const workers = {
  /**
   * Add a worker
   * @param {cluster.Worker} clusterWorker Worker to add, usually via `cluster.fork()`
   */
  add: clusterWorker => {
    _workers.push(new Worker({ clusterWorker }));
  },

  /**
   * Find a worker by its PID
   * @param {number} id PID of worker to find
   */
  byPid: id => {
    return _workers.find(({ pid }) => pid == id);
  },

  /**
   * Gets next available worker
   * @return {Worker} First worker with status "ready" or `undefined` if there are no ready workers
   */
  nextAvailable: () => {
    return _workers.find(({ status }) => status === READY);
  }
};

export { Worker, workers, READY, BUSY };
