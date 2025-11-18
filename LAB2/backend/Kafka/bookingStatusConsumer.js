const kafka = require("./kafkaClient");
const Booking = require("../models/Booking");

const consumer = kafka.consumer({ groupId: "traveler-service" });

async function startStatusConsumer() {
  await consumer.connect();
  console.log("[Kafka] bookingStatusConsumer connected");

  await consumer.subscribe({ topic: "booking-status", fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        console.log("[Kafka] booking-status event:", event);

        await Booking.findByIdAndUpdate(event.bookingId, {
          status: event.status,
        });

        console.log(
          `[Kafka] Booking ${event.bookingId} status -> ${event.status}`
        );
      } catch (err) {
        console.error("[Kafka] Error handling booking-status:", err.message);
      }
    },
  });
}

module.exports = { startStatusConsumer };
