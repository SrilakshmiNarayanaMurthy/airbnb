const kafka = require("./kafkaClient");
const Booking = require("../models/Booking");

const consumer = kafka.consumer({ groupId: "owner-service" });

async function startBookingConsumer() {
  await consumer.connect();
  console.log("[Kafka] bookingConsumer connected");

  await consumer.subscribe({ topic: "bookings", fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        console.log("[Kafka] booking event received:", event);

        // optional: mark as pending_review or just log
        await Booking.findByIdAndUpdate(event.bookingId, {
          // status: "pending", // or custom status if you want
        });

      } catch (err) {
        console.error("[Kafka] Error handling booking event:", err.message);
      }
    },
  });
}

module.exports = { startBookingConsumer };
