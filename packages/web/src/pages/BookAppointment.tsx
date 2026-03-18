import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError, type Clinician, type Patient } from "@/lib/api";
import { CalendarPlus, CheckCircle2, AlertCircle } from "lucide-react";

function generateTimeSlots() {
  const slots: { value: string; label: string }[] = [];
  for (let h = 7; h <= 20; h++) {
    for (const m of [0, 30]) {
      if (h === 20 && m === 30) continue;
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const hour12 = h % 12 || 12;
      const ampm = h < 12 ? "AM" : "PM";
      const label = `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
      slots.push({ value, label });
    }
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

export default function BookAppointment() {
  const [clinicians, setClinicians] = useState<Clinician[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [clinicianId, setClinicianId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [status, setStatus] = useState<
    { type: "idle" } | { type: "loading" } | { type: "success"; message: string } | { type: "error"; message: string }
  >({ type: "idle" });

  useEffect(() => {
    api.getClinicians().then(setClinicians).catch(console.error);
    api.getPatients().then(setPatients).catch(console.error);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ type: "loading" });

    const start = new Date(`${date}T${startTime}`).toISOString();
    const end = new Date(`${date}T${endTime}`).toISOString();

    const clinician = clinicians.find((c) => c.id === clinicianId);
    const patient = patients.find((p) => p.id === patientId);

    try {
      await api.createAppointment({
        clinicianId,
        patientId,
        start,
        end,
        clinicianName: clinician?.name,
        patientName: patient?.name,
        patientEmail: patient?.email ?? undefined,
      });
      setStatus({
        type: "success",
        message: `Appointment booked with ${clinician?.name || clinicianId}`,
      });
      setDate("");
      setStartTime("");
      setEndTime("");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to book appointment";
      setStatus({ type: "error", message });
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-accent rounded-lg">
          <CalendarPlus className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Book Appointment</h1>
          <p className="text-muted-foreground text-sm">
            Schedule a new appointment with a clinician
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-card rounded-xl border border-border p-6 space-y-5 shadow-sm"
      >
        <div className="space-y-2">
          <Label htmlFor="clinician">Clinician</Label>
          <Select value={clinicianId} onValueChange={setClinicianId}>
            <SelectTrigger id="clinician">
              <SelectValue placeholder="Select a clinician" />
            </SelectTrigger>
            <SelectContent>
              {clinicians.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.specialty && (
                    <span className="text-muted-foreground">
                      {" "}
                      — {c.specialty}
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="patient">Patient</Label>
          <Select value={patientId} onValueChange={setPatientId}>
            <SelectTrigger id="patient">
              <SelectValue placeholder="Select a patient" />
            </SelectTrigger>
            <SelectContent>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Time</Label>
            <Select value={startTime} onValueChange={setStartTime}>
              <SelectTrigger>
                <SelectValue placeholder="Start time" />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((slot) => (
                  <SelectItem key={slot.value} value={slot.value}>
                    {slot.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>End Time</Label>
            <Select value={endTime} onValueChange={setEndTime}>
              <SelectTrigger>
                <SelectValue placeholder="End time" />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.filter((slot) => slot.value > startTime).map(
                  (slot) => (
                    <SelectItem key={slot.value} value={slot.value}>
                      {slot.label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={
            !clinicianId ||
            !patientId ||
            !date ||
            !startTime ||
            !endTime ||
            status.type === "loading"
          }
        >
          {status.type === "loading" ? "Booking..." : "Book Appointment"}
        </Button>

        {status.type === "success" && (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {status.message}
          </div>
        )}
        {status.type === "error" && (
          <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {status.message}
          </div>
        )}
      </form>
    </div>
  );
}
