class Job {
  /**
   * Create a job
   * @param {Object} o
   * @param {string} o.name Name to associate with job
   * @param {*} o.config Object to be used by job-specific processor
   * @param {*} o.handleResult Callback function for when scheduler is done processing job
   */
  constructor({ name, config, callback = null }) {
    this.name = name;
    this.config = config;
    this.callback = callback;
  }
}

export default Job;
