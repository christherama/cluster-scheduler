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
}

export default Queue;
