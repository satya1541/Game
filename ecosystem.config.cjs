module.exports = {
  apps: [{
    name: "S3",
    script: "dist/index.js",
    interpreter: "node",
    env: {
      "NODE_ENV": "production"
    }
  }]
};
