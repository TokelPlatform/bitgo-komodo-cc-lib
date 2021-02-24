const path = require('path');
module.exports = {
  entry: "./ccfaucetpocbr.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "ccfaucetpocbr-bundle.js",
    library: 'myLibrary'
    //libraryTarget: 'umd'
  },
  mode: "development",
  /*module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },*/
  /*externals: {
    fs: '{}',
    tls: '{}',
    net: '{}',
    dns: '{}',
    readline: '{}'
  }*/
};