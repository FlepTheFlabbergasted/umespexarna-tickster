// Initial code from https://stackoverflow.com/a/60301938
export {};

declare global {
  interface Array<T> {
    /**
     * Returns the elements ocurring in the array but not ocurring in the input array.
     *
     * @see https://stackoverflow.com/a/33034768
     * @example
     * [1, 2, 3].difference([2, 3]); // [1]
     */
    difference(arr: Array<T>): Array<T>;

    /**
     * Returns the repeated values in array, excluding the 1st occurrence.
     *
     * @example
     * [1, 2, 3, 3].getDuplicates(); // [3]
     */
    getDuplicates(): Array<T>;

    /**
     * Adds all the elements of an array into a string, separated by the specified separator string. The last
     * occurrence of the separator is replaced with the specified last string.
     *
     * @param separator A string used to separate one element of the array from the next in the resulting string.
     * @param last A string used to separate the last element from the second last element.
     * @example
     * [1, 2, 3].joinReplaceLast(',', 'and'); // "1, 2 and 3"
     */
    joinReplaceLast(separator: string, last: string): string;

    /**
     * Remove repeated values in array and return the remaining array.
     *
     * @example
     * [1, 2, 3, 3].removeDuplicates(); // [1, 2, 3]
     * [{ nr: 1 }, { nr: 2 }, { nr: 3 }, { nr: 3 }].removeDuplicates((a, b) => a.nr === b.nr); // [{ nr: 1 }, { nr: 2 }, { nr: 3 }]
     */
    removeDuplicates(compareFn?: (a: T, b: T) => boolean): Array<T>;
  }
}

if (!Array.prototype.difference) {
  Array.prototype.difference = function <T>(arr: Array<T>): Array<T> {
    return this.filter((x) => !arr.includes(x));
  };
}

if (!Array.prototype.getDuplicates) {
  Array.prototype.getDuplicates = function <T>(): Array<T> {
    return this.filter((v, i, arr) => i !== arr.indexOf(v));
  };
}

if (!Array.prototype.joinReplaceLast) {
  Array.prototype.joinReplaceLast = function (separator: string, last: string): string {
    const lastOccurrenceRegexp = new RegExp(`${separator} ([^${separator}]*)$`);
    return this.join(`${separator} `).replace(lastOccurrenceRegexp, ` ${last} $1`);
  };
}

if (!Array.prototype.removeDuplicates) {
  Array.prototype.removeDuplicates = function <T>(compareFn?: (a: T, b: T) => boolean): Array<T> {
    return compareFn
      ? this.filter((value, index, arr) => index === arr.findIndex((e) => compareFn(value, e)))
      : this.filter((value, index, arr) => index === arr.findIndex((e) => value === e));
  };
}
