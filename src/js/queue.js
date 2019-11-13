import { isEqual } from "lodash";

class Queue {
  constructor(items = []) {
    this._items = items;
  }

  push(item) {
    this._items.push(item);
  }

  pop() {
    return this._items.shift();
  }

  empty() {
    return this._items.length == 0;
  }

  /**
   * Returns whether or not the given item is in the queue,
   * based on the property values of the item
   * @param {*} item Item to look for in queue
   * @returns {boolean} True if item was found, false otherwise
   */
  contains(item) {
    for (let queue_item in this._items) {
      if (isEqual(queue_item, item)) {
        return true;
      }
    }
    return false;
  }
}

export { Queue };
