// backend/kafka/bookingProducer.js
const kafka = require('./kafkaClient');

const producer = kafka.producer();
let isConnected = false;

async function initProducer() {
  if (isConnected) return;
  await producer.connect();
  isConnected = true;
  console.log('[Kafka] Producer connected');
}

async function publishBookingCreated(booking) {
  try {
    if (!isConnected) {
      await initProducer();
    }

    const event = {
      bookingId: booking.id,
      travelerId: booking.travelerId,
      ownerId: booking.ownerId,
      propertyId: booking.propertyId,
      status: booking.status,
      createdAt: booking.createdAt,
    };

    await producer.send({
      topic: 'bookings',
      messages: [
        {
          key: String(event.bookingId),
          value: JSON.stringify(event),
        },
      ],
    });

    console.log('[Kafka] booking_created sent:', event);
  } catch (err) {
    console.error('[Kafka] Error publishing booking_created', err.message);
  }
}

module.exports = {
  initProducer,
  publishBookingCreated,
};
