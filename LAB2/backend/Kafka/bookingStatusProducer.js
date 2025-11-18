const kafka = require("./kafkaClient");

const producer = kafka.producer();

async function publishStatusUpdate(bookingId, ownerId, status) {
  await producer.connect();

  await producer.send({
    topic: "booking-status",
    messages: [
      {
        value: JSON.stringify({
          bookingId,
          ownerId,
          status,
          updatedAt: new Date().toISOString(),
        }),
      },
    ],
  });

  console.log("[Kafka] booking-status sent:", bookingId, status);
}

module.exports = { publishStatusUpdate };
