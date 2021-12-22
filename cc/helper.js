exports.splitArrayInChunks = (array, chunkSize) =>
  Array(Math.ceil(array.length / chunkSize))
    .fill(undefined)
    .map((_, index) => array.slice(index * chunkSize, index * chunkSize + chunkSize));
