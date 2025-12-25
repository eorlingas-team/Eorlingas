const bookingModel = require('../models/bookingModel');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');

/**
 * Cron job handler to send booking reminders
 * URL: /api/cron/reminders
 * Method: GET or POST
 * Auth: Protected by a shared secret query param ?secret=...
 */
const sendReminders = async (req, res) => {
  try {
    const { secret } = req.query;
    const cronSecret = process.env.CRON_SECRET || 'EorlingasCronSecret2025';

    if (secret !== cronSecret) {
      return res.status(401).json({ error: 'Unauthorized: Invalid cron secret' });
    }

    console.log('[CRON] Starting booking reminder check...');

    const bookings = await bookingModel.findBookingsNeedingReminder();
    
    console.log(`[CRON] Found ${bookings.length} bookings needing reminder.`);

    let sentCount = 0;
    let errorCount = 0;

    for (const booking of bookings) {
      try {
        await emailService.sendBookingReminderEmail({
          to: booking.user.email,
          fullName: booking.user.fullName,
          booking: booking
        });

        // Send in-app notification
        await notificationService.createNotification(booking.userId, 'Booking_Reminder', {
          subject: 'Booking Reminder',
          message: `Reminder: Your booking for ${booking.space.spaceName} is in 1 hour.`,
          bookingId: booking.bookingId,
          relatedEntityId: booking.bookingId,
          relatedEntityType: 'Booking'
        });

        await bookingModel.markReminderSent(booking.bookingId);
        sentCount++;
        
      } catch (err) {
        console.error(`[CRON] Failed to send reminder for booking ${booking.bookingId}:`, err);
        errorCount++;
      }
    }

    console.log(`[CRON] Wrapper finished. Sent: ${sentCount}, Errors: ${errorCount}`);

    return res.status(200).json({
      success: true,
      message: 'Reminder process completed',
      stats: {
        totalFound: bookings.length,
        sent: sentCount,
        errors: errorCount
      }
    });

  } catch (error) {
    console.error('[CRON] Fatal error in reminder job:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  sendReminders
};
