# Echo Service

This is a simple node service that listens for transactions to a specific address and then simply sends a payment back to the sender with the amount of `amount - fee`. The fee can be configured but by default is set to `5`.

## Usage

First you'll need to have a `coda` daemon running on your machine. See the docs [here](https://codaprotocol.com/docs/getting-started/) for instructions on getting a node, then run the following command:

```
$ coda daemon -rest-port 49370 -peer beta.o1test.net:8303
```

This process must be running for this service to work. Open a new terminal session before you continue.

The service requires [node](https://nodejs.org) to be installed on your system, and uses [yarn](https://yarnpkg.com) as the package manager. Here's how you run the echo service:

```
$ yarn
$ yarn start
```

Look at the logs for the address on which the service is listening. When you send a payment to the service, it will send back a payment with the amount equal to `initial_amount - fee` which can be configured, however is set to `5` by default.
