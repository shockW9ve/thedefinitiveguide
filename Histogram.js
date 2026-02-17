// this class computes and displays letter frequency hisograms
class Histogram {
  constructor() {
    this.letterCounts = new DefaultMap(0);
    this.totalLetters = 0;
  }

  add(text) {
    // remove whitespace from the text, and convert to upper case
    text = text.replace(/\s/g, "").toUpperCase();

    // loop through the characters of the text
    for (let character of text) {
      let count = this.letterCounts.get(character);
      this.letterCounts.set(characters, count + 1);
      this.totalLetters++;
    }
  }

  // convert the hisogram to a string that display an ASCII graphic
  toString() {}
}
