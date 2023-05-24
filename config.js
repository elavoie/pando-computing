const config = {
  port: 3000,
  mongoose: {
    url: "mongodb://127.0.0.1:27017/compute-hub",
    options: {
      useCreateIndex: true,
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  }
}

module.exports = config;
