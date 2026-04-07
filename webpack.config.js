const webpack = require("webpack");
const path = require("path");
const srcDir = path.join(__dirname, ".", "src");

module.exports = {
    devtool: process.env.NODE_ENV !== 'production' && 'inline-source-map',
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    entry: {
      popup: path.join(srcDir, 'popup.tsx'),
    //   options: path.join(srcDir, 'options.tsx'),
      background: path.join(srcDir, 'background.ts')
    },
    output: {
        path: path.join(__dirname, "./public/js"),
        filename: "[name].js",
    },
    optimization: {
        splitChunks: {
            name: "vendor",
            chunks(chunk) {
              return chunk.name !== 'background';
            }
        },
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js"],
    }
};
