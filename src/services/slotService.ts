import { eq, and, gte, lt, not, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, appointments } from '../db/schema.js';

export const slotService = {
  async getAvailableSlots(masterId: number, dateStr: string, serviceDuration: number) {
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

    // 2. Check if date exists in workingDates
    const daySchedule = masterProfile.workingDates?.[dateStr];
    
    if (!daySchedule) {
      return []; // Day not configured as working day
    }

    // 3. Generate Grid with service duration
    const slots: { time: string; isAvailable: boolean }[] = [];
    const slotDurationMs = serviceDuration * 60 * 1000;

    // Parse start and end times from schedule (format "HH:MM")
    // Формируем даты явно в UTC для консистентности с appointmentService
    const workStart = new Date(`${dateStr}T${daySchedule.start}:00.000Z`);
    const workEnd = new Date(`${dateStr}T${daySchedule.end}:00.000Z`);

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

    // 5. Filter Slots - поминутный шаг для гибкости
    let currentSlotStart = new Date(workStart);
    const stepMs = 15 * 60 * 1000; // Шаг 15 минут

    while (currentSlotStart.getTime() + slotDurationMs <= workEnd.getTime()) {
      const currentSlotEnd = new Date(currentSlotStart.getTime() + slotDurationMs);
      
      const isOverlapping = existingAppointments.some(appt => {
        // Overlap logic: (StartA < EndB) and (EndA > StartB)
        return (appt.startTime < currentSlotEnd && appt.endTime > currentSlotStart);
      });

      if (!isOverlapping) {
        slots.push({
          time: currentSlotStart.toISOString().slice(11, 16), // "HH:MM" в UTC
          isAvailable: true
        });
      }

      // Next slot - шаг 15 минут
      currentSlotStart = new Date(currentSlotStart.getTime() + stepMs);
    }

    return slots;
  }
};

