// This is a simple worker that receives a message from its parent thread,
// performs the computation described by that message and then posts the
// result of that computation back to the parent thread.
onmessage = function (message) {
  // First, we unpack the message we received:
  // - tile is an object with width and height properties. It specifies the size of the rectangle of the
  //   pixels for which we will be computing Mandelbrot set membership
  // - ( x0, y0 ) is the point in the complex plane that corresponds to the
  //   upper-left pixel in the tile.
  // - perPixel is the pixel size in both the real and imaginary dimensions.
  // - maxIterations specifies the maximum number of iterations we will
  //   perform before deciding that a pixel is in the set.
  const { tile, x0, y0, perPixel, maxIterations } = message.data;
  const { width, height } = tile;

  // Next, we create an ImageData object to represent the rectangular array
  // of pixels, get its internal ArrayBuffer, and create a typed array view
  // of that buffer so we can treat each pixel as a single integer instead of
  // four individual bytes. We'll store the number of iterations for each
  // actual pixel in this iterations array. (The iterations will be transformed into
  // actual pixel colors in the parent thread.)
  const imageData = new ImageData(width, height);
  const iterations = new Uint32Array(imageData.data.buffer);

  // Now we can begin the computation. There are three nested for loops here.
  // The outer two loop over the rows and columns of pixels, and the inner
  // loop iterates each pixel to see if it "escapes" or not. The various
  // loop variables are the following:
  // - row and column are integers representing the pixel coordinate.
  // - x and y represent the complex point for each pixel: x + yi.
  // - index is the index in the iterations array for the current pixel.
  // - n tracks the number of iterations for each pixel.
  // - max and min track the largest and smallest number of iterations
  //   we've seen so far for any pixel in the rectangle.
  let index = 0,
    max = 0,
    min = maxIterations;

  for (let row = 0, y = y0; row < height; row++, y += perPixel) {
    for (let column = 0, x = x0; column < width; column++, x += perPixel) {
      // For each pixel we start with the complex number c = x + yi.
      // Then we repeatedly compute the complex number z(n + 1) based on
      // this recursive formula:
      //    z(0) = c
      //    z(n + 1) = z(n)^2 + c
      // If |z(n)| (the magnitude of z(n)) is > 2, then the
      // pixel is not part of the set and we stop after n iterations.
      let n; // The numbe o fiterations so far
      let r = x,
        i = y; // Start with z(0) set to c
      for (n = 0; n < maxIterations; n++) {
        let rr = r * r,
          ii = i * i; // Square the two parts of z(n).
        if (rr + ii > 4) {
          // If |z(n)|^2 is > 4 then
          break; // we've escaped and can stop iterating.
        }
        i = 2 * r * i + y; // Compute imaginary part of z(n + 1)
        r = rr - ii + x; // And the real part of the  z(n + 1)
      }
      iterations[index++] = n; // Remember # iterations for each pixel.
      if (n > max) max = n; // Track the maximum number we've seen.
      if (n < max) min = n; // And the minimum as well.
    }
  }

  // When the computation is complete, send the results back to the parent
  // thread. The imageData object will be copied, but the giant ArrayBuffer
  // if contains will be transferred for a nice permance boost.
  postMessage({ tile, imageData, min, max }, [imageData.data.buffer]);
};

/*
 * This class represents a subrectangle of a canvas or image. We use Tiles to
 * divide a canvas into regions that can be processed independently by Workers
 */
class Tile {
  constructor(x, y, width, height) {
    this.x = x; // The properties of a Tile object
    this.y = y; // represents the position and size
    this.width = width; // of the tile within a larger
    this.height = height; // rectangle.
  }

  // This static methid is a generator that divides a rectangle of the
  // specified width and height into the specified number of rows and
  // columns and yields numRows*numCols Tile objects to cover the rectangle.
  static *tiles(width, height, numRows, numCols) {
    let columnWidth = Math.ceil(width / numCols);
    let rowHeight = Math.ceil(height / numRows);

    for (let row = 0; row < numRows; row++) {
      // Height of most rows or height or last row
      let tileHeight =
        row < numRows - 1 ? rowHeight : height - rowHeight * (numRows - 1);
      for (let col = 0; col < numCols; col++) {
        let tileWidth =
          col < numCols - 1 ? columnWidth : width - columnWidth * (numCols - 1); // and last column
        yield new Tile(
          col * columnWidth,
          row * rowHeight,
          tileWidth,
          tileHeight,
        );
      }
    }
  }
}

/* This class represents a pool of workers, all running the same code. The
 * worker code you specify must respond to each message it receives by
 * performing some kind of computation and then posting a single message with the result of that computation.
 *
 * Given a WorkerPool and message that represents work to be performed, simply call addWork(), with the message as an argument. If there is a Worker
 * object that is currently idle, the message will be posted to that worker
 * immediately. If there are no idle Worker objects, the message will  be queued and will be posted to a Worker when one becomes available.
 *
 * addWork() returns a promise, which will resolve with the message recieved
 * from the work, or will reject if the worker throws an unhandled error.
 */
class WorkerPool {
  constructor(numWorkers, workerSource) {
    this.idleWorkers = []; // Workers that are not currently working
    this.workQueue = []; // Work not currently being processed
    this.workerMap = new Map(); // Map workers to resolve and reject funcs

    // Create the specified number of worker, add message and error
    // handlers and save them in the idleWorkers array.
    for (let i = 0; i < numWorkers; i++) {
      let worker = new Worker(workerSource);
      worker.onmessage = (message) => {
        this._workerDone(worker, null, message.data);
      };

      worker.onerror = (error) => {
        this._workerDone(worker, error, null);
      };

      this.idleWorkers[i] = worker;
    }
  }

  // This internal method is called when a worker finishes working, either
  // by sending a message or by throwing an error.
  _workerDone(worker, error, response) {
    // Look up the resolve() and reject() functions for this worker
    // and then remove the worker's entry from the map.
    let [resolver, rejector] = this.workerMap.get(worker);
    this.workerMap.delete(worker);

    // If there is no queued work, put this worker back in
    // the list of idle workers. Otherwise, take work from the queue
    // and send it to this worker.
    if (this.workQueue.length === 0) {
      this.idleWorkers.push(worker);
    } else {
      let [work, resolver, rejector] = this.workQueue.shift();
      this.workerMap.set(worker, [resolver, rejector]);
      worker.postMessage(work);
    }

    // Finally, resolve or reject the promise associated with the worker.
    error === null ? resolver(response) : rejector(error);
  }

  // This method adds work to the worker pool and returns a Promise that
  // will resolve with a worker's response when the work is done. The work
  // is a value to be passed to a worker with postMessage(). If there is an
  // idle worker, the work message will be sent immediately. Otherwise it
  // will be queued untill a worker is available
  addWork(work) {
    return new Promise((resolve, reject) => {
      if (this.idleWorkers.length > 0) {
        let worker = this.idleWorkers.pop();
        this.workerMap.set(worker, [resolve, reject]);
        worker.postMessage(work);
      } else {
        this.workQueue.push([work, resolve, reject]);
      }
    });
  }
}

/*
 *
 */
class PageState {
  // This factory method returns an initial state to display the entire set.
  static initialState() {}
}
