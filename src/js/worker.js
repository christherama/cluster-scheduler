const READY = "ready";
const BUSY = "busy";

const _workers = [];

const workers = {
  /**
   * Add a worker
   * @param {cluster.Worker} clusterWorker Worker to add, usually via `cluster.fork()`
   * @param {cluster.Worker} lazy True if this worker is considered lazy (will be killed after processing job)
   */
  add: (clusterWorker, lazy = false) => {
    const worker = new Worker({ clusterWorker, lazy });
    _workers.push(worker);
    return worker;
  },

  /**
   * Remove a worker by pid
   * @param {pid} pid Worker to remove
   */
  remove: pidToRemove => {
    const indexToRemove = _workers.findIndex(({ pid }) => pid == pidToRemove);
    if (indexToRemove > -1) {
      _workers.splice(indexToRemove, 1);
    }
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
  },

  forEach: () => {
    return _workers.forEach;
  },

  length: () => {
    return _workers.length;
  }
};

/**
 * Defines a worker, encapsulating a cluster worker and its status ("ready" or "busy")
 */
class Worker {
  constructor({ status = READY, clusterWorker, lazy = false }) {
    this.status = status;
    this._worker = clusterWorker;
    this.lazy = lazy;
    this.timeStarted = null;
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
    this.timeStarted = Date.now();
    this._worker.send(job);
    return workers.nextAvailable();
  }

  /**
   * Kills this worker by killing the underlying process
   * @param {String} signal OS signal to send
   */
  kill() {
    this._worker.process.kill();
    workers.remove(this.pid);
  }
}

export { Worker, workers, READY, BUSY };
