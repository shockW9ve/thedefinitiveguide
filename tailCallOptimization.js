const arr = Array(7875).fill(1);
const start = Date.now();

function sum(array) {
  if (array.length === 0) {
    return 0;
  }

  return array[0] + sum(array.slice(1));
}

// console.log(sum(arr));

function sumTOC(array, acc = 0) {
  if (array.length === 0) {
    return acc;
  }

  return sum(array.slice(1), array[0] + acc);
}

console.log(sumTOC(arr));
const end = Date.now();
console.log(`Time to run: ${end - start} ms`);
