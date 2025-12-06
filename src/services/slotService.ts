import { eq, and, gte, lt, not, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, appointments } from '../db/schema.js';

export const slotService = {
  async getAvailableSlots(masterId: number, dateStr: string) {
    // 1. Fetch Master Config
    const master = await db.query.users.findFirst({
      where: eq(users.id, masterId),
    });

    if (!master || master.role !== 'master' || !master.masterProfile) {
      throw new Error('Master not found or invalid profile');
    }

    const { masterProfile } = master;
    const targetDate = new Date(dateStr);
    
    // Validate date
    if (isNaN(targetDate.getTime())) {
      throw new Error('Invalid date format');
    }

    // 2. Check Day Off (0 = Sunday, 1 = Monday, etc.)
    const dayOfWeek = targetDate.getDay();
    if (masterProfile.daysOff.includes(dayOfWeek)) {
      return []; // Day off
    }

    // 3. Generate Grid
    const slots: { time: string; isAvailable: boolean }[] = [];
    const slotDurationMs = masterProfile.slotDuration * 60 * 1000;

    // Set start and end times for the day in local time representation
    // Note: We assume the dateStr passed is "YYYY-MM-DD" and we treat it as local date.
    // To avoid timezone mess, we can construct dates relative to the input string.
    
    const workStart = new Date(dateStr);
    workStart.setHours(masterProfile.workStartHour, 0, 0, 0);
    
    const workEnd = new Date(dateStr);
    workEnd.setHours(masterProfile.workEndHour, 0, 0, 0);

    // 4. Fetch Existing Bookings
    // We need appointments that overlap with the working day
    const existingAppointments = await db.query.appointments.findMany({
      where: and(
        eq(appointments.masterId, masterId),
        or(
            eq(appointments.status, 'confirmed'),
            eq(appointments.status, 'pending')
        ),
        gte(appointments.endTime, workStart),
        lt(appointments.startTime, workEnd)
      ),
    });

    // 5. Filter Slots
    let currentSlotStart = new Date(workStart);

    while (currentSlotStart.getTime() + slotDurationMs <= workEnd.getTime()) {
      const currentSlotEnd = new Date(currentSlotStart.getTime() + slotDurationMs);
      
      const isOverlapping = existingAppointments.some(appt => {
        // Overlap logic: (StartA < EndB) and (EndA > StartB)
        return (appt.startTime < currentSlotEnd && appt.endTime > currentSlotStart);
      });

      if (!isOverlapping) {
        slots.push({
          time: currentSlotStart.toTimeString().slice(0, 5), // "HH:MM"
          isAvailable: true
        });
      }

      // Next slot
      currentSlotStart = new Date(currentSlotStart.getTime() + slotDurationMs);
    }

    return slots;
  }
};

