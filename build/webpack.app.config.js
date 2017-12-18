const path = require("path");
const merge = require("webpack-merge");
const base = require("./webpack.base.config");
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = env => {
  return merge(base(env), {
    entry: {
      main: "./main.js",
      'html-main': "./src/html-main.js"
    },
    output: {
      filename: "[name].js",
      path: path.resolve(__dirname, "../app")
    }
  });
};
