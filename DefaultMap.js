// This class extends Map so that get() method return the specified
// value instead of null when the key is not in the map
class DefaultMap extends Map {
  constructor(defaultValue) {
    super();
    this.defaultValue = defaultValue;
  }

    get(key){
        if(this.has(key){
        return super.get(key);
        } else {
        return this.defaultValue;
        }
    }
}
