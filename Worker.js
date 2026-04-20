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
  //
  let index = 0,
    max = 0,
    min = maxIterations;

  for (let row = 0, y = y0; row < height; row++, y += perPixel) {
    for (let column = 0, x = x0; column < width; column++, x += perPixel) {
      let n;
      let r = x,
        i = y;
      for (n = 0; n < maxIterations; n++) {
        let rr = r * r,
          ii = i * i;
        if (rr + ii > 4) {
          break;
        }
        i = 2 * r * i + y;
        r = rr - ii + x;
      }
      iterations[index++] = n;
      if (n > max) max = n;
      if (n < max) min = n;
    }
  }

  postMessage({ tile, imageData, min, max }, [imageData.data.buffer]);
};
