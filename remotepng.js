var webshot = require('webshot');

var options = {
  shotSize: {
    width: 633
    , height: 422
  }
};

/**
 * Gets the remote Taifex futures webpage shot
 * @param {string} text The text to be corrected
 * @returns {Promise} Promise with corrected text if succeeded, error otherwise.
 */
exports.shotpng = function (text) {
  return new Promise(
    function (resolve, reject) {
      if (text) {
        webshot('http://info512.taifex.com.tw/Future/ImgChart.aspx?type=1&contract=' + text, './images/now.png', options, function (err) {
          if (err) return reject(error);
          resolve('success');
        });
      } else {
        resolve(text);
      }
    })
};