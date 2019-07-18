const ws = require("ws");
const gql = require("graphql-tag");
const fetch = require("node-fetch");
const { split } = require("apollo-link");
const { HttpLink } = require("apollo-link-http");
const { ApolloClient } = require("apollo-client");
const { WebSocketLink } = require("apollo-link-ws");
const { InMemoryCache } = require("apollo-cache-inmemory");
const { getMainDefinition } = require("apollo-utilities");

// Set up our GraphQL client

const { PORT = 0xc0da, PUBLIC_KEY, FEE = 5 } = process.env;

const httpLink = new HttpLink({
  uri: `http://localhost:${PORT}/graphql`,
  fetch
});

const wsLink = new WebSocketLink({
  uri: `ws://localhost:${PORT}/graphql`,
  options: {
    reconnect: true
  },
  webSocketImpl: ws
});

const link = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === "OperationDefinition" &&
      definition.operation === "subscription"
    );
  },
  wsLink,
  httpLink
);

const cache = new InMemoryCache();

const client = new ApolloClient({ cache, link });

// Queries

const walletsQuery = gql`
  query ownedWallets {
    ownedWallets {
      publicKey
    }
  }
`;

const newBlockSubscription = gql`
  subscription newBlock($publicKey: PublicKey!) {
    newBlock(publicKey: $publicKey) {
      stateHash
      transactions {
        userCommands {
          isDelegation
          from
          to
          amount
          fee
        }
      }
    }
  }
`;

const sendPaymentMutation = gql`
  mutation sendPayment(
    $fee: UInt64!,
    $amount: UInt64!,
    $to: PublicKey!,
    $from: PublicKey!
  ) {
    sendPayment(input: {
      amount: $amount,
      fee: $fee,
      to: $to,
      from: $from
    }) {
      payment { id }
    }
  }
`


// Handlers

const extractPublicKey = ({ data }) => {
  if (data.ownedWallets.length === 0) {
    throw Error("Node doesn't have any owned wallets.");
  } else if (!data.ownedWallets[0].publicKey) {
    throw Error("Invalid public key for first owned wallet.");
  }

  return data.ownedWallets[0].publicKey;
};

const reverseTransaction = txn =>
  client.mutate({
    mutation: sendPaymentMutation,
    variables: {
      fee: FEE,
      amount: txn.amount - FEE,
      to: txn.from,
      from: txn.to
    }
  }).then(({ data }) => {
    console.log('Sent transaction');
    console.log(data.sendPayment);
  });

const handleBlock = ({ data }, publicKey) => {
  if (!data.newBlock.transactions) {
    return;
  }

  const { stateHash, transactions } = data.newBlock;

  Promise.all(
    transactions.userCommands
      .filter(txn => txn.to === publicKey)
      .map(reverseTransaction)
  )
    .then(() => console.log(`Successfully processed block ${stateHash}`))
    .catch(console.error);
};

const subscribeToBlocks = publicKey => {
  console.log(`Listening for transactions sent to ${publicKey}`);
  client
    .subscribe({
      query: newBlockSubscription,
      variables: { publicKey }
    })
    .forEach(block => handleBlock(block, publicKey))
    .catch(console.error);
};

// Start listening

if (PUBLIC_KEY) {
  subscribeToBlocks(PUBLIC_KEY);
} else {
  client
    .query({ query: walletsQuery })
    .then(extractPublicKey)
    .then(subscribeToBlocks)
    .catch(console.error);
}
