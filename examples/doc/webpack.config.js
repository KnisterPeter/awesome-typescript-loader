module.exports = {
    resolve: {
        extensions: ['', '.ts', '.js']
    },
    devtool: 'source-map',
    plugins: [
        //new ExtractTextPlugin("[name].css")
    ],
    module: {
        loaders: [
            {
                test: /\.ts$/,
                loader: 'awesome-typescript-loader'
            }
        ]
    },
    entry: {
        index: ['./index.ts']
    },
    output: {
        path: './dist',
        filename: './[name].js'
    }
};