const path = require("path");
const merge = require("webpack-merge");
const base = require("./webpack.base.config");
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = env => {
  return merge(base(env), {
    entry: {
      main: "./src/main.js",
      render: "./src/render.js"
    },
    output: {
      filename: "[name].js",
      path: path.resolve(__dirname, "../app")
    },
    plugins: [
      new CopyWebpackPlugin([
        {
          from: './node_modules/xel/stylesheets/vanilla.theme.css',
          to: path.resolve(__dirname, "../app/xel/stylesheets")
        },
        {
          from: './node_modules/xel/stylesheets/macos.theme.css',
          to: path.resolve(__dirname, "../app/xel/stylesheets")
        },
        {
          from: './node_modules/xel/xel.min.js',
          to: path.resolve(__dirname, "../app/xel")
        }
      ])
    ]
  });
};
