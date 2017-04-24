var webshot = require('webshot');

var options = {
  shotSize: {
    width: 950
    , height: 705
  },
  shotOffset: {
    left: 0
    , right: 0
    , top: 120
    , bottom: 0
  },
  customHeaders: "referer:https://tw.stock.yahoo.com/",
  defaultWhiteBackground: true
};

var options1 = {
  shotSize: {
    width: 375
    , height: 305
  },
  defaultWhiteBackground: true
};

/**
 * Gets the remote Taifex futures webpage shot
 * @param {string} text The text to be corrected
 * @returns {Promise} Promise with corrected text if succeeded, error otherwise.
 */
exports.shotpng = function (url, filename) {
  return new Promise(
    function (resolve, reject) {
      if (url) {
        webshot(url, './images/' + filename, options, function (err) {
          if (err) return reject(error);
          resolve('success');
        });
      } else {
        resolve(url);
      }
    })
};

exports.shotpng1 = function (url, filename) {
  return new Promise(
    function (resolve, reject) {
      if (url) {
        webshot(url, './images/' + filename, options1, function (err) {
          if (err) return reject(error);
          resolve('success');
        });
      } else {
        resolve(url);
      }
    })
};