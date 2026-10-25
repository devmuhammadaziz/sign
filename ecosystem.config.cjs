/** PM2 config — no separate .env needed for alphabet mode */
module.exports = {
  apps: [
    {
      name: "asl-alphabet",
      cwd: "/home/deploy/asl-alphabet",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3010",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3010",
        HOSTNAME: "127.0.0.1",
      },
    },
  ],
};
