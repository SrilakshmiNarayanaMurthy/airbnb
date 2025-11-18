// backend/kafka/kafkaClient.js
const { Kafka } = require('kafkajs');

const brokers =
  process.env.KAFKA_BROKERS?.split(',') || ['kafka:9092']; // 'kafka' = K8s service name

const kafka = new Kafka({
  clientId: 'airbnb-app',
  brokers,
});

module.exports = kafka;
