import test, { Test } from "tape";

import * as Amqp from "amqp-ts";

import {
  Client,
  Message,
  Frame,
  IMessage,
  StompSubscription,
} from "@stomp/stompjs";

import { CordaTestLedger } from "@hyperledger/cactus-test-tooling";
import { Logger, LoggerProvider } from "@hyperledger/cactus-common";

const log: Logger = LoggerProvider.getOrCreate({
  label: "test-deploy-contract-from-json",
  level: "trace",
});

test("deploys contract via .zip file", async (t: Test) => {
  const cordaTestLedger = new CordaTestLedger({
    containerImageVersion: "latest",
    containerImageName: "caio",
  });
  await cordaTestLedger.start(true);
  await cordaTestLedger.logDebugPorts();

  const rpcAPublicPort = await cordaTestLedger.getRpcAPublicPort();
  const amqpUrl = `amqp://localhost:${rpcAPublicPort}`;

  const body = {
    "rpc-id": "6d728db7-b06f-43e6-91cc-2e552a87349c",
    address: "rpc.server",
    "deduplication-sequence-number": 0,
    "rpc-id-timestamp": 1599620158357,
    messageID: 28,
    "method-name": "getProtocolVersion",
    type: 0,
    priority: 4,
    "rpc-session-id": "2178dfce-6826-4ebc-8a36-922ed887e713",
    "rpc-session-id-timestamp": 1599620157370,
    durable: false,
    JMSReplyTo: "rpc.client.user1.894645352516452180",
    expiration: 0,
    tag: 0,
    _AMQ_VALIDATED_USER: "user1",
    timestamp: 1599620158587,
  };

  const msgAsJson = JSON.stringify(body);

  const rpcQueueName = "rpc.server";

  const connection = new Amqp.Connection(amqpUrl);

  connection.on("open_connection", () => {
    log.debug(`AMQP::open_connection`);
  });

  connection.on("close_connection", () => {
    log.debug(`AMQP::close_connection`);
  });

  connection.on("lost_connection", () => {
    log.debug(`AMQP::lost_connection`);
  });

  connection.on("trying_connect", () => {
    log.debug(`AMQP::trying_connect`);
  });

  connection.on("re_established_connection", () => {
    log.debug(`AMQP::re_established_connection`);
  });

  connection.on("error_connection", (err: any) => {
    log.debug(`AMQP::error_connection err=%o`, err);
  });

  const queueReplies = connection.declareQueue(body.JMSReplyTo);
  const queueOut = connection.declareQueue(rpcQueueName);

  queueReplies.activateConsumer((message) => {
    log.debug("AMQP:: Reply Message received: " + message.getContent());
  });

  // it is possible that the following message is not received because
  // it can be sent before the queue, binding or consumer exist
  const msg = new Amqp.Message(msgAsJson);
  queueOut.send(msg);

  log.debug(`Awaiting for AMQP configuration completion...`);
  await connection.completeConfiguration();
  log.debug(`AMQP configuration OK`);

  // the following message will be received because
  // everything you defined earlier for this connection now exists
  // const msg2 = new Amqp.Message("Test2");
  // queue.send(msg2);

  // const brokerURL = `ws://localhost:${rpcAPublicPort}/ws`;

  // Object.assign(global, { WebSocket: require('ws') });

  // const client = new Client({
  //   brokerURL,
  //   connectHeaders: {
  //     login: "user1",
  //     passcode: "test"
  //   },
  //   debug: (msg: string) => {
  //     log.debug("StompJS#Client::: %o", msg);
  //   },
  //   reconnectDelay: 5000,
  //   heartbeatIncoming: 4000,
  //   heartbeatOutgoing: 4000
  // });

  // await new Promise((resolve, reject) => {

  //   client.onConnect = (frame: Frame) => {
  //     // Do something, all subscribes must be done is this callback
  //     // This is needed because this will be executed after a (re)connect
  //     resolve(client);
  //   };

  //   client.onStompError = (frame: Frame) => {
  //     // Will be invoked in case of error encountered at Broker
  //     // Bad login/passcode typically will cause an error
  //     // Complaint brokers will set `message` header with a brief message. Body may contain details.
  //     // Compliant brokers will terminate the connection after any error
  //     log.debug('STOMP - Broker reported error: ' + frame.headers.message);
  //     log.debug('STOMP - Additional details: ' + frame.body);
  //     const frameStr = JSON.stringify(frame);
  //     reject(new Error(`Failed to establish stomp connection: ${frameStr}`));
  //   };

  //   client.activate();
  // });

  // client.publish({ destination: 'rpc.server', body: JSON.stringify(body) });

  // const subscription = await new Promise<StompSubscription>((resolve, reject) => {
  //   const theSubscription = client.subscribe(body.JMSReplyTo, (message: IMessage) => {
  //     log.debug(`StompJS Received Message: %o`, message);
  //     resolve(theSubscription);
  //   });
  // });

  // subscription.unsubscribe();

  test.onFinish(async () => {
    log.debug(`Starting teardown...`);
    await cordaTestLedger.stop();
    log.debug(`Stopped container OK.`);
    await cordaTestLedger.destroy();
    log.debug(`Destroyed container OK.`);
  });

  t.end();
});
