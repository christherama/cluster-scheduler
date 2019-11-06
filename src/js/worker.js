const READY = "ready";
const BUSY = "busy";

class Worker {
  constructor({ status = READY, clusterWorker }) {
    this.status = status;
    this._worker = clusterWorker;
    this.pid = clusterWorker.process.pid;
  }

  send(message) {
    this._worker.send(message);
  }
}

export { Worker, READY, BUSY };
